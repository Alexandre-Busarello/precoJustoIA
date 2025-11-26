import { GoogleGenAI } from '@google/genai';
import { PrismaClient } from '@prisma/client';
import { slugify } from '@/lib/utils';

const prisma = new PrismaClient();

interface TrendingTopic {
  title: string;
  summary: string;
  angle: string;
  target_ticker: string[];
  seo_keywords: string[];
}

interface Source {
  name: string;
  url: string;
}

interface ResearchResult {
  sources: Source[];
  researchData: string; // Resumo dos dados encontrados
}

interface TopicSearchResult {
  market_context: string;
  category: string; // Categoria escolhida pela IA
  trending_topics: TrendingTopic[];
  sources: Source[];
}

interface GeneratedPost {
  title: string;
  excerpt: string;
  content: string;
  category: string;
  tags: string[];
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
}

// Links internos da aplicação para incluir nos posts
const INTERNAL_LINKS = {
  calculadora: '/calculadoras/dividend-yield',
  ranking: '/ranking',
  comparacao: '/comparacao',
  plBolsa: '/pl-bolsa',
  backtest: '/backtest',
  carteira: '/carteira',
  blog: '/blog',
  acao: '/acao/[ticker]'
};

// Categorias disponíveis
const CATEGORIES = [
  'Análise Setorial',
  'Renda Passiva',
  'Ferramentas',
  'Estratégias de Investimento',
  'Educação Financeira',
  'Mercado de Ações'
];

/**
 * Extrai JSON de uma string de resposta do Gemini
 * Lida com múltiplos formatos: markdown, texto puro, etc.
 */
function extractJSON<T>(response: string): T {
  let jsonString = response.trim();
  
  // Estratégia 1: Remover markdown code blocks
  jsonString = jsonString.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
  
  // Estratégia 2: Remover texto antes do primeiro {
  const firstBrace = jsonString.indexOf('{');
  if (firstBrace === -1) {
    console.error('Nenhum { encontrado na resposta');
    console.error('Resposta (primeiros 1000 chars):', response.substring(0, 1000));
    throw new Error('Resposta não contém JSON válido - nenhum { encontrado');
  }
  
  if (firstBrace > 0) {
    jsonString = jsonString.substring(firstBrace);
  }
  
  // Estratégia 3: Encontrar o JSON completo contando chaves
  let braceCount = 0;
  let endIdx = -1;
  
  for (let i = 0; i < jsonString.length; i++) {
    if (jsonString[i] === '{') {
      braceCount++;
    } else if (jsonString[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        endIdx = i;
        break;
      }
    }
  }
  
  if (endIdx === -1 || braceCount !== 0) {
    console.error('JSON malformado - chaves não balanceadas');
    console.error('Resposta (primeiros 2000 chars):', response.substring(0, 2000));
    throw new Error('Resposta não contém JSON válido - chaves não balanceadas');
  }
  
  jsonString = jsonString.substring(0, endIdx + 1);
  
  // Tentar fazer parse
  try {
    const parsed = JSON.parse(jsonString) as T;
    return parsed;
  } catch (parseError) {
    // Se falhou, tentar limpar mais
    // Remover possíveis caracteres invisíveis ou problemas de encoding
    jsonString = jsonString.replace(/[\u200B-\u200D\uFEFF]/g, ''); // Remove zero-width spaces
    jsonString = jsonString.replace(/\n\s*\n/g, '\n'); // Remove linhas vazias
    
    try {
      const parsed = JSON.parse(jsonString) as T;
      return parsed;
    } catch (secondParseError) {
      console.error('Erro ao fazer parse do JSON (tentativa 1):', parseError);
      console.error('Erro ao fazer parse do JSON (tentativa 2):', secondParseError);
      console.error('JSON extraído (primeiros 1500 chars):', jsonString.substring(0, 1500));
      console.error('JSON extraído (últimos 500 chars):', jsonString.substring(Math.max(0, jsonString.length - 500)));
      throw new Error(`Erro ao fazer parse do JSON: ${secondParseError instanceof Error ? secondParseError.message : 'Erro desconhecido'}`);
    }
  }
}

/**
 * Busca a última categoria publicada para evitar repetição
 */
async function getLastPublishedCategory(): Promise<string | null> {
  try {
    const lastPost = await (prisma as any).blogPost.findFirst({
      where: { status: 'PUBLISHED' },
      orderBy: { publishDate: 'desc' },
      select: { category: true },
    });
    return lastPost?.category || null;
  } catch (error) {
    console.warn('Erro ao buscar última categoria:', error);
    return null;
  }
}

/**
 * Busca tópicos recentes e quentes sobre investimentos/B3 usando Gemini
 */
