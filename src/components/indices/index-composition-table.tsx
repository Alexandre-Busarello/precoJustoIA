/**
 * Tabela de Composição do Índice
 * Lista ativos com blur para usuários Free
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CompanyLogo } from '@/components/company-logo';
import { usePremiumStatus } from '@/hooks/use-premium-status';
import { Lock } from 'lucide-react';
import Link from 'next/link';

interface CompositionAsset {
  ticker: string;
  name: string;
  logoUrl: string | null;
  sector: string | null;
  targetWeight: number;
  dividendYield: number | null;
}

interface IndexCompositionTableProps {
  composition: CompositionAsset[];
}

export function IndexCompositionTable({ composition }: IndexCompositionTableProps) {
  const { isPremium } = usePremiumStatus();

  const formatPercentage = (value: number) => {
    return `${(value * 100).toFixed(1)}%`;
  };

  // Mostrar apenas 3 ativos para usuários Free, resto com blur
  const visibleAssets = isPremium ? composition : composition.slice(0, 3);
  const blurredAssets = isPremium ? [] : composition.slice(3);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Composição do Índice</span>
          {!isPremium && (
            <Badge variant="outline" className="text-xs">
              <Lock className="h-3 w-3 mr-1" />
              Premium
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 px-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                  Ativo
                </th>
                <th className="text-right py-2 px-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                  Peso
                </th>
                <th className="text-right py-2 px-2 text-sm font-medium text-gray-600 dark:text-gray-400">
                  DY
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleAssets.map((asset) => {
                return (
                  <tr key={asset.ticker} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="py-3 px-2">
                      <Link 
                        href={`/acao/${asset.ticker}`}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <CompanyLogo 
                          ticker={asset.ticker}
                          logoUrl={asset.logoUrl}
                          companyName={asset.name}
                          size={32}
                        />
                        <div>
                          <div className="font-medium">{asset.ticker}</div>
                          <div className="text-xs text-gray-500">{asset.name}</div>
                        </div>
                      </Link>
                    </td>
                    <td className="text-right py-3 px-2 font-medium">
                      {formatPercentage(asset.targetWeight)}
                    </td>
                    <td className="text-right py-3 px-2 text-sm">
                      {asset.dividendYield !== null 
                        ? `${asset.dividendYield.toFixed(2)}%`
                        : 'N/A'}
                    </td>
                  </tr>
                );
              })}
              
              {/* Assets com blur para Free users */}
              {blurredAssets.map((asset, index) => (
                <tr 
                  key={`blurred-${index}`} 
                  className="border-b relative overflow-hidden"
                  style={{ filter: 'blur(4px)', pointerEvents: 'none' }}
                >
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-gray-300 rounded" />
                      <div>
                        <div className="font-medium bg-gray-300 h-4 w-16 rounded" />
                        <div className="text-xs bg-gray-200 h-3 w-24 rounded mt-1" />
                      </div>
                    </div>
                  </td>
                  <td className="text-right py-3 px-2">
                    <div className="bg-gray-300 h-4 w-12 rounded ml-auto" />
                  </td>
                  <td className="text-right py-3 px-2">
                    <div className="bg-gray-300 h-4 w-12 rounded ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!isPremium && blurredAssets.length > 0 && (
            <div className="mt-4 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                {blurredAssets.length} ativo{blurredAssets.length > 1 ? 's' : ''} oculto{blurredAssets.length > 1 ? 's' : ''}
              </p>
              <Link 
                href="/planos"
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Assine Premium para ver composição completa →
              </Link>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

