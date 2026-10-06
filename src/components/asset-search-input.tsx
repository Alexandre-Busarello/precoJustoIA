'use client';

import { useState, useEffect, useId, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CompanySearchResult {
  id: number;
  ticker: string;
  name: string;
  sector?: string | null;
  logoUrl?: string | null;
  assetType?: string;
}

interface AssetSearchInputProps {
  label?: string;
  placeholder?: string;
  value?: string; // Ticker selecionado (para exibir)
  initialValue?: string; // Valor inicial para pré-preenchimento
  onCompanySelect: (company: CompanySearchResult) => void;
  onQueryChange?: (query: string) => void; // Para sincronizar quando usuário digita
  className?: string;
  disabled?: boolean;
  error?: string;
  showResults?: boolean; // Controlar se mostra resultados ou não
  minSearchLength?: number; // Tamanho mínimo para iniciar busca
  debounceMs?: number; // Tempo de debounce em ms
  id?: string;
  /** Enter sem item destacado na lista (ex.: calcular com o ticker digitado). */
  onSubmit?: () => void;
}

export function AssetSearchInput({
  label,
  placeholder = "Digite o ticker ou nome da empresa...",
  value = "",
  initialValue = "",
  onCompanySelect,
  onQueryChange,
  className,
  disabled = false,
  error,
  showResults: controlledShowResults,
  minSearchLength = 2,
  debounceMs = 300,
  id,
  onSubmit,
}: AssetSearchInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const listId = `${inputId}-results`;
  // Inicializar com initialValue ou value
  const [query, setQuery] = useState(() => {
    return (initialValue || value || "").toUpperCase();
  });
  const [searchResults, setSearchResults] = useState<CompanySearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [internalShowResults, setInternalShowResults] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const prevValueRef = useRef<string>(value || initialValue || "");

  // Usar showResults controlado ou interno
  const showResults = controlledShowResults !== undefined ? controlledShowResults : internalShowResults;

  // Sincronizar query com value/initialValue quando mudar externamente
  useEffect(() => {
    const newValue = (initialValue || value || "").toUpperCase();
    const prevValue = prevValueRef.current.toUpperCase();
    
    // Só atualizar se o valor realmente mudou
    if (newValue !== prevValue || (newValue && newValue !== query.toUpperCase())) {
      prevValueRef.current = newValue;
      if (newValue !== query.toUpperCase()) {
        setQuery(newValue);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValue, value]);

  // Buscar empresas com debounce
  const searchCompanies = async (term: string) => {
    if (term.length < minSearchLength) {
      setSearchResults([]);
      setInternalShowResults(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await fetch(`/api/search-companies?q=${encodeURIComponent(term)}`);
      
      if (!response.ok) {
        throw new Error('Erro na busca de empresas');
      }

      const data = await response.json();
      setSearchResults(data.companies || []);
      setInternalShowResults(true);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Erro na busca:', error);
      setSearchResults([]);
      setInternalShowResults(false);
    } finally {
      setIsSearching(false);
    }
  };

  // Função para busca com debounce
  const handleSearchChange = (newValue: string) => {
    setQuery(newValue);
    
    // Notificar componente pai sobre mudanças no query
    if (onQueryChange) {
      onQueryChange(newValue.toUpperCase());
    }
    
    // Limpar timeout anterior
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    
    // Definir novo timeout
    if (newValue.length >= minSearchLength) {
      const timeout = setTimeout(() => {
        if (document.activeElement !== inputRef.current) return;
        searchCompanies(newValue);
      }, debounceMs);
      searchTimeoutRef.current = timeout;
    } else {
      setSearchResults([]);
      setInternalShowResults(false);
    }
  };

  // Limpar timeout ao desmontar
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Fechar resultados ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setInternalShowResults(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Navegação por teclado
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || searchResults.length === 0) {
      if (e.key === 'Enter' && onSubmit) {
        e.preventDefault();
        onSubmit();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => prev < searchResults.length - 1 ? prev + 1 : prev);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < searchResults.length) {
          handleCompanySelect(searchResults[selectedIndex]);
        } else if (onSubmit) {
          setInternalShowResults(false);
          onSubmit();
        }
        break;
      case 'Escape':
        setInternalShowResults(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleCompanySelect = (company: CompanySearchResult) => {
    const tickerUpper = company.ticker.toUpperCase();
    setQuery(tickerUpper);
    setInternalShowResults(false);
    setSelectedIndex(-1);
    setSearchResults([]);
    // Chamar callback para atualizar estado pai
    onCompanySelect(company);
  };

  const listOpen = showResults && searchResults.length > 0;

  return (
    <div className={cn("relative space-y-2", className)}>
      {label && <Label htmlFor={inputId}>{label}</Label>}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <Input
          ref={inputRef}
          id={inputId}
          type="text"
          role="combobox"
          aria-expanded={listOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          enterKeyHint={onSubmit ? 'go' : 'search'}
          value={query}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={(e) => {
            // Fecha a lista quando o foco sai por teclado. Cliques na lista não tiram o foco
            // (preventDefault no mousedown do listbox), então um clique longo ainda seleciona.
            if (resultsRef.current?.contains(e.relatedTarget as Node | null)) return;
            setInternalShowResults(false);
            setSelectedIndex(-1);
          }}
          onFocus={() => {
            if (query.length >= minSearchLength && searchResults.length > 0) {
              setInternalShowResults(true);
            }
          }}
          placeholder={placeholder}
          className="pl-9"
          disabled={disabled}
        />
        {isSearching && (
          <Loader2
            className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            strokeWidth={1.75}
            aria-hidden="true"
          />
        )}
      </div>

      {listOpen && (
        <div
          ref={resultsRef}
          id={listId}
          role="listbox"
          onMouseDown={(e) => e.preventDefault()}
          className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-md"
        >
          {searchResults.map((company, index) => (
            <div
              key={company.ticker}
              role="option"
              aria-selected={selectedIndex === index}
              className={cn(
                "flex min-h-11 cursor-pointer items-center justify-between gap-2 border-b border-border px-3 py-2 transition-colors last:border-b-0 hover:bg-accent",
                selectedIndex === index && "bg-accent"
              )}
              onClick={() => handleCompanySelect(company)}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{company.ticker}</p>
                <p className="truncate text-xs text-muted-foreground">{company.name}</p>
              </div>
              {company.sector && (
                <Badge variant="neutral" className="ml-2 shrink-0">
                  {company.sector}
                </Badge>
              )}
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-negative">{error}</p>}
    </div>
  );
}
