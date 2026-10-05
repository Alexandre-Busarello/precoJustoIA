"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatDate } from "@/lib/format"
import { cn } from "@/lib/utils"
import { type BlogPostMetadata } from "@/lib/blog-service"

const POSTS_PER_PAGE = 10
const ALL = "Todos"

interface BlogClientProps {
  allPosts: BlogPostMetadata[]
  categories: { name: string; count: number }[]
}

/** Data de publicação chega como YYYY-MM-DD; meio-dia UTC evita mostrar o dia anterior no fuso de Brasília. */
function publishLabel(isoDay: string): string {
  return formatDate(/^\d{4}-\d{2}-\d{2}$/.test(isoDay) ? `${isoDay}T12:00:00Z` : isoDay)
}

export function BlogClient({ allPosts, categories }: BlogClientProps) {
  const [selectedCategory, setSelectedCategory] = useState(ALL)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)

  const filteredPosts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return allPosts.filter((post) => {
      if (selectedCategory !== ALL && post.category !== selectedCategory) return false
      if (!term) return true
      return (
        post.title.toLowerCase().includes(term) ||
        post.excerpt.toLowerCase().includes(term) ||
        post.tags.some((tag) => tag.toLowerCase().includes(term))
      )
    })
  }, [allPosts, selectedCategory, searchTerm])

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / POSTS_PER_PAGE))
  const page = Math.min(currentPage, totalPages)
  const paginatedPosts = filteredPosts.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE)

  const changeCategory = (category: string) => {
    setSelectedCategory(category)
    setCurrentPage(1)
  }

  const changeSearch = (term: string) => {
    setSearchTerm(term)
    setCurrentPage(1)
  }

  const clearFilters = () => {
    setSearchTerm("")
    setSelectedCategory(ALL)
    setCurrentPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <Input
            type="search"
            placeholder="Buscar artigos"
            value={searchTerm}
            onChange={(e) => changeSearch(e.target.value)}
            className="h-11 pl-9 text-base md:text-sm"
            aria-label="Buscar artigos"
          />
        </div>

        {categories.length > 2 && (
          <div
            role="group"
            aria-label="Filtrar por categoria"
            className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
          >
            {categories.map((category) => {
              const active = category.name === selectedCategory
              return (
                <button
                  key={category.name}
                  type="button"
                  onClick={() => changeCategory(category.name)}
                  aria-pressed={active}
                  className={cn(
                    "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors sm:min-h-9",
                    active
                      ? "border-brand bg-brand-subtle text-brand"
                      : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {category.name}
                  <span className="text-xs tabular-nums opacity-80">{category.count}</span>
                </button>
              )
            })}
          </div>
        )}

        {searchTerm.trim() && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {filteredPosts.length} {filteredPosts.length === 1 ? "artigo encontrado" : "artigos encontrados"} para
            &quot;{searchTerm.trim()}&quot;
            {selectedCategory !== ALL && ` em ${selectedCategory}`}
          </p>
        )}
      </div>

      {paginatedPosts.length > 0 ? (
        <ul className="divide-y divide-border border-y border-border">
          {paginatedPosts.map((post) => (
            <li key={post.slug}>
              <article className="group relative py-5">
                <div className="mb-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-medium text-brand">{post.category}</span>
                  <span aria-hidden="true">·</span>
                  <time dateTime={post.publishDate} className="tabular-nums">
                    {publishLabel(post.publishDate)}
                  </time>
                  {post.readTime && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{post.readTime} de leitura</span>
                    </>
                  )}
                </div>
                <h2 className="text-lg font-semibold leading-snug tracking-tight text-foreground group-hover:text-brand">
                  <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0">
                    {post.title}
                  </Link>
                </h2>
                <p className="mt-1.5 line-clamp-3 text-sm leading-6 text-muted-foreground sm:line-clamp-2">{post.excerpt}</p>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-border bg-card p-6 text-center">
          <p className="text-sm font-medium text-foreground">Nenhum artigo encontrado</p>
          <p className="mt-1 text-sm text-muted-foreground">Tente outro termo ou outra categoria.</p>
          {(searchTerm || selectedCategory !== ALL) && (
            <Button variant="outline" size="sm" className="mt-4" onClick={clearFilters}>
              Limpar filtros
            </Button>
          )}
        </div>
      )}

      {totalPages > 1 && (
        <nav aria-label="Paginação" className="flex items-center justify-between gap-2">
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 sm:min-h-8"
            disabled={page === 1}
            onClick={() => setCurrentPage(page - 1)}
          >
            <ChevronLeft className="size-4" strokeWidth={1.75} aria-hidden="true" />
            Anterior
          </Button>
          <span className="text-sm tabular-nums text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="min-h-11 sm:min-h-8"
            disabled={page === totalPages}
            onClick={() => setCurrentPage(page + 1)}
          >
            Próxima
            <ChevronRight className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </Button>
        </nav>
      )}
    </div>
  )
}
