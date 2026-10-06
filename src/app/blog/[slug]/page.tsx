import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Breadcrumbs } from "@/components/landing/breadcrumbs"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import { Badge } from "@/components/ui/badge"
import { getPostBySlug, getAllPostSlugs, getRelatedPosts } from "@/lib/blog-service"
import { formatDate } from "@/lib/format"

/** O template do layout raiz já acrescenta "| Preço Justo AI"; remove a marca repetida de títulos vindos do banco. */
function stripBrandSuffix(title: string): string {
  return title.replace(/\s*[|\-–]\s*Preço Justo( AI)?\s*$/i, "").trim()
}

/** Datas chegam como YYYY-MM-DD; meio-dia UTC evita mostrar o dia anterior no fuso de Brasília. */
function dayLabel(isoDay: string): string {
  return formatDate(/^\d{4}-\d{2}-\d{2}$/.test(isoDay) ? `${isoDay}T12:00:00Z` : isoDay)
}

interface BlogPostPageProps {
  params: Promise<{
    slug: string
  }>
}

// Gerar parâmetros estáticos para todas as rotas de posts
export async function generateStaticParams() {
  const slugs = await getAllPostSlugs()
  return slugs.map((slug) => ({
    slug,
  }))
}

// Metadados otimizados para SEO
export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params
  const post = await getPostBySlug(slug)
  
  if (!post) {
    return {
      title: "Artigo não encontrado",
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
    title: stripBrandSuffix(post.seoTitle || post.title),
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
  const post = await getPostBySlug(slug)

  if (!post) {
    notFound()
  }

  const relatedPosts = await getRelatedPosts(slug, 3)

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://precojusto.ai"
  const postUrl = `${baseUrl}/blog/${slug}`
  const imageUrl = post.image || `${baseUrl}/logo-preco-justo.png`

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    image: imageUrl,
    datePublished: new Date(post.publishDate).toISOString(),
    dateModified: post.lastModified ? new Date(post.lastModified).toISOString() : new Date(post.publishDate).toISOString(),
    author: {
      "@type": "Organization",
      name: post.author,
      url: baseUrl,
    },
    publisher: {
      "@type": "Organization",
      name: "Preço Justo AI",
      url: baseUrl,
      logo: {
        "@type": "ImageObject",
        url: `${baseUrl}/logo-preco-justo.png`,
      },
    },
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": postUrl,
    },
    articleSection: post.category,
    keywords: post.tags.join(", "),
    wordCount: post.content.split(/\s+/).length,
    inLanguage: "pt-BR",
  }

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Início", item: baseUrl },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${baseUrl}/blog` },
      { "@type": "ListItem", position: 3, name: post.title, item: postUrl },
    ],
  }

  return (
    <div className="bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <div className="container mx-auto px-4 py-6 sm:py-10">
        <article className="mx-auto max-w-[68ch]">
          <Breadcrumbs items={[{ label: "Blog", href: "/blog" }, { label: post.category }]} />

          <header className="space-y-4 border-b border-border pb-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="brand">{post.category}</Badge>
            </div>
            <h1 className="text-2xl font-semibold leading-tight tracking-tight text-foreground sm:text-3xl">{post.title}</h1>
            <p className="text-base text-muted-foreground">{post.excerpt}</p>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
              <span>{post.author}</span>
              <span aria-hidden="true">·</span>
              <time dateTime={post.publishDate} className="tabular-nums">
                {dayLabel(post.publishDate)}
              </time>
              {post.readTime && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{post.readTime} de leitura</span>
                </>
              )}
            </p>
          </header>

          <MarkdownRenderer content={post.content} className="mt-8 max-w-none text-base leading-7" />

          {post.tags.length > 0 && (
            <ul className="mt-10 flex flex-wrap gap-2" aria-label="Tags">
              {post.tags.slice(0, 6).map((tag) => (
                <li key={tag}>
                  <Badge variant="neutral">{tag}</Badge>
                </li>
              ))}
            </ul>
          )}

          <p className="mt-8 rounded-lg border border-border bg-surface p-4 text-sm text-muted-foreground">
            Conteúdo educativo. Não é recomendação de investimento. Veja como calculamos cada número na{" "}
            <Link href="/metodologia" className="text-brand underline-offset-4 hover:underline">
              metodologia
            </Link>
            .
          </p>
        </article>

        {relatedPosts.length > 0 && (
          <section aria-labelledby="relacionados" className="mx-auto mt-12 max-w-[68ch]">
            <h2 id="relacionados" className="text-lg font-semibold tracking-tight text-foreground">
              Artigos relacionados
            </h2>
            <ul className="mt-3 divide-y divide-border border-y border-border">
              {relatedPosts.map((related) => (
                <li key={related.slug} className="relative py-4">
                  <h3 className="text-base font-medium leading-snug text-foreground hover:text-brand">
                    <Link href={`/blog/${related.slug}`} className="after:absolute after:inset-0">
                      {related.title}
                    </Link>
                  </h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    <time dateTime={related.publishDate} className="tabular-nums">
                      {dayLabel(related.publishDate)}
                    </time>
                    {related.readTime && ` · ${related.readTime} de leitura`}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  )
}
