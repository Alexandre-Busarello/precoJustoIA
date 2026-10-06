'use client'

/**
 * Análise setorial: resumo em Stats e, para cada setor, as empresas de maior score numa tabela de 5 linhas.
 * Sem Premium, a 1ª posição de cada setor fica bloqueada (o ticker nem chega ao DOM) e só 2 setores aparecem.
 */

import { useRef, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp, Lock } from 'lucide-react'
import { CompanyLogo } from '@/components/company-logo'
import { SectorSelector } from '@/components/sector-selector'
import { Button } from '@/components/ui/button'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { SectionHeader } from '@/components/ui/section-header'
import { Stat } from '@/components/ui/stat'
import { formatBRL, formatNumber } from '@/lib/format'

interface Company {
  ticker: string
  name: string
  score: number
  currentPrice: number
  logoUrl: string | null
  /** Rótulo de qualidade do score ("Qualidade alta", "Qualidade boa"...). */
  recommendation: string
}

interface SectorData {
  sector: string
  companyCount: number
  /** `null` = posição bloqueada (removida no servidor para quem não é Premium). */
  topCompanies: Array<Company | null>
  averageScore: number
}

interface SectorAnalysisClientProps {
  initialSectors: SectorData[]
  isPremium: boolean
}

type Row = { position: number; locked: boolean; company: Company | null }

const ALL_SECTORS = [
  'Financeiro',
  'Energia',
  'Tecnologia da Informação',
  'Saúde',
  'Consumo Cíclico',
  'Consumo Não Cíclico',
  'Bens Industriais',
  'Materiais Básicos',
  'Imobiliário',
  'Utilidade Pública',
  'Comunicações',
]

const VISIBLE_ROWS = 5

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

const columns: DataTableColumn<Row>[] = [
  {
    key: 'company',
    header: 'Empresa',
    sticky: true,
    cell: (row) =>
      row.locked || !row.company ? (
        <Link href="/planos" className="flex items-center gap-2 py-1 text-muted-foreground hover:text-foreground">
          <span className="w-4 text-xs tabular-nums">{row.position}</span>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted">
            <Lock className="size-4" strokeWidth={1.75} aria-hidden="true" />
          </span>
          <span className="text-sm whitespace-nowrap">1ª posição no Premium</span>
        </Link>
      ) : (
        <Link
          href={`/acao/${row.company.ticker.toLowerCase()}`}
          prefetch={false}
          className="flex min-w-0 items-center gap-2 py-1 hover:underline"
        >
          <span className="w-4 text-xs text-muted-foreground tabular-nums">{row.position}</span>
          <CompanyLogo ticker={row.company.ticker} companyName={row.company.name} logoUrl={row.company.logoUrl} size={28} />
          <span className="min-w-0">
            <span className="block font-medium text-foreground">{row.company.ticker}</span>
            <span className="block max-w-36 truncate text-xs text-muted-foreground sm:max-w-64">{row.company.name}</span>
          </span>
        </Link>
      ),
  },
  {
    key: 'score',
    header: 'Score',
    align: 'right',
    cell: (row) => (row.company ? <span className="font-medium">{formatNumber(row.company.score, { digits: 0 })}</span> : '—'),
  },
  {
    key: 'quality',
    header: 'Qualidade',
    className: 'whitespace-nowrap text-muted-foreground',
    cell: (row) => (row.company ? capitalize(row.company.recommendation.replace(/^Qualidade /, '')) : '—'),
  },
  {
    key: 'price',
    header: 'Preço',
    align: 'right',
    cell: (row) => (row.company ? formatBRL(row.company.currentPrice) : '—'),
  },
]

