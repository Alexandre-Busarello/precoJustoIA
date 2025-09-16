'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { CompanyLogo } from '@/components/company-logo';
import { Badge } from '@/components/ui/badge';
import { Search, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Company {
  id: number;
  ticker: string;
  name: string;
  sector: string | null;
  logoUrl: string | null;
}

interface CompanySearchResponse {
  companies: Company[];
}

interface CompanySearchProps {
  placeholder?: string;
  className?: string;
}

export default function CompanySearch({ 
  placeholder = "Buscar empresas por ticker ou nome...", 
  className 
}: CompanySearchProps) {
  const [query, setQuery] = useState('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim().length >= 1) {
        searchCompanies(query.trim());
      } else {
        setCompanies([]);
        setShowResults(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const searchCompanies = async (searchQuery: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/search-companies?q=${encodeURIComponent(searchQuery)}`);
      
      if (response.ok) {
        const data: CompanySearchResponse = await response.json();
        setCompanies(data.companies);
        setShowResults(true);
        setSelectedIndex(-1);
      }
    } catch (error) {
      console.error('Erro ao buscar empresas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleCompanySelect = (company: Company) => {
    setQuery('');
    setShowResults(false);
    setSelectedIndex(-1);
    router.push(`/acao/${company.ticker}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || companies.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => prev < companies.length - 1 ? prev + 1 : prev);
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < companies.length) {
          handleCompanySelect(companies[selectedIndex]);
        }
        break;
      case 'Escape':
        setShowResults(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (resultsRef.current && !resultsRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowResults(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Global keyboard shortcut Ctrl+K
  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return (
    <div className={cn("relative w-full max-w-md", className)}>
      {/* Input de busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => query.trim().length >= 1 && companies.length > 0 && setShowResults(true)}
          className="pl-10 pr-12 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}
        {!loading && query.trim().length === 0 && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 hidden md:block">
            <kbd className="px-2 py-1 text-xs bg-muted rounded border">
              Ctrl+K
            </kbd>
          </div>
        )}
      </div>

      {/* Resultados do autocomplete */}
      {showResults && (
        <div ref={resultsRef} className="absolute z-50 w-full mt-2">
          <Card className="shadow-lg border-2">
            <CardContent className="p-0">
              {companies.length > 0 ? (
                <div className="max-h-80 overflow-y-auto">
                  {companies.map((company, index) => (
                    <div
                      key={company.id}
                      onClick={() => handleCompanySelect(company)}
                      className={cn(
                        "flex items-center space-x-3 p-4 cursor-pointer border-b last:border-b-0 transition-colors",
                        "hover:bg-muted/50",
                        selectedIndex === index && "bg-muted/70"
                      )}
                    >
                      {/* Logo da empresa */}
                      <div className="flex-shrink-0">
                        <CompanyLogo
                          logoUrl={company.logoUrl}
                          companyName={company.name}
                          ticker={company.ticker}
                          size={40}
                        />
                      </div>

                      {/* Informações da empresa */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-bold text-sm">{company.ticker}</span>
                          {company.sector && (
                            <Badge variant="secondary" className="text-xs">
                              {company.sector}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {company.name}
                        </p>
                      </div>

                      {/* Ícone de ação */}
                      <div className="flex-shrink-0">
                        <TrendingUp className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : query.trim().length >= 1 && !loading ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  Nenhuma empresa encontrada para &ldquo;{query}&rdquo;
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
