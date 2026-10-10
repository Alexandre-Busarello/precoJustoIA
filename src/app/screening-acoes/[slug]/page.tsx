import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ScreeningConversionPage } from '@/components/screening-conversion-page'
import { SignalPresetPage } from '@/components/screening/signal-preset-page'
import { getPresetBySlug, getAllPresetSlugs, isFilterPreset } from '@/lib/screening-presets'
import { Loader2 } from 'lucide-react'

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

// Só os slugs dos presets existem: qualquer outro responde 404 de verdade (antes o notFound() dentro do
// Suspense chegava depois do streaming começar e a resposta saía com HTTP 200).
export const dynamicParams = false

export async function generateStaticParams() {
  const slugs = getAllPresetSlugs()
  return slugs.map((slug) => ({
    slug,
  }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params
  const preset = getPresetBySlug(resolvedParams.slug)

  if (!preset) {
    notFound()
  }

  const baseUrl = 'https://precojusto.ai'
  const url = `${baseUrl}/screening-acoes/${preset.slug}`

  return {
    title: preset.title,
    description: preset.description,
    keywords: preset.keywords.join(', '),
    alternates: {
      canonical: url,
    },
    openGraph: {
      title: preset.title,
      description: preset.description,
      url,
      type: 'website',
      siteName: 'Preço Justo AI',
    },
    twitter: {
      card: 'summary_large_image',
      title: preset.title,
      description: preset.description,
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

function ScreeningConversionContent({ slug }: { slug: string }) {
  const preset = getPresetBySlug(slug)

  if (!preset) {
    notFound()
  }

  return isFilterPreset(preset) ? <ScreeningConversionPage preset={preset} /> : <SignalPresetPage preset={preset} />
}

export default async function ScreeningConversionPageRoute({ params }: PageProps) {
  const resolvedParams = await params
  if (!getPresetBySlug(resolvedParams.slug)) {
    notFound()
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="size-5 animate-spin text-muted-foreground" strokeWidth={1.75} aria-label="Carregando" />
        </div>
      }
    >
      <ScreeningConversionContent slug={resolvedParams.slug} />
    </Suspense>
  )
}

