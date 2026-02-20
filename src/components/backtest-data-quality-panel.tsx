'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Info,
  TrendingUp,
  Shield,
  X,
  BarChart3
} from 'lucide-react';

// Interfaces
interface DataAvailability {
  ticker: string;
  availableFrom: Date;
  availableTo: Date;
  totalMonths: number;
  missingMonths: number;
  dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
  warnings: string[];
}

interface BacktestDataValidation {
  isValid: boolean;
  adjustedStartDate: Date;
  adjustedEndDate: Date;
  assetsAvailability: DataAvailability[];
  globalWarnings: string[];
  recommendations: string[];
}

interface BacktestDataQualityPanelProps {
  validation: BacktestDataValidation;
  onAccept: () => void;
  onCancel: () => void;
}

export function BacktestDataQualityPanel({ 
  validation, 
  onAccept, 
  onCancel 
}: BacktestDataQualityPanelProps) {
  
  // Funções de formatação
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('pt-BR');
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'bg-green-500';
      case 'good': return 'bg-blue-500';
      case 'fair': return 'bg-yellow-500';
      case 'poor': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getQualityLabel = (quality: string) => {
    switch (quality) {
      case 'excellent': return 'Excelente';
      case 'good': return 'Boa';
      case 'fair': return 'Regular';
      case 'poor': return 'Ruim';
      default: return 'Desconhecida';
    }
  };

  const getQualityIcon = (quality: string) => {
    switch (quality) {
      case 'excellent': return <CheckCircle className="w-4 h-4" />;
      case 'good': return <CheckCircle className="w-4 h-4" />;
      case 'fair': return <AlertTriangle className="w-4 h-4" />;
      case 'poor': return <XCircle className="w-4 h-4" />;
      default: return <Info className="w-4 h-4" />;
    }
  };

  // Estatísticas gerais
  const totalAssets = validation.assetsAvailability.length;
  const assetsWithData = validation.assetsAvailability.filter(a => a.totalMonths > 0).length;
  const excellentQuality = validation.assetsAvailability.filter(a => a.dataQuality === 'excellent').length;
  const goodQuality = validation.assetsAvailability.filter(a => a.dataQuality === 'good').length;
  const fairQuality = validation.assetsAvailability.filter(a => a.dataQuality === 'fair').length;
  const poorQuality = validation.assetsAvailability.filter(a => a.dataQuality === 'poor').length;

  // Converter strings de data para objetos Date se necessário
  const adjustedStartDate = typeof validation.adjustedStartDate === 'string' 
    ? new Date(validation.adjustedStartDate) 
    : validation.adjustedStartDate;
  const adjustedEndDate = typeof validation.adjustedEndDate === 'string' 
    ? new Date(validation.adjustedEndDate) 
    : validation.adjustedEndDate;

  // Função auxiliar para converter datas dos ativos
  const ensureDate = (date: Date | string): Date => {
    return typeof date === 'string' ? new Date(date) : date;
  };

  const originalPeriodMonths = Math.round(
    (adjustedEndDate.getTime() - adjustedStartDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col my-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-900 border-b p-4 sm:p-6 flex-shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 flex-shrink-0" />
                <span className="truncate">Validação de Dados Históricos</span>
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Análise da qualidade dos dados antes da execução
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onCancel} className="flex-shrink-0">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1 min-h-0">
          {/* Status Geral */}
          <Card className={`border-2 ${validation.isValid ? 'border-green-200 bg-green-50 dark:bg-green-950/20' : 'border-red-200 bg-red-50 dark:bg-red-950/20'}`}>
            <CardHeader>
              <CardTitle className={`flex items-center gap-2 ${validation.isValid ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                {validation.isValid ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
                {validation.isValid ? 'Dados Válidos para Backtesting' : 'Dados Insuficientes'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Período Ajustado</p>
                  <p className="font-semibold">
                    {formatDate(adjustedStartDate)} - {formatDate(adjustedEndDate)}
                  </p>
                  <p className="text-xs text-gray-500">{originalPeriodMonths} meses</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Ativos com Dados</p>
                  <p className="font-semibold">{assetsWithData} de {totalAssets}</p>
                  <p className="text-xs text-gray-500">
                    {((assetsWithData / totalAssets) * 100).toFixed(0)}% disponível
                  </p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Qualidade Média</p>
                  <div className="flex items-center gap-2">
                    {excellentQuality + goodQuality >= totalAssets * 0.7 ? (
                      <Badge className="bg-green-500 text-xs">Boa</Badge>
                    ) : fairQuality >= totalAssets * 0.5 ? (
                      <Badge className="bg-yellow-500 text-xs">Regular</Badge>
                    ) : (
                      <Badge className="bg-red-500 text-xs">Ruim</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Status</p>
                  <Badge variant={validation.isValid ? "default" : "destructive"} className={validation.isValid ? "bg-green-500" : ""}>
                    {validation.isValid ? 'Aprovado' : 'Rejeitado'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detalhes por Ativo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Qualidade dos Dados por Ativo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {validation.assetsAvailability.map((asset) => (
                  <div key={asset.ticker} className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h4 className="font-semibold">{asset.ticker}</h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {formatDate(ensureDate(asset.availableFrom))} - {formatDate(ensureDate(asset.availableTo))}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`${getQualityColor(asset.dataQuality)} text-white text-xs`}>
                          {getQualityIcon(asset.dataQuality)}
                          <span className="ml-1">{getQualityLabel(asset.dataQuality)}</span>
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-3">
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">Meses Disponíveis</p>
                        <p className="font-semibold">{asset.totalMonths}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">Meses Faltantes</p>
                        <p className="font-semibold text-red-600">{asset.missingMonths}</p>
                      </div>
                      <div>
                        <p className="text-gray-600 dark:text-gray-400">Completude</p>
                        <p className="font-semibold">
                          {asset.totalMonths > 0 ? 
                            ((asset.totalMonths / (asset.totalMonths + asset.missingMonths)) * 100).toFixed(0) + '%' : 
                            '0%'
                          }
                        </p>
                      </div>
                    </div>

                    {/* Warnings específicos do ativo */}
                    {asset.warnings.length > 0 && (
                      <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                        <h5 className="font-semibold text-amber-800 dark:text-amber-200 text-sm mb-1">
                          Observações:
                        </h5>
                        <ul className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
                          {asset.warnings.map((warning, index) => (
                            <li key={index}>• {warning}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Warnings Globais */}
          {validation.globalWarnings.length > 0 && (
            <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-orange-800 dark:text-orange-200">
                  <AlertTriangle className="w-5 h-5" />
                  Avisos Importantes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-orange-700 dark:text-orange-300">
                  {validation.globalWarnings.map((warning, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Recomendações */}
          {validation.recommendations.length > 0 && (
            <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                  <Info className="w-5 h-5" />
                  Recomendações
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
                  {validation.recommendations.map((recommendation, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span>{recommendation}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Resumo de Qualidade */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Resumo da Qualidade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
                <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">{excellentQuality}</p>
                  <p className="text-sm text-green-700 dark:text-green-300">Excelente</p>
                </div>
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">{goodQuality}</p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">Boa</p>
                </div>
                <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                  <p className="text-2xl font-bold text-yellow-600">{fairQuality}</p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300">Regular</p>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
                  <p className="text-2xl font-bold text-red-600">{poorQuality}</p>
                  <p className="text-sm text-red-700 dark:text-red-300">Ruim</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer com Ações */}
        <div className="sticky bottom-0 bg-white dark:bg-gray-900 border-t p-4 sm:p-6 flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-sm text-gray-600 dark:text-gray-400 order-2 sm:order-1">
              {validation.isValid ? (
                <span className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Dados suficientes para executar o backtesting</span>
                </span>
              ) : (
                <span className="flex items-center gap-2 text-red-600">
                  <XCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Dados insuficientes - ajuste a configuração</span>
                </span>
              )}
            </div>
            
            <div className="flex flex-col-reverse sm:flex-row gap-3 order-1 sm:order-2 w-full sm:w-auto">
              <Button variant="outline" onClick={onCancel} className="w-full sm:w-auto min-h-[44px]">
                Cancelar
              </Button>
              <Button 
                onClick={onAccept} 
                disabled={!validation.isValid}
                className={`w-full sm:w-auto min-h-[44px] ${validation.isValid ? 'bg-green-600 hover:bg-green-700' : ''}`}
              >
                {validation.isValid ? (
                  <>
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Continuar Simulação
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 mr-2" />
                    Dados Insuficientes
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