export async function searchHotTopics(): Promise<TopicSearchResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada');
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  // Buscar última categoria publicada
  const lastCategory = await getLastPublishedCategory();
  const categoryHint = lastCategory 
    ? `\n\nIMPORTANTE - SELEÇÃO DE CATEGORIA:\nA última categoria publicada foi "${lastCategory}". PREFIRA escolher uma categoria DIFERENTE para diversificar o conteúdo. Se não houver alternativa adequada, pode usar a mesma, mas priorize diversidade.`
    : '\n\nIMPORTANTE - SELEÇÃO DE CATEGORIA:\nNão há posts publicados recentemente. Escolha a categoria mais adequada aos tópicos encontrados.';

  const prompt = `ATUE COMO: Sênior Market Analyst e Estrategista de SEO focado no mercado financeiro brasileiro (B3).

TAREFA:
Realize uma varredura profunda na internet (web browsing) para identificar as oportunidades de conteúdo mais quentes do momento. Seu objetivo é alimentar um blog de investimentos focado em Value Investing e Dividendos.

CRITÉRIOS DE BUSCA:

1. TÓPICOS QUENTES (Últimos 7-15 dias): Notícias que estão movendo o Ibovespa agora (ex: fusões, balanços trimestrais surpreendentes, mudanças regulatórias, decisões do COPOM/FED).

2. TENDÊNCIAS 2025: Relatórios recentes de grandes casas (BTG, XP, Itaú) sobre projeções setoriais e macroeconômicas.

3. DIVIDENDOS: Anúncios recentes de proventos (Data Com) ou empresas que se tornaram descontadas (valuation atrativo).

4. SETORES ESPECÍFICOS: Energia, Saneamento, Bancos, Frigoríficos e Commodities.

RESTRIÇÕES DE QUALIDADE:
- Ignore "day trade" ou criptomoedas. Foco total em Análise Fundamentalista e Buy & Hold.
- Os tópicos devem ser acionáveis (ex: "Por que a ação X caiu e abriu oportunidade" ao invés de "Ação X caiu").
- As palavras-chave devem ter intenção de busca informacional ou transacional.

CATEGORIAS VÁLIDAS (OBRIGATÓRIO usar EXATAMENTE uma delas):
- "Análise Setorial"
- "Educação"
- "Estratégias"
- "Ferramentas"
- "Renda Passiva"
${categoryHint}

FORMATO DE SAÍDA (CRÍTICO - LEIA COM ATENÇÃO):
Você DEVE retornar APENAS e EXCLUSIVAMENTE um objeto JSON válido. 

REGRAS ABSOLUTAS:
- NÃO use markdown code blocks (\`\`\`json ou \`\`\`)
- NÃO adicione explicações antes ou depois do JSON
- NÃO adicione texto introdutório ou conclusivo
- NÃO use aspas simples, apenas aspas duplas
- Comece diretamente com { e termine com }
- O JSON deve ser válido e parseável

A estrutura deve ser EXATAMENTE esta:

{
  "market_context": "Resumo de 1 frase sobre o sentimento atual do mercado (ex: Bullish com cautela fiscal)",
  "category": "Nome da categoria (DEVE ser EXATAMENTE uma das categorias válidas listadas acima)",
  "trending_topics": [
    {
      "title": "Título sugerido para o tópico (atraente)",
      "summary": "Resumo breve do fato relevante (o que aconteceu)",
      "angle": "O ângulo da análise (ex: Oportunidade de Compra, Alerta de Risco, Renda Passiva)",
      "target_ticker": ["TICKER1", "TICKER2"],
      "seo_keywords": ["keyword 1", "keyword 2", "long tail keyword"]
    }
  ],
  "sources": [
    {"name": "Nome da Fonte", "url": "URL direta"}
  ]
}

IMPORTANTE: Retorne pelo menos 3-5 trending_topics relevantes e bem estruturados.

INÍCIO DA RESPOSTA (comece aqui):`;

  const model = 'gemini-2.5-flash-lite';
  const tools = [{ googleSearch: {} }];

  const config = {
    thinkingConfig: {
      thinkingBudget: 0,
    },
    tools,
  };

  const contents = [
    {
      role: 'user',
      parts: [{ text: prompt }],
    },
  ];

  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContentStream({
        model,
        config,
        contents,
      });

      let fullResponse = '';
      for await (const chunk of response) {
        if (chunk.text) {
          fullResponse += chunk.text;
        }
      }

      // Log da resposta completa para debug (apenas na primeira tentativa)
      if (attempt === 0 && fullResponse.length > 0) {
        console.log('📥 Resposta do Gemini (primeiros 500 chars):', fullResponse.substring(0, 500));
      }

      // Extrair JSON da resposta usando função auxiliar
      const result = extractJSON<TopicSearchResult>(fullResponse);
      
      // Validar estrutura básica
      if (!result.market_context || !result.trending_topics || !Array.isArray(result.trending_topics)) {
        console.error('JSON inválido - estrutura incorreta:', result);
        throw new Error('Estrutura JSON inválida: faltam campos obrigatórios');
      }
      
      // Validar categoria
      const validCategories = [
        'Análise Setorial',
        'Educação',
        'Estratégias',
        'Ferramentas',
        'Renda Passiva'
      ];
      
      if (!result.category || !validCategories.includes(result.category)) {
        console.warn(`Categoria inválida ou ausente: "${result.category}". Usando padrão: "Análise Setorial"`);
        result.category = 'Análise Setorial';
      }
      
      // Validar que tem pelo menos um tópico
      if (result.trending_topics.length === 0) {
        console.warn('Nenhum tópico encontrado');
        throw new Error('Nenhum tópico encontrado na resposta');
      }
      
      console.log(`✅ JSON extraído com sucesso: ${result.trending_topics.length} tópicos encontrados`);
      console.log(`📂 Categoria selecionada: ${result.category}`);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`❌ Erro ao buscar tópicos (tentativa ${attempt + 1}/${maxRetries + 1}):`, lastError.message);
      
      if (attempt < maxRetries) {
        // Aguardar antes de tentar novamente
        await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
        console.log(`🔄 Tentando novamente...`);
      }
    }
  }

  // Se chegou aqui, todas as tentativas falharam
  throw lastError || new Error('Erro ao buscar tópicos após múltiplas tentativas');
}

