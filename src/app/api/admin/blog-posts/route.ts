import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { requireAdminUser } from '@/lib/user-service';
import { PrismaClient } from '@prisma/client';
import { clearPostsCache } from '@/lib/blog-service';

const prisma = new PrismaClient();

/**
 * GET - Lista posts com filtros
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const user = await requireAdminUser();
    if (!user) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    const where: any = {};

    if (status && status !== 'all') {
      where.status = status;
    }

    if (category && category !== 'all') {
      where.category = category;
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { excerpt: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const posts = await (prisma as any).blogPost.findMany({
      where,
      orderBy: [
        { createdAt: 'desc' },
      ],
      select: {
        id: true,
        slug: true,
        title: true,
        excerpt: true,
        category: true,
        readTime: true,
        publishDate: true,
        author: true,
        featured: true,
        tags: true,
        status: true,
        generatedBy: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Estatísticas
    const stats = {
      total: await (prisma as any).blogPost.count(),
      published: await (prisma as any).blogPost.count({ where: { status: 'PUBLISHED' } }),
      draft: await (prisma as any).blogPost.count({ where: { status: 'DRAFT' } }),
    };

    return NextResponse.json({
      posts,
      stats,
    });
  } catch (error: any) {
    console.error('Erro ao buscar posts:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar posts', message: error.message },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * PATCH - Atualiza status ou outros campos do post
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const user = await requireAdminUser();
    if (!user) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { id, ...data } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID do post é obrigatório' }, { status: 400 });
    }

    // Se está publicando, definir publishDate se não existir
    if (data.status === 'PUBLISHED' && !data.publishDate) {
      data.publishDate = new Date();
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

/**
 * DELETE - Remove post
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const user = await requireAdminUser();
    if (!user) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID do post é obrigatório' }, { status: 400 });
    }

    await (prisma as any).blogPost.delete({
      where: { id },
    });

    // Limpar cache
    clearPostsCache();

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Erro ao deletar post:', error);
    return NextResponse.json(
      { error: 'Erro ao deletar post', message: error.message },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

