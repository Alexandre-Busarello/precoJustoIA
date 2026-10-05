import { Metadata } from "next"
import { Breadcrumbs } from "@/components/landing/breadcrumbs"
import { getAllPosts, getCategoryCounts } from "@/lib/blog-service"
import { BlogClient } from "./blog-client"

export const metadata: Metadata = {
  title: "Blog de análise fundamentalista: artigos sobre ações da B3",
  description:
    "Artigos sobre análise fundamentalista, modelos de valuation, dividendos e como usar o Preço Justo AI para estudar empresas da B3.",
  keywords:
    "blog análise fundamentalista, artigos investimentos, como investir ações, análise empresas B3, valuation, dividendos, educação financeira",
  openGraph: {
    title: "Blog de análise fundamentalista",
    description: "Artigos sobre análise fundamentalista, modelos de valuation e dividendos na B3.",
    type: "website",
    url: "https://precojusto.ai/blog",
  },
  twitter: {
    card: "summary_large_image",
    title: "Blog de análise fundamentalista",
    description: "Artigos sobre análise fundamentalista, modelos de valuation e dividendos na B3.",
  },
  alternates: {
    canonical: "/blog",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default async function BlogPage() {
  const [allPosts, categories] = await Promise.all([getAllPosts(), getCategoryCounts()])

  const blogSchema = {
    "@context": "https://schema.org",
    "@type": "Blog",
    name: "Blog Preço Justo AI",
    description: "Artigos sobre análise fundamentalista e investimentos em ações da B3",
    url: "https://precojusto.ai/blog",
    publisher: {
      "@type": "Organization",
      name: "Preço Justo AI",
      url: "https://precojusto.ai",
    },
  }

  return (
    <div className="bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(blogSchema) }} />
      <div className="container mx-auto max-w-4xl px-4 py-6 sm:py-10">
        <Breadcrumbs items={[{ label: "Blog" }]} />
        <header className="mb-6 space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Blog</h1>
          <p className="text-base text-muted-foreground">
            Artigos sobre análise fundamentalista, modelos de valuation e dividendos.
          </p>
        </header>
        <BlogClient allPosts={allPosts} categories={categories} />
      </div>
    </div>
  )
}
