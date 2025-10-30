import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CompanyLogo } from '@/components/company-logo';
import { CompanySizeBadge } from '@/components/company-size-badge';
import { 
  Building2, 
  TrendingUp, 
  ArrowRight,
  Eye
} from 'lucide-react';

interface RelatedCompany {
  ticker: string;
  name: string;
  sector: string | null;
  logoUrl?: string | null;
  marketCap?: number | null;
  assetType?: string;
}

interface RelatedCompaniesProps {
  companies: RelatedCompany[];
  currentTicker: string;
  currentSector?: string | null;
  currentIndustry?: string | null;
  currentAssetType?: string;
}

export function RelatedCompanies({ 
  companies, 
  currentTicker, 
  currentSector,
  currentAssetType = 'STOCK'
}: RelatedCompaniesProps) {
  if (!companies || companies.length === 0) {
    return null;
  }

  const getAssetUrl = (ticker: string, assetType?: string) => {
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
  };

  const getCurrentAssetUrl = (ticker: string) => {
    return getAssetUrl(ticker, currentAssetType);
  };

  return (
    <Card className="mt-8">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-600" />
          Empresas Relacionadas
          {currentSector && (
            <Badge variant="outline" className="ml-2">
              {currentSector}
            </Badge>
          )}
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Explore empresas similares e outras do mesmo setor para comparar oportunidades
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {companies.map((company) => (
            <Link
              key={company.ticker}
              href={getAssetUrl(company.ticker, company.assetType)}
              className="group block"
            >
              <div className="border rounded-lg p-4 hover:shadow-md hover:border-blue-200 transition-all duration-200 group-hover:bg-blue-50/50">
                <div className="flex items-start gap-3">
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
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm group-hover:text-blue-600 transition-colors">
                        {company.ticker}
                      </h4>
                      {company.marketCap && (
                        <CompanySizeBadge marketCap={company.marketCap} />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
                      {company.name}
                    </p>
                    
                    {/* Call to action */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1 text-xs text-blue-600 group-hover:text-blue-700">
                        <Eye className="w-3 h-3" />
                        <span>Ver análise</span>
                      </div>
                      <ArrowRight className="w-3 h-3 text-muted-foreground group-hover:text-blue-600 transition-colors" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* Link para comparação básica - apenas para ações */}
        {companies.length >= 2 && currentAssetType === 'STOCK' && (
          <div className="mt-6 pt-4 border-t">
            <Link
              href={`/compara-acoes/${currentTicker}/${companies.slice(0, 3).map(c => c.ticker).join('/')}`}
              className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              <TrendingUp className="w-4 h-4" />
              Comparar com outras empresas do setor
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
