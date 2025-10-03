"use client"

import { useState, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { 
  BookOpen, 
  Calendar, 
  Clock, 
  BarChart3,
  ArrowRight,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight
} from "lucide-react"
import Link from "next/link"
import { type BlogPostMetadata } from "@/lib/blog-service"

// Constantes
const POSTS_PER_PAGE = 6

interface BlogClientProps {
  allPosts: BlogPostMetadata[]
  categories: { name: string; count: number }[]
  featuredPost: BlogPostMetadata | null
}

export function BlogClient({ allPosts, categories, featuredPost }: BlogClientProps) {
  // Estados
  const [selectedCategory, setSelectedCategory] = useState("Todos")
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)

  // Posts filtrados
  const filteredPosts = useMemo(() => {
    let filtered = allPosts.filter((post: BlogPostMetadata) => !post.featured) // Excluir post em destaque

    // Filtrar por categoria
    if (selectedCategory !== "Todos") {
      filtered = filtered.filter((post: BlogPostMetadata) => post.category === selectedCategory)
    }

    // Filtrar por busca
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter((post: BlogPostMetadata) => 
        post.title.toLowerCase().includes(term) ||
        post.excerpt.toLowerCase().includes(term) ||
        post.tags.some((tag: string) => tag.toLowerCase().includes(term))
      )
    }

    return filtered
  }, [allPosts, selectedCategory, searchTerm])

  // Paginação
  const totalPages = Math.ceil(filteredPosts.length / POSTS_PER_PAGE)
  const startIndex = (currentPage - 1) * POSTS_PER_PAGE
  const paginatedPosts = filteredPosts.slice(startIndex, startIndex + POSTS_PER_PAGE)

  // Reset página quando filtros mudam
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category)
    setCurrentPage(1)
  }

  const handleSearchChange = (term: string) => {
    setSearchTerm(term)
    setCurrentPage(1)
  }

  return (
    <>
      {/* Artigo em Destaque */}
      {featuredPost && (
        <section className="py-12 bg-white dark:bg-background">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-2xl font-bold mb-2">Artigo em Destaque</h2>
              <p className="text-muted-foreground">Nosso conteúdo mais completo e atualizado</p>
            </div>

            <Card className="border-0 shadow-xl max-w-4xl mx-auto overflow-hidden">
              <div className="grid grid-cols-1 lg:grid-cols-2">
                <div className="bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-950/20 dark:to-purple-950/20 p-12 flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                      <BookOpen className="w-12 h-12 text-white" />
                    </div>
                    <Badge className="bg-blue-100 text-blue-800 border-blue-300 mb-4">
                      {featuredPost.category}
                    </Badge>
                    <p className="text-sm text-muted-foreground">Artigo Completo</p>
                  </div>
                </div>
                
                <CardContent className="p-8 flex flex-col justify-center">
                  <div className="flex items-center gap-4 mb-4">
                    <Badge variant="outline" className="text-orange-600 border-orange-600">
                      <Calendar className="w-3 h-3 mr-1" />
                      {new Date(featuredPost.publishDate).toLocaleDateString('pt-BR')}
                    </Badge>
                    <Badge variant="outline" className="text-green-600 border-green-600">
                      <Clock className="w-3 h-3 mr-1" />
                      {featuredPost.readTime}
                    </Badge>
                  </div>
                  
                  <h3 className="text-2xl font-bold mb-4 leading-tight">
                    {featuredPost.title}
                  </h3>
                  
                  <p className="text-muted-foreground mb-6 leading-relaxed">
                    {featuredPost.excerpt}
                  </p>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">
                      Por {featuredPost.author}
                    </span>
                    <Button className="bg-blue-600 hover:bg-blue-700" asChild>
                      <Link href={`/blog/${featuredPost.slug}`} className="flex items-center gap-2">
                        Ler Artigo
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </div>
            </Card>
          </div>
        </section>
      )}

      {/* Filtros e Busca */}
      <section className="py-12 bg-gradient-to-b from-gray-50 to-white dark:from-background/50 dark:to-background">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="flex flex-col lg:flex-row gap-8 mb-12">
              {/* Busca */}
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                  <Input
                    type="text"
                    placeholder="Buscar artigos..."
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="pl-10 pr-4 py-3 h-12"
                    aria-label="Buscar artigos"
                  />
                </div>
              </div>
              
              {/* Categorias */}
              <div className="flex flex-wrap gap-2">
                {categories.map((category) => (
                  <Button
                    key={category.name}
                    variant={category.name === selectedCategory ? "default" : "outline"}
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={() => handleCategoryChange(category.name)}
                  >
                    <Filter className="w-3 h-3" />
                    {category.name}
                    <Badge variant="secondary" className="ml-1 text-xs">
                      {category.count}
                    </Badge>
                  </Button>
                ))}
              </div>
            </div>

            {/* Resultados da busca */}
            {searchTerm && (
              <div className="mb-8 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  {filteredPosts.length} resultado{filteredPosts.length !== 1 ? 's' : ''} encontrado{filteredPosts.length !== 1 ? 's' : ''} para &quot;{searchTerm}&quot;
                  {selectedCategory !== "Todos" && ` na categoria &quot;${selectedCategory}&quot;`}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Lista de Artigos */}
      <section className="py-12 bg-white dark:bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            {paginatedPosts.length > 0 ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {paginatedPosts.map((article: BlogPostMetadata) => (
                    <Card key={article.slug} className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 group">
                      <CardContent className="p-6">
                        <div className="flex items-center gap-2 mb-4">
                          <Badge variant="outline" className="text-blue-600 border-blue-600">
                            {article.category}
                          </Badge>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {article.readTime}
                          </div>
                        </div>
                        
                        <h3 className="text-lg font-bold mb-3 leading-tight group-hover:text-blue-600 transition-colors">
                          {article.title}
                        </h3>
                        
                        <p className="text-muted-foreground text-sm mb-4 leading-relaxed">
                          {article.excerpt}
                        </p>
                        
                        <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
                          <time 
                            dateTime={article.publishDate}
                            className="text-xs text-muted-foreground"
                          >
                            {new Date(article.publishDate).toLocaleDateString('pt-BR')}
                          </time>
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/blog/${article.slug}`} className="flex items-center gap-1">
                              Ler mais
                              <ArrowRight className="w-3 h-3" />
                            </Link>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {/* Paginação */}
                {totalPages > 1 && (
                  <nav aria-label="Paginação" className="flex justify-center mt-12">
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage(currentPage - 1)}
                        className="flex items-center gap-1"
                        aria-label="Página anterior"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Anterior
                      </Button>
                      
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <Button
                          key={page}
                          variant={page === currentPage ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className={page === currentPage ? "bg-blue-600" : ""}
                          aria-label={`Página ${page}`}
                          aria-current={page === currentPage ? "page" : undefined}
                        >
                          {page}
                        </Button>
                      ))}
                      
                      <Button 
                        variant="outline" 
                        size="sm" 
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage(currentPage + 1)}
                        className="flex items-center gap-1"
                        aria-label="Próxima página"
                      >
                        Próximo
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </div>
                  </nav>
                )}
              </>
            ) : (
              /* Nenhum resultado */
              <div className="text-center py-12">
                <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Search className="w-12 h-12 text-gray-400" />
                </div>
                <h3 className="text-xl font-bold mb-2">Nenhum artigo encontrado</h3>
                <p className="text-muted-foreground mb-6">
                  Tente ajustar seus filtros ou termo de busca para encontrar o que procura.
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchTerm("")
                    setSelectedCategory("Todos")
                    setCurrentPage(1)
                  }}
                >
                  Limpar Filtros
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-20 bg-gradient-to-r from-blue-600 to-violet-600 text-white">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold mb-6">
              Receba Nossos Artigos
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Seja o primeiro a receber nossos novos artigos sobre análise 
              fundamentalista e estratégias de investimento.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Seu melhor e-mail"
                className="flex-1 px-4 py-3 rounded-lg text-gray-900 focus:outline-none focus:ring-2 focus:ring-white"
                aria-label="E-mail para newsletter"
              />
              <Button className="bg-white text-blue-600 hover:bg-gray-100 px-6 py-3">
                Inscrever-se
              </Button>
            </div>
            
            <p className="text-sm mt-4 opacity-80">
              Sem spam. Apenas conteúdo de qualidade sobre investimentos.
            </p>
          </div>
        </div>
      </section>

      {/* CTA para Plataforma */}
      <section className="py-20 bg-white dark:bg-background">
        <div className="container mx-auto px-4 text-center">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold mb-6">
              Pronto para Aplicar o que Aprendeu?
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Use nossa plataforma para aplicar as estratégias que você aprendeu 
              nos artigos e encontrar ações subvalorizadas na B3.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-6 justify-center">
              <Button size="lg" className="bg-blue-600 hover:bg-blue-700 text-lg px-8 py-4" asChild>
                <Link href="/register" className="flex items-center gap-3">
                  <BarChart3 className="w-5 h-5" />
                  Começar Análise Gratuita
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button variant="outline" size="lg" className="text-lg px-8 py-4" asChild>
                <Link href="/ranking">Ver Rankings</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