/**
 * Obtém posts de exemplo do banco para usar como referência
 */
async function getExamplePosts(limit: number = 3): Promise<string[]> {
  const posts = await (prisma as any).blogPost.findMany({
    where: { status: 'PUBLISHED' },
    take: limit,
    orderBy: { createdAt: 'desc' },
    select: {
      title: true,
      excerpt: true,
      content: true,
      category: true,
      tags: true,
    },
  });

  return posts.map((post: any) => {
    const tags = Array.isArray(post.tags) ? post.tags.join(', ') : '';
    return `Título: ${post.title}
Categoria: ${post.category}
Tags: ${tags}
Resumo: ${post.excerpt}
Conteúdo (primeiros 500 caracteres): ${post.content.substring(0, 500)}...
---
`;
  });
}

/**
 * ETAPA 1: Pesquisa e coleta de fontes usando googleSearch
 * Esta função apenas faz a busca e retorna URLs reais encontradas
 */
export async function researchTopicSources(
  mainTopic: TrendingTopic
): Promise<ResearchResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada');
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const researchPrompt = `Você é um pesquisador especializado em mercado financeiro brasileiro.

TAREFA: Use a ferramenta googleSearch para pesquisar informações sobre o tópico abaixo e coletar URLs reais de fontes confiáveis.

TÓPICO PARA PESQUISAR:
Título: ${mainTopic.title}
Resumo: ${mainTopic.summary}
Tickers: ${mainTopic.target_ticker.join(', ')}

INSTRUÇÕES:
1. Use a ferramenta googleSearch para fazer pelo menos 4-5 buscas diferentes sobre este tópico
2. Busque por: "${mainTopic.title} novembro 2025"
3. Busque por: "${mainTopic.target_ticker.join(' ')} B3 dados proventos"
4. Busque por: "notícias ${mainTopic.title} mercado brasileiro"
5. Busque por informações sobre cada empresa mencionada

OBJETIVO:
- Coletar URLs REAIS de fontes confiáveis (B3, CVM, sites de notícias)
- Prefira fontes oficiais: B3, CVM, Banco Central, IBGE
- Prefira sites confiáveis: Valor Econômico, InfoMoney, Exame, Investing.com
- Mínimo 5 URLs, idealmente 8-10 URLs

FORMATO DE RESPOSTA:
Você DEVE retornar APENAS um objeto JSON válido (sem markdown, sem explicações):

{
  "sources": [
    {"name": "Nome da Fonte", "url": "https://url-completa.com.br"},
    {"name": "Nome da Fonte 2", "url": "https://url-completa-2.com.br"}
  ],
  "researchData": "Resumo breve dos dados encontrados nas pesquisas (2-3 parágrafos)"
}

REGRAS ABSOLUTAS:
- NÃO invente URLs - use APENAS URLs reais obtidas da busca
- URLs devem ser completas (começar com https://)
- Mínimo 5 URLs obrigatórias
- Retorne APENAS o JSON, sem markdown ou explicações

INÍCIO DA RESPOSTA (comece diretamente com {):`;

  const model = 'gemini-2.5-flash-lite';
  const tools = [{ googleSearch: {} }];

  const config = {
    thinkingConfig: {
      thinkingBudget: -1,
    },
    tools,
  };

  const contents = [
    {
      role: 'user',
      parts: [{ text: researchPrompt }],
    },
  ];

  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await ai.models.generateContentStream({
        model,
        config,
        contents,
      });

      let fullResponse = '';
      for await (const chunk of response) {
        if (chunk.text) {
          fullResponse += chunk.text;
        }
      }

      if (attempt === 0 && fullResponse.length > 0) {
        console.log('📥 Resposta da pesquisa (primeiros 500 chars):', fullResponse.substring(0, 500));
      }

      const result = extractJSON<ResearchResult>(fullResponse);

      // Validar que temos URLs suficientes
      if (!result.sources || result.sources.length < 3) {
        throw new Error(`Apenas ${result.sources?.length || 0} URLs encontradas. Mínimo obrigatório: 3`);
      }

      // Validar formato das URLs
      const invalidUrls = result.sources.filter(s => !s.url.startsWith('http://') && !s.url.startsWith('https://'));
      if (invalidUrls.length > 0) {
        throw new Error(`URLs inválidas encontradas: ${invalidUrls.map(s => s.url).join(', ')}`);
      }

      console.log(`✅ Pesquisa concluída: ${result.sources.length} fontes encontradas`);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`❌ Erro na pesquisa (tentativa ${attempt + 1}/${maxRetries + 1}):`, lastError.message);

      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
        console.log(`🔄 Tentando pesquisa novamente...`);
      }
    }
  }

  throw lastError || new Error('Erro ao pesquisar fontes após múltiplas tentativas');
}

