import { GoogleGenAI } from '@google/genai';
import { PrismaClient } from '@prisma/client';
import { slugify } from '@/lib/utils';

const prisma = new PrismaClient();

interface TopicSearchResult {
  topics: string[];
  keywords: string[];
  sources: string[];
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

  const prompt = `Você é um especialista em análise de mercado financeiro brasileiro e SEO.

Busque na internet os tópicos mais quentes e recentes sobre:
- Investimentos na B3 (Bolsa de Valores brasileira)
- Análise fundamentalista de ações
- Dividendos e renda passiva
- Mercado de ações brasileiro
- Empresas listadas na B3
- Tendências de investimento em 2025

IMPORTANTE:
- Foque em tópicos que sejam relevantes para investidores brasileiros
- Priorize assuntos que estão em alta nas últimas semanas
- Inclua notícias sobre empresas específicas, setores em alta, e tendências de mercado

Retorne APENAS um JSON válido (sem markdown, sem explicações) com esta estrutura:
{
  "topics": ["tópico 1", "tópico 2", "tópico 3"],
  "keywords": ["palavra-chave 1", "palavra-chave 2", "palavra-chave 3"],
  "sources": ["fonte 1", "fonte 2"]
}

Os tópicos devem ser específicos e acionáveis (ex: "Ibovespa bate recorde histórico", "Setor de energia elétrica em alta", "Melhores ações para dividendos em 2025").
As palavras-chave devem ser otimizadas para SEO e busca orgânica.
As fontes devem ser URLs ou nomes de fontes confiáveis.`;

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
  const category = selectCategory(topics.topics);

  const prompt = `Você é um redator especializado em conteúdo sobre investimentos na B3 e análise fundamentalista.

TAREFA: Criar um artigo completo e otimizado para SEO sobre os tópicos quentes encontrados.

TÓPICOS QUENTES ENCONTRADOS:
${topics.topics.map((t, i) => `${i + 1}. ${t}`).join('\n')}

PALAVRAS-CHAVE PARA OTIMIZAÇÃO SEO:
${topics.keywords.join(', ')}

EXEMPLOS DE POSTS EXISTENTES (use como referência de estilo e estrutura):
${examplePosts.join('\n')}

REQUISITOS OBRIGATÓRIOS:

1. ESTRUTURA DO ARTIGO:
- Título otimizado para SEO (inclua palavras-chave principais)
- Resumo/excerpt cativante (150-200 caracteres)
- Introdução envolvente
- Seções bem organizadas com subtítulos H2 e H3
- Conclusão com call-to-action
- Mínimo de 2000 palavras

2. LINKS INTERNOS (OBRIGATÓRIO incluir pelo menos 3):
- Link para calculadora de dividend yield: ${INTERNAL_LINKS.calculadora}
- Link para rankings de ações: ${INTERNAL_LINKS.ranking}
- Link para comparação de empresas: ${INTERNAL_LINKS.comparacao}
- Link para análise de ações: ${INTERNAL_LINKS.analise}
- Link para outros posts do blog: ${INTERNAL_LINKS.blog}
- Link para analises individuais dos ativos: ${INTERNAL_LINKS.acao} ([ticker] = ao ticker da açao que se quer linkar)

3. LINKS EXTERNOS (OBRIGATÓRIO incluir pelo menos 2):
- Links para fontes confiáveis sobre o assunto
- Links para notícias relevantes da B3
- Links para dados oficiais quando apropriado

4. OTIMIZAÇÃO SEO:
- Use as palavras-chave naturalmente ao longo do texto
- Título deve conter a palavra-chave principal
- Subtítulos devem incluir variações das palavras-chave
- Meta description otimizada (150-160 caracteres)

5. ESTILO E TOM:
- Linguagem acessível mas profissional
- Exemplos práticos e casos reais
- Dados e números quando possível
- Formatação markdown correta

6. TAGS:
- Gere 5-8 tags relevantes baseadas no conteúdo e palavras-chave

Retorne APENAS um JSON válido (sem markdown, sem explicações) com esta estrutura:
{
  "title": "Título otimizado para SEO",
  "excerpt": "Resumo cativante de 150-200 caracteres",
  "content": "Conteúdo completo em markdown com pelo menos 2000 palavras, incluindo links internos e externos",
  "category": "${category}",
  "tags": ["tag1", "tag2", "tag3"],
  "seoTitle": "Título otimizado para SEO (60 caracteres)",
  "seoDescription": "Meta description otimizada (150-160 caracteres)",
  "keywords": ["palavra-chave 1", "palavra-chave 2"]
}

IMPORTANTE: O conteúdo deve ser original, útil e otimizado para busca orgânica.`;

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
function selectCategory(topics: string[]): string {
  const topicText = topics.join(' ').toLowerCase();

  if (topicText.includes('dividendo') || topicText.includes('renda passiva')) {
    return 'Renda Passiva';
  }
  if (topicText.includes('calculadora') || topicText.includes('ferramenta')) {
    return 'Ferramentas';
  }
  if (topicText.includes('setor') || topicText.includes('setorial')) {
    return 'Análise Setorial';
  }
  if (topicText.includes('estratégia') || topicText.includes('método')) {
    return 'Estratégias de Investimento';
  }
  if (topicText.includes('iniciante') || topicText.includes('como')) {
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
  console.log(`✅ Encontrados ${topics.topics.length} tópicos`);

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

