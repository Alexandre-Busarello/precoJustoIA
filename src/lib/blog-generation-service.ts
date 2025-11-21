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

interface TopicSearchResult {
  market_context: string;
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
  analise: '/analise',
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
 * Busca tópicos recentes e quentes sobre investimentos/B3 usando Gemini
 */
export async function searchHotTopics(): Promise<TopicSearchResult> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada');
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

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

FORMATO DE SAÍDA (IMPORTANTE):
Você deve retornar APENAS um objeto JSON válido, minificado ou formatado, sem blocos de código markdown (\`\`\`json), sem introdução e sem conclusão. A estrutura deve ser EXATAMENTE esta:

{
  "market_context": "Resumo de 1 frase sobre o sentimento atual do mercado (ex: Bullish com cautela fiscal)",
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

IMPORTANTE: Retorne pelo menos 3-5 trending_topics relevantes e bem estruturados.`;

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

    // Extrair JSON da resposta
    const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Resposta não contém JSON válido');
    }

    const result = JSON.parse(jsonMatch[0]) as TopicSearchResult;
    return result;
  } catch (error) {
    console.error('Erro ao buscar tópicos:', error);
    throw error;
  }
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
 * Gera um post completo usando IA baseado em tópicos encontrados
 */
export async function generateBlogPost(
  topics: TopicSearchResult
): Promise<GeneratedPost> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurada');
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  // Obter posts de exemplo
  const examplePosts = await getExamplePosts(3);

  // Escolher categoria baseada nos tópicos
  const allTopicTexts = topics.trending_topics.map(t => `${t.title} ${t.summary} ${t.angle}`).join(' ');
  const category = selectCategory(allTopicTexts);

  // Coletar todas as palavras-chave dos tópicos
  const allKeywords = topics.trending_topics.flatMap(t => t.seo_keywords);
  const uniqueKeywords = [...new Set(allKeywords)];

  // Selecionar o tópico principal (primeiro da lista)
  const mainTopic = topics.trending_topics[0];

  const prompt = `Aja como um Editor Sênior e Investidor Experiente de um blog de finanças popular no Brasil (estilo Suno Research, Nord Research ou Primo Rico).

Sua tarefa é escrever um artigo de blog otimizado para SEO e altamente engajador.

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
- Link para análise de ações: [texto do link](${INTERNAL_LINKS.analise})
- Link para outros posts do blog: [texto do link](${INTERNAL_LINKS.blog})
- Link para análises individuais dos ativos: [texto do link](${INTERNAL_LINKS.acao.replace('[ticker]', 'PETR4')}) (substitua PETR4 pelo ticker relevante)

LINKS EXTERNOS (OBRIGATÓRIO incluir pelo menos 2):
- Links para fontes confiáveis sobre o assunto
- Links para notícias relevantes da B3
- Links para dados oficiais quando apropriado

OBJETIVO:
Transformar dados técnicos frios em uma leitura agradável, educativa e que passe autoridade, incentivando o leitor a ter cautela e foco no longo prazo.

Retorne APENAS um JSON válido (sem markdown, sem explicações) com esta estrutura:
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

IMPORTANTE: 
- O conteúdo deve ser original, útil e otimizado para busca orgânica.
- Use o tom de voz de um investidor experiente e calejado, não um acadêmico.
- Seja opinativo e use emoção para engajar o leitor.
- Escreva o artigo completo em Markdown com formatação adequada.`;

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

    // Extrair JSON da resposta
    const jsonMatch = fullResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Resposta não contém JSON válido');
    }

    const result = JSON.parse(jsonMatch[0]) as GeneratedPost;
    
    // Validar conteúdo gerado
    validateGeneratedPost(result);

    return result;
  } catch (error) {
    console.error('Erro ao gerar post:', error);
    throw error;
  }
}

/**
 * Seleciona categoria baseada nos tópicos
 */
function selectCategory(topicText: string): string {
  const text = topicText.toLowerCase();

  if (text.includes('dividendo') || text.includes('renda passiva') || text.includes('renda passiva')) {
    return 'Renda Passiva';
  }
  if (text.includes('calculadora') || text.includes('ferramenta')) {
    return 'Ferramentas';
  }
  if (text.includes('setor') || text.includes('setorial')) {
    return 'Análise Setorial';
  }
  if (text.includes('estratégia') || text.includes('método')) {
    return 'Estratégias de Investimento';
  }
  if (text.includes('iniciante') || text.includes('como')) {
    return 'Educação Financeira';
  }

  return 'Mercado de Ações';
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
 * Função principal: busca tópicos e gera post completo
 */
export async function generateDailyPost(): Promise<{
  post: GeneratedPost;
  topics: TopicSearchResult;
  slug: string;
}> {
  console.log('🔍 Buscando tópicos quentes...');
  const topics = await searchHotTopics();
  console.log(`✅ Encontrados ${topics.trending_topics.length} tópicos quentes`);
  console.log(`📊 Contexto de mercado: ${topics.market_context}`);

  console.log('✍️ Gerando post com IA...');
  const post = await generateBlogPost(topics);
  console.log(`✅ Post gerado: "${post.title}"`);

  console.log('🔗 Gerando slug único...');
  const slug = await generateUniqueSlug(post.title);
  console.log(`✅ Slug gerado: ${slug}`);

  console.log(`⏱️ Tempo de leitura será calculado ao salvar`);

  return {
    post,
    topics,
    slug,
  };
}

