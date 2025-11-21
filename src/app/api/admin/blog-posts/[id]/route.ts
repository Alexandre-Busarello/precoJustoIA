import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { requireAdminUser } from '@/lib/user-service';
import { PrismaClient } from '@prisma/client';
import { clearPostsCache } from '@/lib/blog-service';

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

    // Se está publicando, definir publishDate se não existir
    if (data.status === 'PUBLISHED' && !data.publishDate) {
      data.publishDate = new Date();
    }

    // Converter publishDate e lastModified para Date se fornecidos como string
    if (data.publishDate && typeof data.publishDate === 'string') {
      data.publishDate = new Date(data.publishDate);
    }
    if (data.lastModified && typeof data.lastModified === 'string') {
      data.lastModified = new Date(data.lastModified);
    }

    const post = await (prisma as any).blogPost.update({
      where: { id },
      data,
    });

    // Limpar cache
    clearPostsCache();

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