function SectorTable({ sector, isPremium }: { sector: SectorData; isPremium: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const companies = expanded ? sector.topCompanies : sector.topCompanies.slice(0, VISIBLE_ROWS)
  const rows: Row[] = companies.map((company, index) => {
    const locked = company === null || (index === 0 && !isPremium)
    return { position: index + 1, locked, company: locked ? null : company }
  })
  const comparable = sector.topCompanies.filter(
    (company, index): company is Company => company !== null && (isPremium || index > 0),
  )

  return (
    <section className="space-y-3">
      <SectionHeader
        as="h3"
        title={sector.sector}
        description={`${sector.companyCount} empresas, score médio de ${formatNumber(sector.averageScore, { digits: 0 })}`}
        actions={
          comparable.length >= 2 && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/compara-acoes/${comparable.map((c) => c.ticker).join('/')}`}>
                Comparar {comparable.length} empresas
              </Link>
            </Button>
          )
        }
      />
      <DataTable
        columns={columns}
        rows={rows}
        dense
        getRowId={(row) => `${sector.sector}-${row.position}`}
        caption={`Empresas de maior score em ${sector.sector}`}
        empty={{ title: 'Nenhuma empresa com score neste setor' }}
      />
      {sector.topCompanies.length > VISIBLE_ROWS && (
        <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
          {expanded ? (
            <ChevronUp className="size-4" strokeWidth={1.75} />
          ) : (
            <ChevronDown className="size-4" strokeWidth={1.75} />
          )}
          {expanded ? 'Mostrar 5' : `Mostrar todas as ${sector.topCompanies.length}`}
        </Button>
      )}
    </section>
  )
}

export function SectorAnalysisClient({ initialSectors, isPremium }: SectorAnalysisClientProps) {
  const [sectors, setSectors] = useState<SectorData[]>(initialSectors)
  const [loadingSectors, setLoadingSectors] = useState<string[]>([])
  const [loadError, setLoadError] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)

  const remainingSectors = ALL_SECTORS.filter((s) => !sectors.some((loaded) => loaded.sector === s))

  const loadSelectedSectors = async (selected: string[]) => {
    if (!isPremium || selected.length === 0) return
    try {
      setLoadError(false)
      setLoadingSectors(selected)
      const response = await fetch(`/api/sector-analysis?sectors=${encodeURIComponent(selected.join(','))}`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      setSectors((prev) => {
        const merged = [...prev, ...data.sectors].filter(
          (sector, index, self) => index === self.findIndex((s) => s.sector === sector.sector)
        )
        return merged.sort((a, b) => b.averageScore - a.averageScore)
      })
      listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } catch (error) {
      console.error('Erro ao buscar setores:', error)
      setLoadError(true)
    } finally {
      setLoadingSectors([])
    }
  }

  if (sectors.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p className="text-sm text-foreground">Nenhum setor disponível no momento.</p>
        <p className="mt-1 text-sm text-muted-foreground">Os scores são recalculados diariamente. Tente mais tarde.</p>
      </div>
    )
  }

  const totalCompanies = sectors.reduce((sum, s) => sum + s.companyCount, 0)
  const averageScore = sectors.reduce((sum, s) => sum + s.averageScore, 0) / sectors.length

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-3 gap-4 rounded-lg border border-border bg-card p-4 sm:p-5">
        <Stat label="Setores" value={formatNumber(sectors.length, { digits: 0 })} />
        <Stat label="Empresas" value={formatNumber(totalCompanies, { digits: 0 })} />
        <Stat label="Score médio" value={formatNumber(averageScore, { digits: 0 })} />
      </div>

      <div ref={listRef} className="scroll-mt-24 space-y-8">
        {sectors.map((sector) => (
          <SectorTable key={sector.sector} sector={sector} isPremium={isPremium} />
        ))}
      </div>

      {loadError && (
        <p role="alert" className="text-sm text-negative">
          Não foi possível carregar os setores escolhidos. Tente novamente.
        </p>
      )}

      {remainingSectors.length > 0 &&
        (isPremium ? (
          <SectorSelector
            availableSectors={remainingSectors}
            onSelectSectors={loadSelectedSectors}
            loadingSectors={loadingSectors}
          />
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Lock className="size-4 shrink-0" strokeWidth={1.75} aria-hidden="true" />
              Os {ALL_SECTORS.length} setores da B3 e a 1ª posição de cada um estão no Premium.
            </p>
            <Button asChild size="sm">
              <Link href="/planos">Conhecer o Premium</Link>
            </Button>
          </div>
        ))}

      <div className="flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          Quer aplicar os seus próprios critérios? Monte um ranking com o modelo de valuation que preferir.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/ranking">Abrir rankings</Link>
        </Button>
      </div>
    </div>
  )
}
