/**
 * Serviço de geração de descrições didáticas de ETFs via Gemini.
 * Gera 3 parágrafos: tese do fundo, perfil do investidor e papel na carteira.
 * Armazena em Company.description — exibido na seção "Sobre o [ticker]".
 */
import { GoogleGenAI } from '@google/genai';
import { prisma } from '@/lib/prisma';

const MODEL = 'gemini-flash-lite-latest';
const MAX_RETRIES = 3;
const INTER_ETF_DELAY_MS = 400;

interface EtfDescInput {
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
  aiConcentracaoPenaltyOverride: boolean | null;
  topHoldings: Array<{ ticker: string | null; name: string; weight: number }>;
}

function fmtPct(v: number | null): string {
  if (v === null) return 'N/D';
  const sign = v >= 0 ? '+' : '';
  return `${sign}${(v * 100).toFixed(1)}%`;
}

function fmtAUM(v: number | null): string {
  if (v === null) return 'N/D';
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(1)} bilhões`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(0)} milhões`;
  return `R$ ${v.toLocaleString('pt-BR')}`;
}

function buildPrompt(etf: EtfDescInput): string {
  const lines: string[] = [`Ticker: ${etf.ticker}`, `Nome: ${etf.name}`];

  if (etf.benchmarkIndex) lines.push(`Índice de referência: ${etf.benchmarkIndex}`);
  if (etf.category) lines.push(`Categoria: ${etf.category}`);
  if (etf.netExpenseRatio !== null) lines.push(`Taxa de administração: ${(etf.netExpenseRatio * 100).toFixed(2)}% a.a.`);
  lines.push(`Patrimônio líquido: ${fmtAUM(etf.netAssets)}`);
  lines.push(
    `Retornos — 6m: ${fmtPct(etf.return6m)} | 1a: ${fmtPct(etf.return1y)} | 3a: ${fmtPct(etf.return3y)} | 5a: ${fmtPct(etf.return5y)}`
  );

  if (etf.topHoldings.length > 0) {
    lines.push(`Principais posições:`);
    etf.topHoldings.slice(0, 5).forEach((h, i) => {
      lines.push(`  ${i + 1}. ${h.ticker ?? '—'} ${h.name} — ${(h.weight * 100).toFixed(1)}%`);
    });
  }

  if (etf.aiConcentracaoPenaltyOverride) {
    lines.push(
      `Observação: este é um fundo espelho/quanto — as posições de renda fixa são colateral de swap cambial, não posições diretas de risco.`
    );
  }

  return `Você é um especialista em ETFs para o mercado brasileiro. Com base nos dados abaixo, escreva uma descrição didática e acessível sobre este ETF para investidores de varejo.

DADOS DO ETF:
${lines.join('\n')}

INSTRUÇÕES:
Escreva exatamente 3 parágrafos em português brasileiro, separados por linha em branco (\\n\\n). Seja claro, direto e acessível — use linguagem simples, sem jargões desnecessários. Máximo de 300 palavras no total.

Parágrafo 1 — Tese do fundo: Explique o que este ETF faz, qual índice ou estratégia segue, como funciona (replicação passiva, exposição cambial, renda fixa, setorial etc.) e o que o segmento representa economicamente.

Parágrafo 2 — Perfil do investidor: Para quem este ETF é adequado? Mencione o perfil de risco indicado (conservador, moderado ou arrojado), o horizonte de investimento recomendado, e se é indicado para iniciantes ou investidores mais experientes.

Parágrafo 3 — Papel na carteira: Como este ETF se encaixa em uma carteira? Pode ser posição central (core) para quem busca exposição ampla e diversificada, ou posição complementar (satélite) para diversificação geográfica, hedge cambial, acesso a setores específicos ou estratégias temáticas.

REGRAS OBRIGATÓRIAS:
- Sem títulos, sem marcadores, sem listas — apenas 3 parágrafos corridos
- Não mencione preços específicos nem faça recomendação de compra ou venda
- Responda SOMENTE com os 3 parágrafos separados por linha em branco, sem prefácio nem conclusão`;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateOne(ai: GoogleGenAI, etf: EtfDescInput): Promise<string | null> {
  const prompt = buildPrompt(etf);

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });

      const text = (response.text ?? '').trim();
      if (!text || text.length < 80) throw new Error('resposta vazia ou muito curta');

      return text;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️  ${etf.ticker} descrição tentativa ${attempt}/${MAX_RETRIES}: ${msg}`);
      if (attempt < MAX_RETRIES) {
        await delay(Math.pow(2, attempt) * 1000);
      }
    }
  }

  console.error(`❌ ${etf.ticker}: geração de descrição falhou após ${MAX_RETRIES} tentativas`);
  return null;
}

export async function generateEtfDescriptions(
  options: { forceAll?: boolean; ticker?: string } = {}
): Promise<{ generated: number; failed: number; skipped: number }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('⚠️  GEMINI_API_KEY não configurada — pulando geração de descrições de ETFs');
    return { generated: 0, failed: 0, skipped: 0 };
  }

  const ai = new GoogleGenAI({ apiKey });

  const where: Record<string, unknown> = { assetType: 'ETF', isActive: true };
  if (options.ticker) {
    where.ticker = options.ticker.toUpperCase();
  } else if (!options.forceAll) {
    // Gera para ETFs sem descrição OU cuja descrição não veio da IA
    // (ex: texto cru em inglês herdado do longBusinessSummary da Yahoo Finance).
    // Prisma's `not` não casa com NULL (semântica SQL), então precisa ser explícito.
    where.OR = [
      { description: null },
      { descriptionSource: null },
      { descriptionSource: { not: 'ai' } },
    ];
  }

  const companies = await prisma.company.findMany({
    where,
    select: {
      id: true,
      ticker: true,
      name: true,
      etfData: {
        select: {
          benchmarkIndex: true,
          category: true,
          netExpenseRatio: true,
          netAssets: true,
          return6m: true,
          return1y: true,
          return3y: true,
          return5y: true,
          aiConcentracaoPenaltyOverride: true,
          holdings: {
            orderBy: { weight: 'desc' },
            take: 5,
            select: { ticker: true, name: true, weight: true },
          },
        },
      },
    },
    orderBy: { ticker: 'asc' },
  });

  const stats = { generated: 0, failed: 0, skipped: 0 };

  console.log(`📝 [ETF DESC] ${companies.length} ETFs para processar...`);

  for (const company of companies) {
    if (!company.etfData) {
      stats.skipped++;
      continue;
    }

    const e = company.etfData;
    const input: EtfDescInput = {
      ticker: company.ticker,
      name: company.name,
      benchmarkIndex: e.benchmarkIndex,
      category: e.category,
      netExpenseRatio: e.netExpenseRatio ? Number(e.netExpenseRatio) : null,
      netAssets: e.netAssets ? Number(e.netAssets) : null,
      return6m: e.return6m ? Number(e.return6m) : null,
      return1y: e.return1y ? Number(e.return1y) : null,
      return3y: e.return3y ? Number(e.return3y) : null,
      return5y: e.return5y ? Number(e.return5y) : null,
      aiConcentracaoPenaltyOverride: e.aiConcentracaoPenaltyOverride,
      topHoldings: e.holdings.map((h) => ({
        ticker: h.ticker,
        name: h.name,
        weight: Number(h.weight),
      })),
    };

    const description = await generateOne(ai, input);

    if (description) {
      await prisma.company.update({
        where: { id: company.id },
        data: { description, descriptionSource: 'ai' },
      });
      console.log(`✅ ${company.ticker}: ${description.length} chars`);
      stats.generated++;
    } else {
      stats.failed++;
    }

    await delay(INTER_ETF_DELAY_MS);
  }

  console.log(
    `✅ [ETF DESC] ${stats.generated} geradas, ${stats.failed} falhas, ${stats.skipped} puladas (sem etfData)`
  );
  return stats;
}
