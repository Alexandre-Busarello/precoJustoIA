/**
 * Análise qualitativa de ETFs via Gemini.
 * Retorna score 0-100 + resumo textual para compor o PJ-ETF Score.
 * Retry automático até 3 tentativas com backoff exponencial.
 */
import { GoogleGenAI } from '@google/genai';

const MODEL = 'gemini-flash-lite-latest';
const MAX_RETRIES = 3;

export interface EtfAiInput {
  ticker: string;
  name: string;
  benchmarkIndex: string | null;
  category: string | null;
  netExpenseRatio: number | null;
  netAssets: number | null;
  return6m: number | null;
  return1y: number | null;
  return3y: number | null;
  return5y: number | null;
  volatility12m: number | null;
  holdingsConcentrationTop5: number | null;
  // top holdings para detectar estruturas de fundo-de-fundos
  topHoldings: Array<{ ticker: string | null; name: string; weight: number }>;
  // dimensões quantitativas já calculadas (0-100)
  custoScore: number;
  retornoScore: number;
  liquidezScore: number;
  solidezScore: number;
  qualidadeCarteiraScore: number;
}

export interface EtfAiResult {
  score: number;              // 0-100
  summary: string;            // 2-3 frases
  skipConcentracaoPenalty: boolean; // true se a concentração é estrutural (fundo-de-fundos)
}

function formatPct(v: number | null): string {
  if (v === null) return 'N/D';
  return (v * 100).toFixed(1) + '%';
}

