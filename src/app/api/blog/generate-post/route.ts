import { NextRequest, NextResponse } from 'next/server';
import { generateDailyPost, calculateReadTime } from '@/lib/blog-generation-service';
import { PrismaClient } from '@prisma/client';
import { clearPostsCache } from '@/lib/blog-service';

const prisma = new PrismaClient();

/**
 * Endpoint para geração automática de posts via cron
 * Protegido por API key
 */
export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação via API key
    const authHeader = request.headers.get('authorization');
    const apiKey = process.env.BLOG_GENERATION_API_KEY;

    if (!apiKey) {
      console.error('❌ BLOG_GENERATION_API_KEY não configurada');
      return NextResponse.json(
        { error: 'API key não configurada no servidor' },
        { status: 500 }
      );
    }

    if (!authHeader || authHeader !== `Bearer ${apiKey}`) {
      console.warn('⚠️ Tentativa de acesso não autorizado ao endpoint de geração de posts');
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      );
    }

    console.log('🚀 Iniciando geração de post diário...');

    // Gerar post
    const { post, topics, slug } = await generateDailyPost();

    // Calcular tempo de leitura
    const readTime = calculateReadTime(post.content);

    // Salvar no banco como DRAFT
    const blogPost = await (prisma as any).blogPost.create({
      data: {
        slug,
        title: post.title,
        excerpt: post.excerpt,
        category: post.category,
        readTime,
        author: 'Equipe Preço Justo AI',
        featured: false,
        seoTitle: post.seoTitle,
        seoDescription: post.seoDescription,
        content: post.content,
        status: 'DRAFT',
        tags: post.tags,
        generatedBy: 'AI',
        generationPrompt: `Tópicos: ${topics.topics.join(', ')}\nKeywords: ${post.keywords.join(', ')}`,
        sourceTopics: {
          topics: topics.topics,
          keywords: topics.keywords,
          sources: topics.sources,
        },
      },
    });

    // Limpar cache de posts
    clearPostsCache();

    console.log(`✅ Post gerado e salvo como DRAFT: ${blogPost.id} (${slug})`);

    return NextResponse.json({
      success: true,
      post: {
        id: blogPost.id,
        slug: blogPost.slug,
        title: blogPost.title,
        status: blogPost.status,
      },
      topics: topics.topics,
      keywords: post.keywords,
    });

  } catch (error: any) {
    console.error('❌ Erro ao gerar post:', error);
    
    return NextResponse.json(
      {
        error: 'Erro ao gerar post',
        message: error.message,
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * GET para verificar status do endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Endpoint de geração de posts ativo',
    endpoint: '/api/blog/generate-post',
    method: 'POST',
    auth: 'Bearer token via header Authorization',
  });
}

