/**
 * CUSTOM TRIGGER REPORT SERVICE
 * 
 * Serviço para gerar relatórios de gatilhos customizados
 */

import { GoogleGenAI } from '@google/genai';
import { FAIR_VALUE_MODEL_LABEL, type TriggerConfig } from './custom-trigger-service';
import { formatBRL, formatNumber, formatPct } from './format';
import { formatAlertPct } from '@/app/dashboard/monitoramentos-customizados/monitor-fields';

export interface CustomTriggerReportParams {
  ticker: string;
  companyName: string;
  triggerConfig: TriggerConfig;
  companyData: {
    pl?: number;
    pvp?: number;
    score?: number;
    currentPrice?: number;
    bazinCeiling?: number;
    fairValue?: number;
    discount?: number;
    dyTtm?: number;
  };
  reasons: string[];
}

/**
 * Explica o motivo do disparo do gatilho
 */
export async function explainTrigger(
  triggerConfig: TriggerConfig,
  companyData: CustomTriggerReportParams['companyData'],
  reasons: string[]
): Promise<string> {
  if (!process.env.GEMINI_API_KEY) {
    // Fallback sem IA se não tiver API key
    return generateFallbackExplanation(triggerConfig, companyData, reasons);
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const prompt = `Você é um educador financeiro que explica conceitos de forma clara e acessível.

Um gatilho customizado foi disparado para uma ação. Abaixo estão os detalhes:

**CONFIGURAÇÃO DO GATILHO:**
${JSON.stringify(triggerConfig, null, 2)}

**DADOS ATUAIS DA EMPRESA:**
${JSON.stringify(companyData, null, 2)}

**MOTIVOS DO DISPARO:**
${reasons.map((r, i) => `${i + 1}. ${r}`).join('\n')}

**SUA TAREFA:**

Explique de forma clara e educativa:
1. O que significa cada condição que foi atendida
2. Por que isso é relevante para análise de investimentos
3. O que o investidor deve observar daqui para frente

**FORMATO:**
- Use linguagem simples e acessível
- Evite jargões técnicos sem explicação
- Seja objetivo e direto
- Máximo 300 palavras`;

  try {
    const model = 'gemini-flash-lite-latest';
    const contents = [
      {
        role: 'user',
        parts: [{ text: prompt }],
      },
    ];

    const response = await ai.models.generateContentStream({
      model,
      contents,
    });

    let fullResponse = '';
    for await (const chunk of response) {
      if (chunk.text) {
        fullResponse += chunk.text;
      }
    }

    if (!fullResponse.trim()) {
      return generateFallbackExplanation(triggerConfig, companyData, reasons);
    }

    return fullResponse.trim();
  } catch (error) {
    console.error('Erro ao gerar explicação com IA:', error);
    return generateFallbackExplanation(triggerConfig, companyData, reasons);
  }
}

/**
 * Gera explicação sem IA (fallback)
 */
function generateFallbackExplanation(
  triggerConfig: TriggerConfig,
  companyData: CustomTriggerReportParams['companyData'],
  reasons: string[]
): string {
  let explanation = '## Motivo do Disparo\n\n';
  explanation += 'O gatilho customizado foi disparado pelas seguintes razões:\n\n';
  
  reasons.forEach((reason, index) => {
    explanation += `${index + 1}. ${reason}\n`;
  });

  explanation += '\n## O que isso significa?\n\n';

  // Explicar cada tipo de filtro
  if (triggerConfig.minPl !== undefined || triggerConfig.maxPl !== undefined) {
    explanation += '**P/L (Preço sobre Lucro)**: Indica quantas vezes o preço da ação está em relação ao lucro por ação. ';
    explanation += 'Um P/L menor significa que o mercado paga menos por real de lucro; compare com o histórico e com empresas do mesmo setor.\n\n';
  }

  if (triggerConfig.minPvp !== undefined || triggerConfig.maxPvp !== undefined) {
    explanation += '**P/VP (Preço sobre Valor Patrimonial)**: Compara o preço da ação com o valor patrimonial por ação. ';
    explanation += 'Um P/VP abaixo de 1 indica que a ação está negociando abaixo do valor contábil.\n\n';
  }

  if (triggerConfig.minScore !== undefined || triggerConfig.maxScore !== undefined) {
    explanation += '**Score Geral**: Nota consolidada que avalia múltiplos aspectos da empresa (fundamentos, estratégias, demonstrações financeiras). ';
    explanation += 'Scores mais altos indicam empresas com fundamentos mais sólidos.\n\n';
  }

  if (triggerConfig.priceReached || triggerConfig.priceBelow || triggerConfig.priceAbove) {
    explanation += '**Preço da ação**: o preço atual atingiu um nível configurado no gatilho. ';
    explanation += 'Use o aviso como ponto de partida para revisar os fundamentos, não como decisão isolada.\n\n';
  }

  if (triggerConfig.bazinCeiling) {
    explanation += `**Preço-teto Bazin**: média anual dos proventos (dividendos + JCP) dos últimos 5 anos completos dividida pelo DY-alvo de ${formatAlertPct(triggerConfig.bazinCeiling.targetYield)}. `;
    explanation += 'Abaixo do teto, o rendimento histórico em proventos supera o DY-alvo. É uma estimativa baseada no passado.\n\n';
  }

  if (triggerConfig.fairValueDiscount) {
    const label = FAIR_VALUE_MODEL_LABEL[triggerConfig.fairValueDiscount.model] ?? triggerConfig.fairValueDiscount.model;
    explanation += `**Desconto vs preço justo (${label})**: o preço está pelo menos ${formatAlertPct(triggerConfig.fairValueDiscount.minDiscount)} abaixo do preço justo estimado pelo modelo. `;
    explanation += 'O preço justo é uma estimativa e depende das premissas do modelo.\n\n';
  }

  if (triggerConfig.dyTtmAbove) {
    explanation += `**Dividend yield 12 meses**: soma dos proventos com data-com nos últimos 12 meses dividida pelo preço atual, acima de ${formatAlertPct(triggerConfig.dyTtmAbove.minDy)}. `;
    explanation += 'Proventos passados não garantem pagamentos futuros.\n\n';
  }

  return explanation;
}

/**
 * Adiciona conteúdo educativo sobre o tipo de gatilho
 */
export function addEducationalContent(triggerType: keyof TriggerConfig): string {
  const educationalContent: Record<string, string> = {
    minPl: `## Entendendo o P/L Mínimo

O **P/L (Preço sobre Lucro)** é um dos indicadores mais usados na análise de ações. Ele mostra quantas vezes o preço da ação está em relação ao lucro por ação.

**Como interpretar:**
- **P/L baixo (< 10)**: O mercado paga menos por real de lucro; pode refletir desconto ou risco maior
- **P/L médio (10-20)**: Considerado normal para muitas empresas
- **P/L alto (> 20)**: Pode refletir expectativa de crescimento ou preço exigente

**Importante**: O P/L deve ser analisado em conjunto com outros indicadores e comparado com empresas do mesmo setor.`,

    maxPl: `## Entendendo o P/L Máximo

Quando o P/L está acima de um valor máximo configurado, significa que o mercado paga mais por real de lucro do que o limite que você definiu.

**O que observar:**
- Verifique se há expectativas de crescimento que justifiquem o P/L elevado
- Compare com o histórico da empresa e com concorrentes
- Analise se os lucros são sustentáveis ou pontuais`,

    minPvp: `## Entendendo o P/VP Mínimo

O **P/VP (Preço sobre Valor Patrimonial)** compara o preço da ação com o valor patrimonial por ação.

**Como interpretar:**
- **P/VP < 1**: Ação negociando abaixo do valor contábil
- **P/VP = 1**: Preço igual ao valor patrimonial
- **P/VP > 1**: Ação negociando acima do valor contábil

**Importante**: Empresas com muitos ativos intangíveis podem ter P/VP naturalmente mais alto.`,

    maxPvp: `## Entendendo o P/VP Máximo

Um P/VP acima do máximo configurado significa que o mercado paga mais por real de patrimônio do que o limite que você definiu.

**O que considerar:**
- Empresas de tecnologia e serviços tendem a ter P/VP mais alto
- Compare com empresas do mesmo setor
- Verifique se há crescimento que justifique a valorização`,

    minScore: `## Entendendo o Score Mínimo

O **Score Geral** é uma nota consolidada que avalia múltiplos aspectos da empresa.

**Componentes do Score:**
- Estratégias de investimento (Graham, FCD, Gordon, etc)
- Demonstrações financeiras (ROE, ROIC, margens, etc)
- Sentimento de mercado (análises de vídeos, blogs, etc)

**Como usar:**
- Scores acima de 70 são considerados bons
- Scores acima de 80 indicam empresas com fundamentos muito sólidos
- Use o score como ponto de partida, não como decisão única`,

    maxScore: `## Entendendo o Score Máximo

Quando o score está abaixo de um máximo configurado, pode indicar deterioração nos fundamentos.

**O que fazer:**
- Analise quais componentes do score caíram
- Verifique se é uma mudança pontual ou tendência
- Considere revisar sua posição na ação`,

    priceReached: `## Entendendo Alertas de Preço

Alertas de preço ajudam a identificar quando uma ação atinge níveis específicos de interesse.

**Tipos de alerta:**
- **Preço atingido**: a cotação chegou ao valor que você definiu
- **Preço abaixo**: a cotação caiu abaixo do valor definido
- **Preço acima**: a cotação subiu acima do valor definido

**Lembre-se**: Preço sozinho não é suficiente. Sempre analise os fundamentos.`,

    bazinCeiling: `## Entendendo o preço-teto Bazin

O **método Bazin** estima um preço-teto a partir dos proventos: média anual de dividendos + JCP dos últimos 5 anos completos dividida pelo dividend yield desejado (6% no método original).

**Como interpretar:**
- **Preço abaixo do teto**: o rendimento histórico em proventos supera o DY-alvo
- **Preço acima do teto**: o rendimento histórico fica abaixo do DY-alvo

**Importante**: o cálculo olha para o passado. Verifique se o lucro e o payout sustentam os proventos.`,

    fairValueDiscount: `## Entendendo o desconto vs preço justo

O **desconto** compara o preço atual com o preço justo estimado por um modelo de valuation: desconto = 1 − preço ÷ preço justo.

**Como interpretar:**
- Quanto maior o desconto, maior a distância entre o preço e a estimativa do modelo
- Cada modelo usa premissas próprias (lucro, crescimento, dividendos, taxa de desconto)

**Importante**: preço justo é uma estimativa, não um valor garantido.`,

    dyTtmAbove: `## Entendendo o dividend yield de 12 meses

O **DY 12 meses** soma os proventos com data-com nos últimos 12 meses e divide pelo preço atual.

**O que observar:**
- Proventos extraordinários podem inflar o DY de um ano específico
- Compare com a média histórica e com o payout da empresa`,
  };

  return educationalContent[triggerType] || '';
}

/**
 * Gera relatório completo de gatilho customizado
 */
export async function generateCustomTriggerReport(
  params: CustomTriggerReportParams
): Promise<string> {
  const { ticker, companyName, triggerConfig, companyData, reasons } = params;

  // Gerar explicação do gatilho
  const explanation = await explainTrigger(triggerConfig, companyData, reasons);

  // Identificar tipos de gatilhos para conteúdo educativo
  const triggerTypes = Object.keys(triggerConfig) as Array<keyof TriggerConfig>;
  const educationalSections = triggerTypes
    .map(type => addEducationalContent(type))
    .filter(content => content.length > 0)
    .join('\n\n');

  // Preparar dados da empresa para o final do relatório
  const companyDataSection = Object.entries(companyData)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => {
      const labels: Record<string, string> = {
        pl: 'P/L',
        pvp: 'P/VP',
        score: 'Score geral',
        currentPrice: 'Preço atual',
        bazinCeiling: 'Preço-teto Bazin',
        fairValue: 'Preço justo do modelo',
        discount: 'Desconto vs preço justo',
        dyTtm: 'Dividend yield 12 meses',
      };
      const label = labels[key] || key;
      const money = new Set(['currentPrice', 'bazinCeiling', 'fairValue']);
      const percent = new Set(['discount', 'dyTtm']);
      const formattedValue = money.has(key)
        ? formatBRL(Number(value))
        : percent.has(key)
          ? formatPct(Number(value))
          : formatNumber(Number(value), { digits: 2 });
      return `- **${label}**: ${formattedValue}`;
    })
    .join('\n');

  // Compilar relatório
  const report = `# Relatório de Gatilho Customizado: ${companyName} (${ticker})

## Resumo

Um gatilho customizado foi disparado para ${ticker}. Abaixo estão os detalhes do que aconteceu e o que isso significa.

## Motivos do Disparo

${reasons.map((reason, index) => `${index + 1}. ${reason}`).join('\n')}

${explanation}

${educationalSections ? `\n${educationalSections}` : ''}

## Próximos Passos

1. **Analise os dados**: Revise os indicadores que dispararam o gatilho
2. **Contexto**: Considere o contexto de mercado e setor
3. **Decisão**: Use essas informações como parte de uma análise mais ampla
4. **Monitoramento**: Continue acompanhando a evolução dos indicadores

## Dados Atuais da Empresa

${companyDataSection}

---
*Relatório gerado automaticamente em ${new Date().toLocaleString('pt-BR')}*`;

  return report;
}

