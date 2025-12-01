import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'
import { ScreeningConversionPage } from '@/components/screening-conversion-page'
import { getPresetBySlug, getAllPresetSlugs } from '@/lib/screening-presets'
import { Loader2 } from 'lucide-react'

interface PageProps {
  params: Promise<{
    slug: string
  }>
}

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
    return {
      title: 'Screening de Ações - Preço Justo AI',
    }
  }

  const baseUrl = 'https://precojusto.ai'
  const url = `${baseUrl}/screening-acoes/${preset.slug}`

  return {
    title: `${preset.title} | Preço Justo AI`,
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

  return <ScreeningConversionPage preset={preset} />
}

export default async function ScreeningConversionPageRoute({ params }: PageProps) {
  const resolvedParams = await params

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      }
    >
      <ScreeningConversionContent slug={resolvedParams.slug} />
    </Suspense>
  )
}

