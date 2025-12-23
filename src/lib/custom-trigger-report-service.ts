/**
 * CUSTOM TRIGGER REPORT SERVICE
 * 
 * Serviço para gerar relatórios de gatilhos customizados
 */

import { GoogleGenAI } from '@google/genai';
import { TriggerConfig } from './custom-trigger-service';

export interface CustomTriggerReportParams {
  ticker: string;
  companyName: string;
  triggerConfig: TriggerConfig;
  companyData: {
    pl?: number;
    pvp?: number;
    score?: number;
    currentPrice?: number;
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
    const model = 'gemini-2.5-flash-lite';
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
    explanation += 'Um P/L baixo pode indicar que a ação está barata em relação aos lucros.\n\n';
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
    explanation += '**Preço da Ação**: O preço atual atingiu um nível configurado no gatilho. ';
    explanation += 'Isso pode indicar oportunidades de entrada ou saída, dependendo da estratégia.\n\n';
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
- **P/L baixo (< 10)**: Pode indicar que a ação está barata em relação aos lucros
- **P/L médio (10-20)**: Considerado normal para muitas empresas
- **P/L alto (> 20)**: Pode indicar expectativas de crescimento ou supervalorização

**Importante**: O P/L deve ser analisado em conjunto com outros indicadores e comparado com empresas do mesmo setor.`,

    maxPl: `## Entendendo o P/L Máximo

Quando o P/L está acima de um valor máximo configurado, pode indicar que a ação está cara em relação aos lucros atuais.

**O que observar:**
- Verifique se há expectativas de crescimento que justifiquem o P/L elevado
- Compare com o histórico da empresa e com concorrentes
- Analise se os lucros são sustentáveis ou pontuais`,

    minPvp: `## Entendendo o P/VP Mínimo

O **P/VP (Preço sobre Valor Patrimonial)** compara o preço da ação com o valor patrimonial por ação.

**Como interpretar:**
- **P/VP < 1**: Ação negociando abaixo do valor contábil (pode ser oportunidade)
- **P/VP = 1**: Preço igual ao valor patrimonial
- **P/VP > 1**: Ação negociando acima do valor contábil

**Importante**: Empresas com muitos ativos intangíveis podem ter P/VP naturalmente mais alto.`,

    maxPvp: `## Entendendo o P/VP Máximo

Um P/VP acima do máximo configurado pode indicar que a ação está cara em relação ao patrimônio líquido.

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

**Estratégias comuns:**
- **Preço atingido**: Pode indicar oportunidade de entrada ou saída
- **Preço abaixo**: Pode sinalizar compra em níveis de suporte
- **Preço acima**: Pode indicar realização de lucros ou alerta de supervalorização

**Lembre-se**: Preço sozinho não é suficiente. Sempre analise os fundamentos.`,
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

  // Compilar relatório
  const report = `# Relatório de Gatilho Customizado: ${companyName} (${ticker})

## Resumo

Um gatilho customizado foi disparado para ${ticker}. Abaixo estão os detalhes do que aconteceu e o que isso significa.

## Dados Atuais da Empresa

${Object.entries(companyData)
  .filter(([_, value]) => value !== undefined)
  .map(([key, value]) => {
    const labels: Record<string, string> = {
      pl: 'P/L',
      pvp: 'P/VP',
      score: 'Score Geral',
      currentPrice: 'Preço Atual',
    };
    const label = labels[key] || key;
    const formattedValue = key === 'currentPrice' 
      ? `R$ ${Number(value).toFixed(2)}`
      : Number(value).toFixed(2);
    return `- **${label}**: ${formattedValue}`;
  })
  .join('\n')}

## Motivos do Disparo

${reasons.map((reason, index) => `${index + 1}. ${reason}`).join('\n')}

${explanation}

${educationalSections ? `\n${educationalSections}` : ''}

## Próximos Passos

1. **Analise os dados**: Revise os indicadores que dispararam o gatilho
2. **Contexto**: Considere o contexto de mercado e setor
3. **Decisão**: Use essas informações como parte de uma análise mais ampla
4. **Monitoramento**: Continue acompanhando a evolução dos indicadores

---
*Relatório gerado automaticamente em ${new Date().toLocaleString('pt-BR')}*`;

  return report;
}

