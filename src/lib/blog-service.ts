import 'server-only'
import { PrismaClient } from '@prisma/client'
import { BlogPostStatus } from '@prisma/client'

const prisma = new PrismaClient()

// Interface para metadados do post (compatível com a interface anterior)
export interface BlogPostMetadata {
  id: number | string
  slug: string
  title: string
  excerpt: string
  category: string
  readTime: string
  publishDate: string
  author: string
  featured?: boolean
  tags: string[]
  seoTitle?: string
  seoDescription?: string
  image?: string
  imageAlt?: string
  canonicalUrl?: string
  lastModified?: string
}

// Interface completa do post (metadados + conteúdo)
export interface BlogPost extends BlogPostMetadata {
  content: string
}

// Cache simples em memória (para performance)
let postsCache: BlogPostMetadata[] | null = null
let cacheTimestamp: number = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutos

// Helper para converter do banco para a interface
function dbToBlogPostMetadata(dbPost: any): BlogPostMetadata {
  return {
    id: dbPost.id,
    slug: dbPost.slug,
    title: dbPost.title,
    excerpt: dbPost.excerpt,
    category: dbPost.category,
    readTime: dbPost.readTime,
    publishDate: dbPost.publishDate ? dbPost.publishDate.toISOString().split('T')[0] : '',
    author: dbPost.author,
    featured: dbPost.featured,
    tags: Array.isArray(dbPost.tags) ? dbPost.tags : [],
    seoTitle: dbPost.seoTitle || undefined,
    seoDescription: dbPost.seoDescription || undefined,
    image: dbPost.image || undefined,
    imageAlt: dbPost.imageAlt || undefined,
    canonicalUrl: dbPost.canonicalUrl || undefined,
    lastModified: dbPost.lastModified ? dbPost.lastModified.toISOString().split('T')[0] : undefined
  }
}

// Helper para converter do banco para BlogPost completo
function dbToBlogPost(dbPost: any): BlogPost {
  return {
    ...dbToBlogPostMetadata(dbPost),
    content: dbPost.content
  }
}

/**
 * Obtém todos os slugs dos posts disponíveis (apenas publicados)
 */
export async function getAllPostSlugs(): Promise<string[]> {
  try {
    const posts = await (prisma as any).blogPost.findMany({
      where: { status: 'PUBLISHED' },
      select: { slug: true }
    })
    return posts.map((p: any) => p.slug)
  } catch (error) {
    console.error('Erro ao buscar slugs de posts:', error)
    return []
  }
}

/**
 * Obtém metadados de um post pelo slug (sem o conteúdo completo)
 */
export async function getPostMetadata(slug: string): Promise<BlogPostMetadata | null> {
  try {
    const post = await (prisma as any).blogPost.findUnique({
      where: { slug },
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
        seoTitle: true,
        seoDescription: true,
        image: true,
        imageAlt: true,
        canonicalUrl: true,
        lastModified: true,
        status: true
      }
    })

    if (!post || post.status !== 'PUBLISHED') {
      return null
    }

    return dbToBlogPostMetadata(post)
  } catch (error) {
    console.error(`Erro ao buscar metadados do post ${slug}:`, error)
    return null
  }
}

/**
 * Obtém um post completo pelo slug (metadados + conteúdo)
 */
export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  try {
    const post = await (prisma as any).blogPost.findUnique({
      where: { slug }
    })

    if (!post || post.status !== 'PUBLISHED') {
      return null
    }

    return dbToBlogPost(post)
  } catch (error) {
    console.error(`Erro ao buscar post ${slug}:`, error)
    return null
  }
}

/**
 * Obtém todos os posts (apenas metadados) - com cache
 */
