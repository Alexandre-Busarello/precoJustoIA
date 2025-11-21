import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { requireAdminUser } from '@/lib/user-service';
import { PrismaClient } from '@prisma/client';
import { clearPostsCache } from '@/lib/blog-service';
import { revalidatePath } from 'next/cache';

const prisma = new PrismaClient();

/**
 * GET - Obtém post completo por ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const user = await requireAdminUser();
    if (!user) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await params;

    const post = await (prisma as any).blogPost.findUnique({
      where: { id },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post não encontrado' }, { status: 404 });
    }

    return NextResponse.json({ post });
  } catch (error: any) {
    console.error('Erro ao buscar post:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar post', message: error.message },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * PUT - Atualiza post completo
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const user = await requireAdminUser();
    if (!user) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await params;
    const data = await request.json();

    // Converter publishDate para Date se for string
    if (data.publishDate) {
      if (typeof data.publishDate === 'string') {
        // Se for apenas data (YYYY-MM-DD), converter para Date
        if (data.publishDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
          // Formato YYYY-MM-DD - criar Date em UTC para evitar problemas de timezone
          const [year, month, day] = data.publishDate.split('-').map(Number);
          data.publishDate = new Date(Date.UTC(year, month - 1, day));
        } else if (data.publishDate.includes('T')) {
          // Formato ISO completo
          data.publishDate = new Date(data.publishDate);
        } else {
          // Tentar parsear como está
          data.publishDate = new Date(data.publishDate);
        }
      }
    } else if (data.status === 'PUBLISHED') {
      // Se está publicando e não tem publishDate, usar data atual
      data.publishDate = new Date();
    }

    // Converter lastModified para Date se for string
    if (data.lastModified && typeof data.lastModified === 'string') {
      if (data.lastModified.match(/^\d{4}-\d{2}-\d{2}$/)) {
        // Formato YYYY-MM-DD - criar Date em UTC
        const [year, month, day] = data.lastModified.split('-').map(Number);
        data.lastModified = new Date(Date.UTC(year, month - 1, day));
      } else if (data.lastModified.includes('T')) {
        data.lastModified = new Date(data.lastModified);
      } else {
        data.lastModified = new Date(data.lastModified);
      }
    }

    const post = await (prisma as any).blogPost.update({
      where: { id },
      data,
    });

    // Limpar cache de posts
    clearPostsCache();

    // Revalidar sitemap se post foi publicado ou despublicado
    if (data.status === 'PUBLISHED' || (post.status === 'PUBLISHED' && data.status === 'DRAFT')) {
      revalidatePath('/sitemap-blog.xml');
      revalidatePath('/sitemap.xml');
    }

    return NextResponse.json({ post });
  } catch (error: any) {
    console.error('Erro ao atualizar post:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar post', message: error.message },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