function formatAUM(v: number | null): string {
  if (v === null) return 'N/D';
  if (v >= 1e9) return 'R$ ' + (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return 'R$ ' + (v / 1e6).toFixed(0) + 'M';
  return 'R$ ' + v.toLocaleString('pt-BR');
}

function buildHoldingsList(holdings: EtfAiInput['topHoldings']): string {
  if (holdings.length === 0) return 'Não disponível';
  return holdings
    .map((h, i) => `${i + 1}. ${h.ticker ?? '—'} ${h.name} (${(h.weight * 100).toFixed(1)}%)`)
    .join('\n');
}

function buildPrompt(etf: EtfAiInput): string {
  return `Você é um analista especializado em ETFs para o mercado brasileiro. Realize uma análise QUALITATIVA do ETF abaixo e retorne EXCLUSIVAMENTE um JSON válido, sem markdown ou texto extra.

## Dados do ETF

**Identificação:**
- Ticker: ${etf.ticker}
- Nome: ${etf.name}
- Índice de Referência: ${etf.benchmarkIndex ?? 'Não informado'}
- Categoria: ${etf.category ?? 'Não informada'}

**Dados Quantitativos:**
- Taxa de Administração: ${etf.netExpenseRatio !== null ? (etf.netExpenseRatio * 100).toFixed(2) + '% a.a.' : 'N/D'}
- Patrimônio Líquido: ${formatAUM(etf.netAssets)}
- Retorno 6 meses: ${formatPct(etf.return6m)}
- Retorno 1 ano: ${formatPct(etf.return1y)}
- Retorno 3 anos: ${formatPct(etf.return3y)}
- Retorno 5 anos: ${formatPct(etf.return5y)}
- Volatilidade 12m: ${formatPct(etf.volatility12m)}
- Concentração Top 5 holdings: ${formatPct(etf.holdingsConcentrationTop5)}

**Principais Holdings:**
${buildHoldingsList(etf.topHoldings)}

**Score PJ Quantitativo (dimensões 0–100):**
- Custo: ${etf.custoScore.toFixed(0)}/100
- Retorno relativo ao grupo: ${etf.retornoScore.toFixed(0)}/100
- Liquidez: ${etf.liquidezScore.toFixed(0)}/100
- Solidez (tamanho): ${etf.solidezScore.toFixed(0)}/100
- Qualidade da carteira: ${etf.qualidadeCarteiraScore.toFixed(0)}/100

## Critérios de Avaliação Qualitativa

Avalie os seguintes aspectos com os pesos indicados:

1. **Relevância e qualidade do índice rastreado (25%):** O benchmark é reconhecido, líquido e relevante? Índices amplamente usados como IBOV, SMLL, IMA-B, S&P 500, IDKA são mais confiáveis. Índices muito estreitos, proprietários sem histórico ou de ativos exóticos reduzem a nota.

2. **Reputação e solidez da gestora/emissora (20%):** iShares (BlackRock), Itaú, BTG Pactual, XP, Bradesco Asset, BB DTVM são gestoras estabelecidas com track record. Gestoras novas ou sem histórico no mercado de ETFs penalizam a nota.

3. **Coerência e disciplina estratégica (20%):** A estratégia é clara, disciplinada e bem definida? A composição da carteira faz sentido em relação ao benchmark declarado? ETFs que desviam da estratégia ou têm holdings inconsistentes perdem pontos.

4. **Custo-benefício qualitativo (15%):** A taxa de administração é competitiva considerando o tipo de exposição e complexidade operacional? Compare com alternativas de mercado: ETFs de renda variável BR acima de 0,5% e de renda fixa acima de 0,2% são considerados caros.

5. **Adequação para o investidor brasileiro médio (10%):** O ETF é compreensível e adequado para o perfil médio do investidor de varejo brasileiro? Produtos muito exóticos (crypto, alavancados, estratégias de derivativos complexas) ou voltados exclusivamente a investidores qualificados perdem pontos aqui.

6. **Perspectiva estrutural de longo prazo (10%):** O segmento/classe de ativo tem fundamentos estruturais sólidos para médio-longo prazo no contexto econômico brasileiro? Avalie tendências macro e a sustentabilidade da proposta de valor.

## Avaliação da Penalidade de Concentração

O sistema aplica automaticamente uma penalidade quando a concentração Top 5 holdings é acima de 65%. Porém, essa penalidade pode ser INCORRETA em casos específicos.

**Defina "pular_penalidade_concentracao" como TRUE se ALL of these condições forem verdadeiras:**
- O ETF é um **fundo-de-fundos** (feeder fund / fundo espelho) — ou seja, sua principal posição é outro ETF, fundo de índice, ou veículo de investimento diversificado (como QQQ, IVV, SPY, BOVA11, etc.)
- A alta concentração é **estrutural e intencional** pela natureza do produto (não é concentração em ações individuais)
- O holding dominante é em si um produto **amplamente diversificado**

**Mantenha como FALSE se:**
- O ETF concentra em ações individuais ou poucos emissores específicos
- A concentração representa risco real de concentração setorial ou de emissor
- Não há clareza sobre se o holding dominante é diversificado

## Escala de Score

- **80–100 (Excelente):** ETF de referência no segmento, gestora renomada, índice amplamente reconhecido, custo competitivo, alta adequação.
- **65–79 (Bom):** Boas características gerais com algum ponto de atenção menor.
- **45–64 (Regular):** Características mistas — pode ser nicho, gestora menos conhecida, ou custo elevado para o que oferece.
- **0–44 (Fraco):** Problemas relevantes: índice pouco transparente, estratégia confusa, custo elevado sem justificativa, ou produto inadequado para o mercado local.

## Formato de Resposta

Retorne APENAS este JSON (sem markdown, sem texto extra, sem comentários):

{"score":<inteiro 0-100>,"resumo":"<2 frases objetivas: principal força e principal limitação>","pontos_positivos":["<ponto 1>","<ponto 2>"],"pontos_negativos":["<ponto 1>"],"veredicto":"<Excelente|Bom|Regular|Fraco>","pular_penalidade_concentracao":<true|false>}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseAiResponse(raw: string): EtfAiResult {
  const clean = raw.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  const parsed = JSON.parse(clean) as {
    score: unknown;
    resumo: unknown;
    pular_penalidade_concentracao: unknown;
  };

  const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score))));
  if (isNaN(score)) throw new Error('score inválido no JSON da IA');

  const summary = String(parsed.resumo ?? '').slice(0, 500);
  const skipConcentracaoPenalty = parsed.pular_penalidade_concentracao === true;
  return { score, summary, skipConcentracaoPenalty };
}

export async function analyzeEtfWithAi(etf: EtfAiInput): Promise<EtfAiResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('⚠️  GEMINI_API_KEY não configurada — análise IA ignorada');
    return null;
  }

  const prompt = buildPrompt(etf);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json' },
      });

      const text = response.text ?? '';
      if (!text) throw new Error('resposta vazia do Gemini');

      return parseAiResponse(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️  ${etf.ticker} IA tentativa ${attempt}/${MAX_RETRIES}: ${msg}`);
      if (attempt < MAX_RETRIES) {
        await delay(Math.pow(2, attempt) * 1000); // 2s, 4s
      }
    }
  }

  console.error(`❌ ${etf.ticker}: análise IA falhou após ${MAX_RETRIES} tentativas`);
  return null;
}