export async function getAllPosts(): Promise<BlogPostMetadata[]> {
  // Verificar cache
  const now = Date.now()
  if (postsCache && (now - cacheTimestamp) < CACHE_TTL) {
    return postsCache
  }

  try {
    const posts = await (prisma as any).blogPost.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: [
        { publishDate: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    const metadata = posts.map(dbToBlogPostMetadata)

    // Atualizar cache
    postsCache = metadata
    cacheTimestamp = now

    return metadata
  } catch (error) {
    console.error('Erro ao buscar todos os posts:', error)
    return []
  }
}

/**
 * Obtém posts por categoria
 */
export async function getPostsByCategory(category: string): Promise<BlogPostMetadata[]> {
  const allPosts = await getAllPosts()
  
  if (category === 'Todos') {
    return allPosts
  }
  
  return allPosts.filter(post => post.category === category)
}

/**
 * Busca posts por termo
 */
export async function searchPosts(searchTerm: string): Promise<BlogPostMetadata[]> {
  const allPosts = await getAllPosts()
  const term = searchTerm.toLowerCase()
  
  return allPosts.filter(post => 
    post.title.toLowerCase().includes(term) ||
    post.excerpt.toLowerCase().includes(term) ||
    post.tags.some(tag => tag.toLowerCase().includes(term)) ||
    post.category.toLowerCase().includes(term)
  )
}

/**
 * Obtém o post em destaque
 */
export async function getFeaturedPost(): Promise<BlogPostMetadata | null> {
  try {
    const post = await (prisma as any).blogPost.findFirst({
      where: {
        status: 'PUBLISHED',
        featured: true
      },
      orderBy: [
        { publishDate: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    return post ? dbToBlogPostMetadata(post) : null
  } catch (error) {
    console.error('Erro ao buscar post em destaque:', error)
    return null
  }
}

/**
 * Obtém posts relacionados (mesma categoria, excluindo o post atual)
 */
export async function getRelatedPosts(slug: string, limit: number = 3): Promise<BlogPostMetadata[]> {
  const currentPost = await getPostMetadata(slug)
  
  if (!currentPost) {
    return []
  }

  try {
    const posts = await (prisma as any).blogPost.findMany({
      where: {
        status: 'PUBLISHED',
        category: currentPost.category,
        slug: { not: slug }
      },
      take: limit,
      orderBy: [
        { publishDate: 'desc' },
        { createdAt: 'desc' }
      ]
    })

    return posts.map(dbToBlogPostMetadata)
  } catch (error) {
    console.error('Erro ao buscar posts relacionados:', error)
    return []
  }
}

/**
 * Obtém contadores de posts por categoria
 */
export async function getCategoryCounts(): Promise<{ name: string; count: number }[]> {
  const allPosts = await getAllPosts()
  
  const categories = new Map<string, number>()
  
  // Contar posts por categoria
  allPosts.forEach(post => {
    const count = categories.get(post.category) || 0
    categories.set(post.category, count + 1)
  })
  
  // Adicionar categoria "Todos"
  const result = [{ name: 'Todos', count: allPosts.length }]
  
  // Adicionar outras categorias ordenadas alfabeticamente
  const sortedCategories = Array.from(categories.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => ({ name, count }))
  
  return [...result, ...sortedCategories]
}

/**
 * Valida se um post existe (e está publicado)
 */
export async function postExists(slug: string): Promise<boolean> {
  try {
    const post = await (prisma as any).blogPost.findUnique({
      where: { slug },
      select: { status: true }
    })
    return post?.status === 'PUBLISHED'
  } catch {
    return false
  }
}

/**
 * Obtém estatísticas do blog
 */
export async function getBlogStats() {
  const allPosts = await getAllPosts()
  const categories = await getCategoryCounts()
  const featuredPost = await getFeaturedPost()
  
  return {
    totalPosts: allPosts.length,
    categories: categories.filter(c => c.name !== 'Todos').length,
    featuredPost,
    latestPosts: allPosts.slice(0, 5),
    lastUpdated: allPosts.length > 0 ? allPosts[0].publishDate : null
  }
}

/**
 * Limpa o cache de posts (útil após atualizações)
 */
export function clearPostsCache() {
  postsCache = null
  cacheTimestamp = 0
}