/**
 * ETAPA 2: Gera um post completo usando IA baseado em tópicos encontrados e fontes coletadas
 */
export async function generateBlogPost(
  topics: TopicSearchResult,
  research: ResearchResult
): Promise<GeneratedPost> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada');
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  // Obter posts de exemplo
  const examplePosts = await getExamplePosts(3);

  // Usar categoria retornada pela IA na busca de tópicos
  const category = topics.category || 'Análise Setorial';

  // Coletar todas as palavras-chave dos tópicos
  const allKeywords = topics.trending_topics.flatMap(t => t.seo_keywords);
  const uniqueKeywords = [...new Set(allKeywords)];

  // Selecionar o tópico principal (primeiro da lista)
  const mainTopic = topics.trending_topics[0];

  // Preparar lista de fontes para o prompt
  const sourcesList = research.sources.map((source, idx) => 
    `${idx + 1}. ${source.name}: ${source.url}`
  ).join('\n');

  const prompt = `Aja como um Editor Sênior e Investidor Experiente de um blog de finanças popular no Brasil (estilo Suno Research, Nord Research ou Primo Rico).

Sua tarefa é escrever um artigo de blog otimizado para SEO e altamente engajador usando as fontes de pesquisa já coletadas.

═══════════════════════════════════════════════════════════════
📚 FONTES DE PESQUISA DISPONÍVEIS (USE ESTAS URLs):
═══════════════════════════════════════════════════════════════

${sourcesList}

DADOS DA PESQUISA:
${research.researchData}

⚠️⚠️⚠️ REGRA CRÍTICA PARA LINKS EXTERNOS ⚠️⚠️⚠️

Você DEVE incluir pelo menos 3-5 links externos no artigo usando as URLs acima.
- Use as URLs EXATAS da lista acima
- Formato markdown: [Texto descritivo](URL_COMPLETA)
- Inclua os links naturalmente no texto quando citar informações
- Exemplo: "Segundo dados da [B3](https://www.b3.com.br/...), a empresa..."

❌ NÃO invente URLs - use APENAS as URLs da lista acima!
❌ O artigo será REJEITADO se não tiver pelo menos 3 links externos das fontes acima!

═══════════════════════════════════════════════════════════════

CONTEXTO DE MERCADO ATUAL:
${topics.market_context}

TÓPICO PRINCIPAL PARA O ARTIGO:
Título: ${mainTopic.title}
Resumo: ${mainTopic.summary}
Ângulo de Análise: ${mainTopic.angle}
Tickers Relacionados: ${mainTopic.target_ticker.join(', ')}

OUTROS TÓPICOS QUENTES DO MOMENTO:
${topics.trending_topics.slice(1).map((t, i) => `
${i + 2}. ${t.title}
   Resumo: ${t.summary}
   Ângulo: ${t.angle}
   Tickers: ${t.target_ticker.join(', ')}
