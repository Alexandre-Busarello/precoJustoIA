'use client';

import { useState, useEffect, useRef } from 'react';
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
  debounceMs = 300
}: AssetSearchInputProps) {
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
    if (!showResults || searchResults.length === 0) return;

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

  return (
    <div className={cn("space-y-2 relative", className)}>
      {label && <Label>{label}</Label>}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (query.length >= minSearchLength && searchResults.length > 0) {
              setInternalShowResults(true);
            }
          }}
          placeholder={placeholder}
          className={cn("pl-10", error && "border-red-500")}
          disabled={disabled}
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 animate-spin text-gray-400" />
        )}
      </div>

      {/* Resultados da Busca */}
      {showResults && searchResults.length > 0 && (
        <div
          ref={resultsRef}
          className="absolute z-50 w-full mt-1 border rounded-lg bg-white dark:bg-gray-900 shadow-lg max-h-60 overflow-y-auto"
        >
          {searchResults.map((company, index) => (
            <div
              key={company.ticker}
              className={cn(
                "p-3 cursor-pointer border-b last:border-b-0 transition-colors",
                "hover:bg-gray-50 dark:hover:bg-gray-800",
                selectedIndex === index && "bg-gray-100 dark:bg-gray-800"
              )}
              onClick={() => handleCompanySelect(company)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{company.ticker}</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{company.name}</p>
                </div>
                {company.sector && (
                  <Badge variant="outline" className="text-xs ml-2 flex-shrink-0">
                    {company.sector}
                  </Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
}

