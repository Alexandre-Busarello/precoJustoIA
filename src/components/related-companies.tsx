'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import { formatBRL, formatNumber } from '@/lib/format';
import { formatMarginOfSafety, marginOfSafety, valuationStatus } from '@/lib/valuation-metrics';
import { CompanyLogo } from '@/components/company-logo';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { SectionHeader } from '@/components/ui/section-header';

interface RelatedCompany {
  ticker: string;
  name: string;
  sector: string | null;
  logoUrl?: string | null;
  marketCap?: number | null;
  assetType?: string;
  /** Último preço. */
  price?: number | null;
  /** Preço justo de referência para a margem (Graham). */
  fairValue?: number | null;
  /** Score geral (0–100). */
  score?: number | null;
}

interface RelatedCompaniesProps {
  companies: RelatedCompany[];
  currentTicker: string;
  currentSector?: string | null;
  currentIndustry?: string | null;
  currentAssetType?: string;
  /** Mostra a margem de segurança (Graham exige conta ou acesso completo). */
  showMargin?: boolean;
  /** Mostra o score (Premium ou acesso completo). */
  showScore?: boolean;
}

const MAX_ROWS = 5;

function assetUrl(ticker: string, assetType?: string) {
  const lowerTicker = ticker.toLowerCase();
  switch (assetType) {
    case 'FII':
      return `/fii/${lowerTicker}`;
    case 'BDR':
      return `/bdr/${lowerTicker}`;
    case 'ETF':
      return `/etf/${lowerTicker}`;
    default:
      return `/acao/${lowerTicker}`;
  }
}

function Blurred({ children }: { children: string }) {
  return (
    <>
      <span aria-hidden="true" className="select-none text-muted-foreground blur-sm">
        {children}
      </span>
      <span className="sr-only">Disponível para assinantes</span>
    </>
  );
}

const MARGIN_TONE = { below: 'text-positive', within: 'text-foreground', above: 'text-negative' } as const;

/** Empresas do mesmo setor em tabela compacta (ticker · preço · margem · score), com links internos. */
export function RelatedCompanies({
  companies,
  currentTicker,
  currentSector,
  currentAssetType = 'STOCK',
  showMargin = true,
  showScore = true,
}: RelatedCompaniesProps) {
  if (!companies || companies.length === 0) {
    return null;
  }

  const rows = companies.slice(0, MAX_ROWS);

  const columns: DataTableColumn<RelatedCompany>[] = [
    {
      key: 'ticker',
      header: 'Ativo',
      sticky: true,
      cell: (company) => (
        <Link
          href={assetUrl(company.ticker, company.assetType)}
          prefetch={false}
          className="flex min-h-11 items-center gap-2 md:min-h-0"
        >
          <CompanyLogo logoUrl={company.logoUrl} companyName={company.name} ticker={company.ticker} size={24} />
          <span className="font-medium whitespace-nowrap text-foreground hover:underline">
            <span className="sr-only">Valuation </span>
            {company.ticker}
          </span>
          <span className="hidden max-w-48 truncate text-xs text-muted-foreground sm:inline">{company.name}</span>
        </Link>
      ),
    },
    {
      key: 'price',
      header: 'Preço',
      align: 'right',
      cell: (company) => formatBRL(company.price),
    },
    {
      key: 'margin',
      header: 'Margem de segurança (Graham)',
      align: 'right',
      hint: 'Margem de segurança pelo Número de Graham: 1 − preço ÷ preço justo.',
      cell: (company) => {
        if (!showMargin) return <Blurred>+00,0%</Blurred>;
        const margin = marginOfSafety(company.price, company.fairValue);
        const status = valuationStatus(margin);
        return <span className={cn('font-medium', status && MARGIN_TONE[status])}>{formatMarginOfSafety(margin)}</span>;
      },
    },
    {
      key: 'score',
      header: 'Score',
      align: 'right',
      cell: (company) => {
        if (!showScore) return <Blurred>00/100</Blurred>;
        return typeof company.score === 'number' ? `${formatNumber(Math.round(company.score), { digits: 0 })}/100` : '—';
      },
    },
  ];

  const compareTickers = rows.slice(0, 3).map((c) => c.ticker).join('/');

  return (
    <div className="space-y-4">
      <SectionHeader
        title="Empresas relacionadas"
        description={currentSector ? `Outras empresas do setor ${currentSector}.` : 'Empresas similares para comparar.'}
        actions={
          rows.length >= 2 && currentAssetType === 'STOCK' ? (
            <Link
              href={`/compara-acoes/${currentTicker}/${compareTickers}`}
              prefetch={false}
              className="inline-flex min-h-11 items-center text-sm font-medium text-brand underline-offset-4 hover:underline md:min-h-0"
            >
              Comparar com o setor
            </Link>
          ) : undefined
        }
      />
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(company) => company.ticker}
        caption={`Empresas relacionadas a ${currentTicker}`}
      />
    </div>
  );
}