`).join('\n')}

PALAVRAS-CHAVE PARA OTIMIZAÇÃO SEO:
${uniqueKeywords.join(', ')}

CONTEXTO E TOM DE VOZ:

1. **Persona:** Você não é um robô e nem um acadêmico chato. Você é um investidor "calejado" que entende a dor do pequeno investidor. Você fala a língua do mercado financeiro, mas traduz para o português claro.

2. **Linguagem:** Use gírias de mercado com naturalidade (ex: "Faria Lima", "Sardinha", "Porto Seguro", "Vacas Leiteiras", "Pimentinha", "Perder o bonde"). Use analogias simples (futebol, carros, dia a dia) para explicar conceitos complexos.

3. **Emoção:** Seja opinativo. Não diga "o mercado subiu", diga "a euforia tomou conta". Use perguntas retóricas para puxar o leitor para a conversa. Demonstre ceticismo saudável ("cuidado com a dica quente").

4. **Formatação:** Use parágrafos curtos (3-4 linhas no máximo). Use negrito (**bold**) para destacar as frases de impacto, não apenas as palavras-chave.

ESTRUTURA DO ARTIGO:

1. **Título:** Deve ser magnético, prometendo um benefício ou resolvendo uma dor (ex: "Como ganhar dinheiro com...", "O Guia Definitivo..."). Inclua palavras-chave principais para SEO.

2. **Intro:** Comece com um gancho forte sobre o cenário atual (data atual: Novembro de 2025). Conecte-se com o sentimento do leitor (medo ou ganância). Use o contexto de mercado fornecido.

3. **Corpo:**
   - Divida em H2 e H3 claros.
   - Foque em Análise Fundamentalista (Lucro, Dívida, Caixa, Dividendos).
   - Sempre explique o "Porquê" por trás do movimento da ação/setor.
   - Use o ângulo de análise fornecido (${mainTopic.angle}).
   - Inclua avisos de risco (Disclaimer).
   - Mínimo de 2000 palavras.

4. **Call to Action (CTA):** Termine com uma pergunta para gerar comentários e sugira um próximo passo prático.

5. **Links:** Insira placeholders para links internos no formato Markdown [texto do link](/caminho-do-link).

EXEMPLOS DE POSTS EXISTENTES (use como referência de estilo e estrutura):
${examplePosts.join('\n')}

LINKS INTERNOS (OBRIGATÓRIO incluir pelo menos 3):
- Link para calculadora de dividend yield: [texto do link](${INTERNAL_LINKS.calculadora})
- Link para rankings de ações: [texto do link](${INTERNAL_LINKS.ranking})
- Link para comparação de empresas: [texto do link](${INTERNAL_LINKS.comparacao})
- Link para P/L histórico da Bolsa: [texto do link](${INTERNAL_LINKS.plBolsa})
- Link para backtesting de carteiras: [texto do link](${INTERNAL_LINKS.backtest})
- Link para carteira de investimentos: [texto do link](${INTERNAL_LINKS.carteira})
- Link para outros posts do blog: [texto do link](${INTERNAL_LINKS.blog})

REGRA CRÍTICA PARA TICKERS DE AÇÕES:
**SEMPRE que mencionar um ticker de ação no artigo, você DEVE criar um link interno para a página da ação.**

FORMATO OBRIGATÓRIO:
- Primeira menção: [Nome da Empresa (TICKER)](/acao/TICKER)
- Menções subsequentes: [TICKER](/acao/TICKER) ou [Nome da Empresa](/acao/TICKER)

EXEMPLOS:
- "A [Petrobras (PETR4)](/acao/PETR4) anunciou..."
- "A [Vale (VALE3)](/acao/VALE3) está negociando..."
- "Empresas como [Itaú (ITUB4)](/acao/ITUB4) e [Bradesco (BBDC4)](/acao/BBDC4)..."

TICKERS MENCIONADOS NO TÓPICO:
${mainTopic.target_ticker.map(ticker => `- ${ticker}`).join('\n')}

**IMPORTANTE:** 
- Use o ticker EXATO como aparece na lista acima (ex: VALE3, PETR4, ITUB4)
- SEMPRE inclua o link na primeira menção do ticker
- O formato do link é: /acao/TICKER (em maiúsculas, sem .SA ou sufixos)
- Se mencionar outros tickers além dos listados, também crie links para eles

🚨🚨🚨 LINKS EXTERNOS - REGRA CRÍTICA 🚨🚨🚨

**OBRIGATÓRIO: MÍNIMO 3 LINKS EXTERNOS REAIS NO CONTEÚDO**

⚠️⚠️⚠️ VOCÊ DEVE FAZER ISSO AGORA MESMO ⚠️⚠️⚠️

**PASSO 1 - USE A FERRAMENTA googleSearch (FAÇA ISSO PRIMEIRO!):**
Execute estas buscas usando a ferramenta googleSearch:
- Busque: "${mainTopic.title} novembro 2025"
- Busque: "${mainTopic.target_ticker.join(' ')} B3 dados proventos"
- Busque: "notícias ${mainTopic.title} mercado brasileiro investimentos"
- Busque: "análise ${mainTopic.target_ticker.join(' ')} dividendos"

**PASSO 2 - EXTRAIA URLs REAIS:**
- Copie URLs COMPLETAS dos resultados da busca
- Prefira fontes oficiais: B3, CVM, Banco Central, IBGE
- Prefira sites confiáveis: Valor Econômico, InfoMoney, Exame, Investing.com
- NÃO invente URLs - use APENAS URLs reais da busca

**PASSO 3 - INCLUA OS LINKS NO ARTIGO:**
- Formato markdown: [Texto descritivo](https://url-real-da-busca.com.br)
- Mínimo 3 links externos, idealmente 5 ou mais
- Inclua naturalmente no texto quando citar informações
- Exemplo: "Segundo dados da [B3](https://www.b3.com.br/...), a empresa..."

FORMATO CORRETO DE LINKS EM MARKDOWN:
- Formato inline: [Texto do link](https://exemplo.com.br)
- Formato de referência: [Texto do link][1] e depois [1]: https://exemplo.com.br
- SEMPRE use URLs completas (https://) e válidas obtidas da busca
- NÃO use placeholders, links fictícios ou "exemplo.com"
- NÃO escreva o artigo sem primeiro buscar informações reais

TIPOS DE FONTES OBRIGATÓRIAS:
1. **Fontes Oficiais:**
   - B3 (https://www.b3.com.br)
   - CVM (https://www.gov.br/cvm)
   - Banco Central (https://www.bcb.gov.br)
   - IBGE (https://www.ibge.gov.br)

2. **Notícias e Análises Confiáveis:**
   - Valor Econômico (https://valor.globo.com)
   - InfoMoney (https://www.infomoney.com.br)
   - Investing.com Brasil (https://br.investing.com)
   - Exame (https://exame.com)

3. **Dados Financeiros:**
   - Fundamentus (https://www.fundamentus.com.br)
   - Status Invest (https://statusinvest.com.br)
   - TradingView (https://br.tradingview.com)

4. **Relatórios e Dados das Empresas:**
   - RI (Relações com Investidores) das empresas mencionadas
   - Demonstrações financeiras oficiais

REGRAS CRÍTICAS PARA LINKS EXTERNOS:
- Use a ferramenta de busca do Gemini para encontrar URLs reais e atuais
- Inclua os links naturalmente no texto, não apenas em uma lista no final
- Cite as fontes quando usar dados específicos (ex: "Segundo dados da B3...")
- Verifique que as URLs estão completas e funcionais
- Prefira fontes brasileiras quando possível
- Links devem estar formatados corretamente em markdown: [texto](url)

OBJETIVO:
Transformar dados técnicos frios em uma leitura agradável, educativa e que passe autoridade, incentivando o leitor a ter cautela e foco no longo prazo.

FORMATO DE RESPOSTA (CRÍTICO):
Você DEVE retornar APENAS e EXCLUSIVAMENTE um objeto JSON válido.

REGRAS ABSOLUTAS:
- NÃO use markdown code blocks (\`\`\`json ou \`\`\`)
- NÃO adicione explicações antes ou depois do JSON
- NÃO adicione texto introdutório ou conclusivo
- NÃO use aspas simples, apenas aspas duplas
- Comece diretamente com { e termine com }
- O JSON deve ser válido e parseável

A estrutura deve ser EXATAMENTE esta:

{
  "title": "Título magnético otimizado para SEO",
  "excerpt": "Resumo cativante de 150-200 caracteres",
  "content": "Conteúdo completo em markdown com pelo menos 2000 palavras, incluindo links internos e externos, parágrafos curtos, negritos para impacto, e tom opinativo",
  "category": "${category}",
  "tags": ["tag1", "tag2", "tag3"],
  "seoTitle": "Título otimizado para SEO (60 caracteres)",
  "seoDescription": "Meta description otimizada (150-160 caracteres)",
  "keywords": ["palavra-chave 1", "palavra-chave 2"]
}

🚨🚨🚨 REQUISITOS CRÍTICOS DO CONTEÚDO 🚨🚨🚨

**LINKS EXTERNOS OBRIGATÓRIOS:**

✅ O ARTIGO DEVE TER:
- Mínimo 3 links externos REAIS usando as URLs da lista de fontes acima
- Formato markdown: [texto descritivo](URL_COMPLETA)
- Links incluídos naturalmente no texto quando citar informações
- Use as URLs EXATAS da lista de fontes fornecida acima

🚨 REGRAS ABSOLUTAS - O ARTIGO SERÁ REJEITADO SE:
- ❌ O artigo tiver MENOS de 3 links externos das fontes acima
- ❌ Você inventar URLs ou usar URLs que não estão na lista
- ❌ Os links não forem URLs reais da lista de fontes fornecida

📝 OUTROS REQUISITOS:
- Conteúdo original, útil e otimizado para SEO
- Tom de voz de investidor experiente e calejado
- Seja opinativo e use emoção para engajar
- Artigo completo em Markdown com formatação adequada
- Mínimo 2000 palavras

LINKS INTERNOS PARA TICKERS:
- **CRÍTICO:** SEMPRE que mencionar um ticker de ação, crie um link interno no formato: [Nome da Empresa (TICKER)](/acao/TICKER)
- Use o ticker exato em maiúsculas (ex: VALE3, PETR4, ITUB4) no link, sem sufixos como .SA

INÍCIO DA RESPOSTA (comece diretamente com {):`;

  const model = 'gemini-2.5-flash-lite';
  // Não precisamos mais de ferramentas de busca aqui, pois já temos as fontes
  const config = {
    thinkingConfig: {
      thinkingBudget: 0,
    },
  };

  const contents = [
    {
      role: 'user',
      parts: [{ text: prompt }],
    },
  ];

  const maxRetries = 2;
  let lastError: Error | null = null;
  let retryPrompt = prompt;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Nas retentativas, adicionar feedback sobre o erro anterior
      if (attempt > 0 && lastError) {
        const errorMessage = lastError.message.toLowerCase();
        
        if (errorMessage.includes('links externos')) {
          retryPrompt = `${prompt}

═══════════════════════════════════════════════════════════════
🚨🚨🚨 ERRO CRÍTICO DA TENTATIVA ANTERIOR 🚨🚨🚨
═══════════════════════════════════════════════════════════════

O artigo gerado foi REJEITADO porque NÃO continha links externos suficientes.

❌ ERRO ESPECÍFICO: ${lastError.message}

═══════════════════════════════════════════════════════════════
⚠️⚠️⚠️ AÇÃO OBRIGATÓRIA - USE AS FONTES ACIMA ⚠️⚠️⚠️
═══════════════════════════════════════════════════════════════

Você DEVE incluir pelo menos 3-5 links externos no artigo usando as URLs da lista de fontes fornecida acima.

FORMATO OBRIGATÓRIO DOS LINKS:
- Use markdown: [Texto descritivo](URL_COMPLETA)
- Use as URLs EXATAS da lista de fontes acima
- Inclua os links naturalmente no texto quando citar informações

EXEMPLOS DE COMO INCLUIR LINKS:
"Segundo dados da [B3](https://www.b3.com.br/...), a empresa..."
"Conforme reportado pelo [Valor Econômico](https://valor.globo.com/...), os investidores..."
"De acordo com informações da [CVM](https://www.gov.br/cvm/...), o setor..."

❌ NÃO INVENTE URLs - USE APENAS AS URLs DA LISTA DE FONTES ACIMA!
❌ O ARTIGO SERÁ REJEITADO NOVAMENTE SE NÃO TIVER PELO MENOS 3 LINKS EXTERNOS!

═══════════════════════════════════════════════════════════════`;
        } else {
          retryPrompt = `${prompt}

🚨 ERRO DA TENTATIVA ANTERIOR:
${lastError.message}

Por favor, corrija o problema acima e gere o artigo novamente seguindo TODAS as instruções.`;
        }
      }

      const contentsToUse = attempt > 0 
        ? [
            {
              role: 'user',
              parts: [{ text: retryPrompt }],
            },
          ]
        : contents;

      const response = await ai.models.generateContentStream({
        model,
        config,
        contents: contentsToUse,
      });

      let fullResponse = '';
      for await (const chunk of response) {
        if (chunk.text) {
          fullResponse += chunk.text;
        }
      }

      // Log da resposta completa para debug (apenas na primeira tentativa)
      if (attempt === 0 && fullResponse.length > 0) {
        console.log('📥 Resposta do Gemini (primeiros 500 chars):', fullResponse.substring(0, 500));
      }

      // Extrair JSON da resposta usando função auxiliar
      const result = extractJSON<GeneratedPost>(fullResponse);
      
      // Validar conteúdo gerado
      validateGeneratedPost(result);

      console.log(`✅ Post gerado com sucesso: "${result.title}"`);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`❌ Erro ao gerar post (tentativa ${attempt + 1}/${maxRetries + 1}):`, lastError.message);
      
      if (attempt < maxRetries) {
        // Aguardar antes de tentar novamente
        await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
        console.log(`🔄 Tentando gerar post novamente...`);
      }
    }
  }

  // Se chegou aqui, todas as tentativas falharam
  throw lastError || new Error('Erro ao gerar post após múltiplas tentativas');
}

