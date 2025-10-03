import 'server-only'
import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'

// Interface para metadados do post
export interface BlogPostMetadata {
  id: number
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

// Caminho para o diretório de posts
const postsDirectory = path.join(process.cwd(), 'blog', 'data', 'posts')

/**
 * Obtém todos os slugs dos posts disponíveis
 */
export function getAllPostSlugs(): string[] {
  try {
    const fileNames = fs.readdirSync(postsDirectory)
    return fileNames
      .filter(fileName => {
        // Filtrar apenas arquivos .md e ignorar README e outros arquivos especiais
        return fileName.endsWith('.md') && 
               !fileName.startsWith('README') && 
               !fileName.startsWith('.')
      })
      .map(fileName => fileName.replace(/\.md$/, ''))
  } catch (error) {
    console.error('Erro ao ler diretório de posts:', error)
    return []
  }
}

/**
 * Obtém metadados de um post pelo slug (sem o conteúdo completo)
 */
export function getPostMetadata(slug: string): BlogPostMetadata | null {
  try {
    const fullPath = path.join(postsDirectory, `${slug}.md`)
    
    if (!fs.existsSync(fullPath)) {
      return null
    }

    const fileContents = fs.readFileSync(fullPath, 'utf8')
    const { data } = matter(fileContents)

    return {
      slug,
      ...data
    } as BlogPostMetadata
  } catch (error) {
    console.error(`Erro ao ler metadados do post ${slug}:`, error)
    return null
  }
}

/**
 * Obtém um post completo pelo slug (metadados + conteúdo)
 */
export function getPostBySlug(slug: string): BlogPost | null {
  try {
    const fullPath = path.join(postsDirectory, `${slug}.md`)
    
    if (!fs.existsSync(fullPath)) {
      return null
    }

    const fileContents = fs.readFileSync(fullPath, 'utf8')
    const { data, content } = matter(fileContents)

    return {
      slug,
      content,
      ...data
    } as BlogPost
  } catch (error) {
    console.error(`Erro ao ler post ${slug}:`, error)
    return null
  }
}

/**
 * Obtém todos os posts (apenas metadados)
 */
export function getAllPosts(): BlogPostMetadata[] {
  const slugs = getAllPostSlugs()
  const posts = slugs
    .map(slug => getPostMetadata(slug))
    .filter((post): post is BlogPostMetadata => post !== null)
    .sort((a, b) => {
      // Ordenar por data de publicação (mais recente primeiro)
      return new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
    })

  return posts
}

/**
 * Obtém posts por categoria
 */
export function getPostsByCategory(category: string): BlogPostMetadata[] {
  const allPosts = getAllPosts()
  
  if (category === 'Todos') {
    return allPosts
  }
  
  return allPosts.filter(post => post.category === category)
}

/**
 * Busca posts por termo
 */
export function searchPosts(searchTerm: string): BlogPostMetadata[] {
  const allPosts = getAllPosts()
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
export function getFeaturedPost(): BlogPostMetadata | null {
  const allPosts = getAllPosts()
  return allPosts.find(post => post.featured) || null
}

/**
 * Obtém posts relacionados (mesma categoria, excluindo o post atual)
 */
export function getRelatedPosts(slug: string, limit: number = 3): BlogPostMetadata[] {
  const currentPost = getPostMetadata(slug)
  
  if (!currentPost) {
    return []
  }

  const allPosts = getAllPosts()
  
  return allPosts
    .filter(post => post.slug !== slug && post.category === currentPost.category)
    .slice(0, limit)
}

/**
 * Obtém contadores de posts por categoria
 */
export function getCategoryCounts(): { name: string; count: number }[] {
  const allPosts = getAllPosts()
  
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
 * Valida se um post existe
 */
export function postExists(slug: string): boolean {
  try {
    const fullPath = path.join(postsDirectory, `${slug}.md`)
    return fs.existsSync(fullPath)
  } catch {
    return false
  }
}

/**
 * Obtém estatísticas do blog
 */
export function getBlogStats() {
  const allPosts = getAllPosts()
  
  return {
    totalPosts: allPosts.length,
    categories: getCategoryCounts().filter(c => c.name !== 'Todos').length,
    featuredPost: getFeaturedPost(),
    latestPosts: allPosts.slice(0, 5),
    lastUpdated: allPosts.length > 0 ? allPosts[0].publishDate : null
  }
}

