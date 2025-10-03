import { Metadata } from "next"
import { notFound } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Calendar, 
  Clock, 
  User,
  ArrowLeft,
  Share2,
  BookOpen,
  Tag,
  ArrowRight
} from "lucide-react"
import Link from "next/link"
import { getPostBySlug, getAllPostSlugs, getRelatedPosts } from "@/lib/blog-service"
import { MarkdownRenderer } from "@/components/markdown-renderer"

interface BlogPostPageProps {
  params: Promise<{
    slug: string
  }>
}

// Gerar parâmetros estáticos para todas as rotas de posts
export async function generateStaticParams() {
  const slugs = getAllPostSlugs()
  return slugs.map((slug) => ({
    slug,
  }))
}

// Metadados otimizados para SEO
export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params
  const post = getPostBySlug(slug)
  
  if (!post) {
    return {
      title: "Post não encontrado | Preço Justo AI",
      description: "O post que você está procurando não foi encontrado."
    }
  }

  const publishedTime = new Date(post.publishDate).toISOString()
  const modifiedTime = post.lastModified 
    ? new Date(post.lastModified).toISOString() 
    : publishedTime

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://precojusto.ai'
  const postUrl = `${baseUrl}/blog/${slug}`
  const imageUrl = post.image || `${baseUrl}/logo-preco-justo.png`

  return {
    title: post.seoTitle || `${post.title} | Preço Justo AI`,
    description: post.seoDescription || post.excerpt,
    keywords: post.tags.join(", "),
    authors: [{ name: post.author }],
    creator: post.author,
    publisher: "Preço Justo AI",
    metadataBase: new URL(baseUrl),
    alternates: {
      canonical: post.canonicalUrl || postUrl,
    },
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime,
      modifiedTime,
      authors: [post.author],
      tags: post.tags,
      url: postUrl,
      siteName: "Preço Justo AI",
      locale: "pt_BR",
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: post.title,
        }
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
      images: [imageUrl],
      creator: "@precojustoai",
      site: "@precojustoai",
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-video-preview': -1,
        'max-image-preview': 'large',
        'max-snippet': -1,
      },
    },
  }
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  
  if (!post) {
    notFound()
  }

  // Posts relacionados (mesma categoria, excluindo o atual)
  const relatedPosts = getRelatedPosts(slug, 3)

  // URL base para compartilhamento
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://precojusto.ai'
  const postUrl = `${baseUrl}/blog/${slug}`
  const imageUrl = post.image || `${baseUrl}/logo-preco-justo.png`

  // Schema.org JSON-LD para SEO
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": post.excerpt,
    "image": imageUrl,
    "datePublished": new Date(post.publishDate).toISOString(),
    "dateModified": post.lastModified 
      ? new Date(post.lastModified).toISOString() 
      : new Date(post.publishDate).toISOString(),
    "author": {
      "@type": "Organization",
      "name": post.author,
      "url": baseUrl
    },
    "publisher": {
      "@type": "Organization",
      "name": "Preço Justo AI",
      "url": baseUrl,
      "logo": {
        "@type": "ImageObject",
        "url": `${baseUrl}/logo-preco-justo.png`
      }
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": postUrl
    },
    "articleSection": post.category,
    "keywords": post.tags.join(", "),
    "wordCount": post.content.split(/\s+/).length,
    "inLanguage": "pt-BR"
  }

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Início",
        "item": baseUrl
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": "Blog",
        "item": `${baseUrl}/blog`
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": post.title,
        "item": postUrl
      }
    ]
  }

  return (
    <>
      {/* JSON-LD Schemas para SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
        {/* Header do Post */}
        <article>
          <section className="py-12 bg-white dark:bg-background border-b">
            <div className="container mx-auto px-4">
              <div className="max-w-4xl mx-auto">
                {/* Breadcrumb */}
                <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
                  <Link href="/" className="hover:text-blue-600 transition-colors">
                    Início
                  </Link>
                  <span>/</span>
                  <Link href="/blog" className="hover:text-blue-600 transition-colors">
                    Blog
                  </Link>
                  <span>/</span>
                  <span className="text-foreground">{post.title}</span>
                </nav>

                {/* Voltar */}
                <Button variant="ghost" size="sm" className="mb-8" asChild>
                  <Link href="/blog" className="flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Voltar ao Blog
                  </Link>
                </Button>

                {/* Categoria e Tags */}
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                    {post.category}
                  </Badge>
                  {post.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      <Tag className="w-3 h-3 mr-1" />
                      {tag}
                    </Badge>
                  ))}
                </div>

                {/* Título */}
                <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6 leading-tight">
                  {post.title}
                </h1>

                {/* Excerpt */}
                <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                  {post.excerpt}
                </p>

                {/* Meta informações */}
                <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4" />
                    <span>{post.author}</span>
                  </div>
                  <time 
                    dateTime={post.publishDate}
                    className="flex items-center gap-2"
                  >
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(post.publishDate).toLocaleDateString('pt-BR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}</span>
                  </time>
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    <span>{post.readTime} de leitura</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Conteúdo do Post */}
          <section className="py-12 bg-gray-50/50 dark:bg-gray-950/20">
            <div className="container mx-auto px-4">
              <div className="max-w-4xl mx-auto">
                <Card className="border-0 shadow-2xl bg-white dark:bg-gray-900">
                  <CardContent className="p-8 sm:p-12 lg:p-16">
                    <MarkdownRenderer 
                      content={post.content}
                      className="max-w-none"
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          </section>
        </article>

        {/* Posts Relacionados */}
        {relatedPosts.length > 0 && (
          <section className="py-12 bg-gray-50 dark:bg-background/50">
            <div className="container mx-auto px-4">
              <div className="max-w-6xl mx-auto">
                <div className="text-center mb-12">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-4">
                    Artigos Relacionados
                  </h2>
                  <p className="text-muted-foreground">
                    Continue aprendendo com outros artigos sobre {post.category.toLowerCase()}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {relatedPosts.map((relatedPost) => (
                    <Card key={relatedPost.slug} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <Badge variant="outline" className="text-blue-600 border-blue-600">
                            {relatedPost.category}
                          </Badge>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {relatedPost.readTime}
                          </div>
                        </div>
                        
                        <h3 className="text-lg font-bold mb-3 leading-tight group-hover:text-blue-600 transition-colors">
                          {relatedPost.title}
                        </h3>
                        
                        <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
                          {relatedPost.excerpt}
                        </p>
                        
                        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
                          <time 
                            dateTime={relatedPost.publishDate}
                            className="text-xs text-muted-foreground"
                          >
                            {new Date(relatedPost.publishDate).toLocaleDateString('pt-BR')}
                          </time>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/blog/${relatedPost.slug}`} className="flex items-center gap-1">
                              Ler mais
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* CTA Final */}
        <section className="py-20 bg-gradient-to-r from-blue-600 to-violet-600 text-white">
          <div className="container mx-auto px-4 text-center">
            <div className="max-w-3xl mx-auto">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
                <BookOpen className="w-8 h-8" />
              </div>
              
              <h2 className="text-3xl sm:text-4xl font-bold mb-6">
                Pronto para Aplicar o que Aprendeu?
              </h2>
              <p className="text-xl mb-8 opacity-90">
                Use nossa plataforma para aplicar as estratégias que você aprendeu 
                e encontrar ações subvalorizadas na B3.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-4" asChild>
                  <Link href="/register" className="flex items-center gap-3">
                    Começar Análise Gratuita
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                </Button>
                <Button variant="outline" size="lg" className="border-white hover:bg-white/10 text-lg px-8 py-4" asChild>
                  <Link href="/ranking">Ver Rankings</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