/**
 * Valida o post gerado
 */
function validateGeneratedPost(post: GeneratedPost): void {
  if (!post.title || post.title.length < 20) {
    throw new Error('Título muito curto ou vazio');
  }

  if (!post.content || post.content.length < 2000) {
    throw new Error('Conteúdo muito curto (mínimo 2000 caracteres)');
  }

  if (!post.excerpt || post.excerpt.length < 100) {
    throw new Error('Excerpt muito curto');
  }

  if (!post.tags || post.tags.length < 3) {
    throw new Error('Poucas tags (mínimo 3)');
  }

  // Verificar se tem links internos
  const hasInternalLinks = 
    post.content.includes(INTERNAL_LINKS.calculadora) ||
    post.content.includes(INTERNAL_LINKS.ranking) ||
    post.content.includes(INTERNAL_LINKS.comparacao);

  if (!hasInternalLinks) {
    throw new Error('Conteúdo deve incluir links internos');
  }

  // Verificar se tem links externos formatados corretamente em markdown
  // Padrão: [texto](https://url) ou [texto][ref] seguido de [ref]: https://url
  const markdownLinkPattern = /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g;
  const referenceLinkPattern = /\[([^\]]+)\]\[(\d+)\]/g;
  const referenceDefinitionPattern = /\[(\d+)\]:\s*(https?:\/\/[^\s]+)/g;
  
  const inlineLinks = Array.from(post.content.matchAll(markdownLinkPattern));
  const referenceLinks = Array.from(post.content.matchAll(referenceLinkPattern));
  const referenceDefinitions = Array.from(post.content.matchAll(referenceDefinitionPattern));
  
  // Contar links externos (excluir links internos que começam com /)
  const externalLinks = inlineLinks.filter(match => {
    const url = match[2];
    return url.startsWith('http://') || url.startsWith('https://');
  });
  
  const totalExternalLinks = externalLinks.length + referenceDefinitions.length;
  
  if (totalExternalLinks < 3) {
    const errorMsg = `Artigo tem apenas ${totalExternalLinks} links externos. Mínimo obrigatório: 3. O artigo DEVE incluir links externos para fontes confiáveis obtidas através da busca do Gemini.`;
    console.error(`❌ ${errorMsg}`);
    throw new Error(errorMsg);
  }
  
  // Validar formato dos links
  const invalidLinks: string[] = [];
  inlineLinks.forEach(match => {
    const url = match[2];
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      invalidLinks.push(`Link inválido: ${url}`);
    }
  });
  
  if (invalidLinks.length > 0) {
    console.warn('⚠️ Links com formato inválido encontrados:', invalidLinks);
  }
  
  // Log para debug
  console.log(`📊 Validação de links: ${totalExternalLinks} links externos encontrados`);
  if (totalExternalLinks > 0) {
    console.log(`   Exemplos: ${externalLinks.slice(0, 3).map(m => m[2]).join(', ')}`);
  }

  // Verificar se tickers mencionados têm links internos
  // Padrão para detectar tickers: 4 letras maiúsculas seguidas de 1-2 dígitos (ex: PETR4, VALE3, ITUB4)
  const tickerPattern = /\b([A-Z]{4}\d{1,2})\b/g;
  const tickerLinksPattern = /\[([^\]]*\(([A-Z]{4}\d{1,2})\)[^\]]*)\]\(\/acao\/\2\)/g;
  
  const mentionedTickers = Array.from(post.content.matchAll(tickerPattern))
    .map(match => match[1])
    .filter((ticker, index, self) => self.indexOf(ticker) === index); // Remover duplicatas
  
  const linkedTickers = Array.from(post.content.matchAll(tickerLinksPattern))
    .map(match => match[2])
    .filter((ticker, index, self) => self.indexOf(ticker) === index); // Remover duplicatas
  
  const unlinkedTickers = mentionedTickers.filter(ticker => !linkedTickers.includes(ticker));
  
  if (unlinkedTickers.length > 0) {
    console.warn(`⚠️ Tickers mencionados sem link interno: ${unlinkedTickers.join(', ')}`);
    console.warn(`   Formato esperado: [Nome da Empresa (TICKER)](/acao/TICKER)`);
  } else if (mentionedTickers.length > 0) {
    console.log(`✅ Todos os ${mentionedTickers.length} tickers mencionados têm links internos`);
  }
}

