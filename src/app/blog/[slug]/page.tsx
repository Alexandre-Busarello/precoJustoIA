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
import { getBlogPostBySlug, blogPosts } from "@/lib/blog-data"
import { MarkdownRenderer } from "@/components/markdown-renderer"

interface BlogPostPageProps {
  params: Promise<{
    slug: string
  }>
}

export async function generateStaticParams() {
  return blogPosts.map((post) => ({
    slug: post.slug,
  }))
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params
  const post = getBlogPostBySlug(slug)
  
  if (!post) {
    return {
      title: "Post não encontrado | Preço Justo AI",
      description: "O post que você está procurando não foi encontrado."
    }
  }

  return {
    title: post.seoTitle || `${post.title} | Preço Justo AI`,
    description: post.seoDescription || post.excerpt,
    keywords: post.tags.join(", "),
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.publishDate,
      authors: [post.author],
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.excerpt,
    }
  }
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params
  const post = getBlogPostBySlug(slug)
  
  if (!post) {
    notFound()
  }

  // Posts relacionados (mesma categoria, excluindo o atual)
  const relatedPosts = blogPosts
    .filter(p => p.category === post.category && p.id !== post.id)
    .slice(0, 3)

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-blue-950/20 dark:to-background">
      {/* Header do Post */}
      <section className="py-12 bg-white dark:bg-background border-b">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
              <Link href="/" className="hover:text-blue-600 transition-colors">
                Início
              </Link>
              <span>/</span>
              <Link href="/blog" className="hover:text-blue-600 transition-colors">
                Blog
              </Link>
              <span>/</span>
              <span className="text-foreground">{post.title}</span>
            </div>

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
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                <span>{new Date(post.publishDate).toLocaleDateString('pt-BR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>{post.readTime} de leitura</span>
              </div>
              <Button variant="ghost" size="sm" className="ml-auto">
                <Share2 className="w-4 h-4 mr-2" />
                Compartilhar
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Conteúdo do Post */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <Card className="border-0 shadow-lg">
              <CardContent className="p-8 lg:p-12">
                <MarkdownRenderer 
                  content={post.content}
                  className="max-w-none"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

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
                  <Card key={relatedPost.id} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
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
                        <div className="text-xs text-muted-foreground">
                          {new Date(relatedPost.publishDate).toLocaleDateString('pt-BR')}
                        </div>
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
  )
}
