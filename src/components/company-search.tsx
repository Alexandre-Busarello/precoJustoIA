'use client';

import { useState, useEffect, useRef, useId } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Loader2, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { CompanyLogo } from '@/components/company-logo';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useEngagementPixel } from '@/hooks/use-engagement-pixel';

interface Company {
  id: number;
  ticker: string;
  name: string;
  sector: string | null;
  logoUrl: string | null;
  assetType: string;
}

interface CompanySearchResponse {
  companies: Company[];
}

interface CompanySearchProps {
  placeholder?: string;
  className?: string;
  /** Callback opcional: substitui a navegação padrão para a página do ativo. */
  onCompanySelect?: (company: Company) => void;
  /** Chamado depois de navegar (ex.: fechar o dialog de busca). */
  onNavigate?: () => void;
  /** `popover` (padrão): resultados flutuam abaixo do campo. `list`: resultados na própria coluna (dialog/sheet). */
  variant?: 'popover' | 'list';
  autoFocus?: boolean;
}

const ASSET_TYPE_LABEL: Record<string, string> = {
  STOCK: 'Ação',
  FII: 'FII',
  BDR: 'BDR',
  ETF: 'ETF',
};

export function getAssetUrl(ticker: string, assetType: string) {
  const lowerTicker = ticker.toLowerCase();
  switch (assetType) {
    case 'FII':
      return `/fii/${lowerTicker}`;
    case 'BDR':
      return `/bdr/${lowerTicker}`;
    case 'ETF':
      return `/etf/${lowerTicker}`;
    case 'STOCK':
    default:
      return `/acao/${lowerTicker}`;
  }
}

/** Busca de ativos por ticker ou nome com autocomplete (setas, Enter, Esc). */
export default function CompanySearch({
  placeholder = 'Buscar por ticker ou nome',
  className,
  onCompanySelect,
  onNavigate,
  variant = 'popover',
  autoFocus = false,
}: CompanySearchProps) {
  const [query, setQuery] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const router = useRouter();
  const { trackEngagement } = useEngagementPixel();
  const isList = variant === 'list';

  // Debounce da busca
  useEffect(() => {
    const term = query.trim();
    if (term.length < 1) {
      setCompanies([]);
      setShowResults(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/search-companies?q=${encodeURIComponent(term)}`);
        if (response.ok && !cancelled) {
          const data: CompanySearchResponse = await response.json();
          setCompanies(data.companies);
          setShowResults(true);
          setSelectedIndex(-1);
        }
      } catch (error) {
        console.error('Erro ao buscar empresas:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const handleCompanySelect = (company: Company) => {
    // Pixel de engajamento (apenas deslogados, uma vez por sessão)
    trackEngagement();

    setQuery('');
    setShowResults(false);
    setSelectedIndex(-1);

    if (onCompanySelect) {
      onCompanySelect(company);
    } else {
      router.push(getAssetUrl(company.ticker, company.assetType));
      onNavigate?.();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && showResults && !isList) {
      e.preventDefault();
      setShowResults(false);
      setSelectedIndex(-1);
      return;
    }
    if (!showResults || companies.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < companies.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case 'Enter':
        e.preventDefault();
        handleCompanySelect(companies[selectedIndex >= 0 ? selectedIndex : 0]);
        break;
    }
  };

  // Fecha o popover ao clicar fora
  useEffect(() => {
    if (isList) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isList]);

  const results = showResults ? (
    companies.length > 0 ? (
      <ul id={listboxId} role="listbox" aria-label="Resultados da busca" className={cn(!isList && 'max-h-80 overflow-y-auto')}>
        {companies.map((company, index) => (
          <li
            key={company.id}
            id={`${listboxId}-${index}`}
            role="option"
            aria-selected={selectedIndex === index}
            onClick={() => handleCompanySelect(company)}
            onMouseEnter={() => setSelectedIndex(index)}
            className={cn(
              'flex min-h-14 cursor-pointer items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 transition-colors',
              selectedIndex === index ? 'bg-accent' : 'hover:bg-accent'
            )}
          >
            <CompanyLogo logoUrl={company.logoUrl} companyName={company.name} ticker={company.ticker} size={isList ? 36 : 32} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{company.ticker}</span>
                <Badge variant="neutral">{ASSET_TYPE_LABEL[company.assetType] ?? company.assetType}</Badge>
                {company.sector && <span className="hidden truncate text-xs text-muted-foreground sm:inline">{company.sector}</span>}
              </div>
              <p className="truncate text-sm text-muted-foreground">{company.name}</p>
            </div>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
          </li>
        ))}
      </ul>
    ) : query.trim().length >= 1 && !loading ? (
      <p className="p-4 text-center text-sm text-muted-foreground">Nenhum ativo encontrado para &ldquo;{query}&rdquo;</p>
    ) : null
  ) : null;

  return (
    <div className={cn('relative w-full', !isList && 'max-w-md', className)}>
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <Input
          ref={inputRef}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          role="combobox"
          aria-expanded={showResults}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={selectedIndex >= 0 ? `${listboxId}-${selectedIndex}` : undefined}
          aria-label={placeholder}
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim().length >= 1 && companies.length > 0 && setShowResults(true)}
          className={cn('pr-10 pl-9 [&::-webkit-search-cancel-button]:hidden', isList && 'h-12 text-base md:h-11 md:text-base')}
        />
        {loading && (
          <Loader2
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            strokeWidth={1.75}
            aria-label="Buscando"
          />
        )}
      </div>

      {isList ? (
        <div ref={resultsRef} className="mt-3">
          {results}
        </div>
      ) : (
        results && (
          <div ref={resultsRef} className="absolute z-50 mt-2 w-full overflow-hidden rounded-lg border border-border bg-popover shadow-md">
            {results}
          </div>
        )
      )}
    </div>
  );
}