/**
 * Calcula tempo de leitura estimado
 */
export function calculateReadTime(content: string): string {
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).length;
  const minutes = Math.ceil(wordCount / wordsPerMinute);
  return `${minutes} min`;
}

/**
 * Gera slug único baseado no título
 */
export async function generateUniqueSlug(title: string): Promise<string> {
  const baseSlug = slugify(title);
  let slug = baseSlug;
  let counter = 1;

  while (true) {
    const existing = await (prisma as any).blogPost.findUnique({
      where: { slug },
    });

    if (!existing) {
      return slug;
    }

    slug = `${baseSlug}-${counter}`;
    counter++;
  }
}

/**
 * Função principal: busca tópicos, pesquisa fontes e gera post completo
 */
export async function generateDailyPost(): Promise<{
  post: GeneratedPost;
  topics: TopicSearchResult;
  research: ResearchResult;
  slug: string;
}> {
  console.log('🔍 Buscando tópicos quentes...');
  const topics = await searchHotTopics();
  console.log(`✅ Encontrados ${topics.trending_topics.length} tópicos quentes`);
  console.log(`📊 Contexto de mercado: ${topics.market_context}`);

  // Selecionar o tópico principal
  const mainTopic = topics.trending_topics[0];
  console.log(`📌 Tópico principal selecionado: "${mainTopic.title}"`);

  // ETAPA 1: Pesquisar e coletar fontes
  console.log('🔎 Pesquisando fontes e coletando URLs...');
  const research = await researchTopicSources(mainTopic);
  console.log(`✅ Pesquisa concluída: ${research.sources.length} fontes coletadas`);

  // ETAPA 2: Gerar post usando as fontes coletadas
  console.log('✍️ Gerando post com IA usando as fontes coletadas...');
  const post = await generateBlogPost(topics, research);
  console.log(`✅ Post gerado: "${post.title}"`);

  console.log('🔗 Gerando slug único...');
  const slug = await generateUniqueSlug(post.title);
  console.log(`✅ Slug gerado: ${slug}`);

  console.log(`⏱️ Tempo de leitura será calculado ao salvar`);

  return {
    post,
    topics,
    research,
    slug,
  };
}

