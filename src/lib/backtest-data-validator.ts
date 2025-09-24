import { prisma } from '@/lib/prisma';
import { toNumber } from '@/lib/strategies/base-strategy';

// ===== INTERFACES =====

export interface DataAvailability {
  ticker: string;
  availableFrom: Date;
  availableTo: Date;
  totalMonths: number;
  missingMonths: number;
  dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
  warnings: string[];
}

export interface BacktestDataValidation {
  isValid: boolean;
  adjustedStartDate: Date;
  adjustedEndDate: Date;
  assetsAvailability: DataAvailability[];
  globalWarnings: string[];
  recommendations: string[];
}

interface CommonPeriod {
  startDate: Date;
  endDate: Date;
  monthsAvailable: number;
}

// ===== SERVIÇO DE VALIDAÇÃO =====

export class BacktestDataValidator {
  
  /**
   * Valida disponibilidade de dados históricos para todos os ativos
   */
  async validateBacktestData(
    assets: Array<{ ticker: string; allocation: number }>,
    requestedStartDate: Date,
    requestedEndDate: Date
  ): Promise<BacktestDataValidation> {
    console.log('🔍 Validando dados históricos para backtesting:', {
      assets: assets.map(a => a.ticker),
      period: `${requestedStartDate.toISOString().split('T')[0]} - ${requestedEndDate.toISOString().split('T')[0]}`
    });
    
    const assetsAvailability: DataAvailability[] = [];
    const globalWarnings: string[] = [];
    const recommendations: string[] = [];
    
    // Verificar dados para cada ativo
    for (const asset of assets) {
      const availability = await this.checkAssetDataAvailability(
        asset.ticker, 
        requestedStartDate, 
        requestedEndDate
      );
      assetsAvailability.push(availability);
    }
    
    // Encontrar período comum mais amplo possível
    const commonPeriod = this.findOptimalCommonPeriod(
      assetsAvailability, 
      requestedStartDate, 
      requestedEndDate
    );
    
    // Gerar warnings e recomendações
    this.generateWarningsAndRecommendations(
      assetsAvailability, 
      commonPeriod, 
      globalWarnings, 
      recommendations
    );
    
    const isValid = commonPeriod.monthsAvailable >= 12; // Mínimo 1 ano
    
    console.log('✅ Validação concluída:', {
      isValid,
      adjustedPeriod: `${commonPeriod.startDate.toISOString().split('T')[0]} - ${commonPeriod.endDate.toISOString().split('T')[0]}`,
      monthsAvailable: commonPeriod.monthsAvailable,
      warnings: globalWarnings.length
    });
    
    return {
      isValid,
      adjustedStartDate: commonPeriod.startDate,
      adjustedEndDate: commonPeriod.endDate,
      assetsAvailability,
      globalWarnings,
      recommendations
    };
  }
  
  /**
   * Verifica disponibilidade de dados para um ativo específico
   */
  private async checkAssetDataAvailability(
    ticker: string,
    startDate: Date,
    endDate: Date
  ): Promise<DataAvailability> {
    
    const company = await prisma.company.findUnique({
      where: { ticker },
      include: {
        historicalPrices: {
          where: {
            interval: '1mo',
            date: {
              gte: startDate,
              lte: endDate
            }
          },
          orderBy: { date: 'asc' }
        }
      }
    });
    
    if (!company || company.historicalPrices.length === 0) {
      return {
        ticker,
        availableFrom: new Date(),
        availableTo: new Date(),
        totalMonths: 0,
        missingMonths: 0,
        dataQuality: 'poor',
        warnings: [`Nenhum dado histórico encontrado para ${ticker}`]
      };
    }
    
    const prices = company.historicalPrices;
    const availableFrom = prices[0].date;
    const availableTo = prices[prices.length - 1].date;
    
    // Calcular meses esperados vs disponíveis
    const expectedMonths = this.getMonthsDifference(startDate, endDate);
    const actualMonths = prices.length;
    const missingMonths = Math.max(0, expectedMonths - actualMonths);
    
    // Determinar qualidade dos dados
    const completeness = actualMonths / expectedMonths;
    let dataQuality: DataAvailability['dataQuality'];
    if (completeness >= 0.95) dataQuality = 'excellent';
    else if (completeness >= 0.85) dataQuality = 'good';
    else if (completeness >= 0.70) dataQuality = 'fair';
    else dataQuality = 'poor';
    
    // Gerar warnings específicos
    const warnings: string[] = [];
    if (missingMonths > 0) {
      warnings.push(`${missingMonths} meses com dados faltantes`);
    }
    if (availableFrom > startDate) {
      warnings.push(`Dados disponíveis apenas a partir de ${availableFrom.toLocaleDateString('pt-BR')}`);
    }
    if (availableTo < endDate) {
      warnings.push(`Dados disponíveis apenas até ${availableTo.toLocaleDateString('pt-BR')}`);
    }
    
    // Verificar qualidade dos preços (valores zerados ou muito baixos)
    const invalidPrices = prices.filter(p => {
      const closePrice = toNumber(p.close);
      const adjustedClosePrice = toNumber(p.adjustedClose);
      return (closePrice !== null && closePrice <= 0) || (adjustedClosePrice !== null && adjustedClosePrice <= 0);
    }).length;
    
    if (invalidPrices > 0) {
      warnings.push(`${invalidPrices} registros com preços inválidos`);
    }
    
    return {
      ticker,
      availableFrom,
      availableTo,
      totalMonths: actualMonths,
      missingMonths,
      dataQuality,
      warnings
    };
  }
  
  /**
   * Encontra o período comum otimizado para todos os ativos
   */
  private findOptimalCommonPeriod(
    assetsAvailability: DataAvailability[],
    requestedStartDate: Date,
    requestedEndDate: Date
  ): CommonPeriod {
    
    // Se não há ativos com dados, retornar período original
    const assetsWithData = assetsAvailability.filter(a => a.totalMonths > 0);
    if (assetsWithData.length === 0) {
      return {
        startDate: requestedStartDate,
        endDate: requestedEndDate,
        monthsAvailable: 0
      };
    }
    
    // Encontrar a data de início mais tardia (quando todos os ativos têm dados)
    const latestStartDate = assetsWithData.reduce((latest, asset) => {
      return asset.availableFrom > latest ? asset.availableFrom : latest;
    }, requestedStartDate);
    
    // Encontrar a data de fim mais cedo (quando todos ainda têm dados)
    const earliestEndDate = assetsWithData.reduce((earliest, asset) => {
      return asset.availableTo < earliest ? asset.availableTo : earliest;
    }, requestedEndDate);
    
    const monthsAvailable = this.getMonthsDifference(latestStartDate, earliestEndDate);
    
    return {
      startDate: latestStartDate,
      endDate: earliestEndDate,
      monthsAvailable: Math.max(0, monthsAvailable)
    };
  }
  
  /**
   * Gera warnings e recomendações baseados na análise
   */
  private generateWarningsAndRecommendations(
    assetsAvailability: DataAvailability[],
    commonPeriod: CommonPeriod,
    globalWarnings: string[],
    recommendations: string[]
  ): void {
    
    const assetsWithData = assetsAvailability.filter(a => a.totalMonths > 0);
    const assetsWithoutData = assetsAvailability.filter(a => a.totalMonths === 0);
    const poorQualityAssets = assetsAvailability.filter(a => a.dataQuality === 'poor');
    const fairQualityAssets = assetsAvailability.filter(a => a.dataQuality === 'fair');
    
    // Warnings globais
    if (assetsWithoutData.length > 0) {
      globalWarnings.push(
        `${assetsWithoutData.length} ativo(s) sem dados históricos: ${assetsWithoutData.map(a => a.ticker).join(', ')}`
      );
    }
    
    if (poorQualityAssets.length > 0) {
      globalWarnings.push(
        `${poorQualityAssets.length} ativo(s) com qualidade de dados ruim: ${poorQualityAssets.map(a => a.ticker).join(', ')}`
      );
    }
    
    if (fairQualityAssets.length > 0) {
      globalWarnings.push(
        `${fairQualityAssets.length} ativo(s) com qualidade de dados regular: ${fairQualityAssets.map(a => a.ticker).join(', ')}`
      );
    }
    
    if (commonPeriod.monthsAvailable < 12) {
      globalWarnings.push(
        `Período disponível (${commonPeriod.monthsAvailable} meses) é menor que o mínimo recomendado (12 meses)`
      );
    }
    
    if (commonPeriod.monthsAvailable < 24) {
      globalWarnings.push(
        'Período curto pode resultar em métricas menos confiáveis'
      );
    }
    
    // Recomendações
    if (assetsWithoutData.length > 0) {
      recommendations.push(
        'Considere remover ativos sem dados históricos ou escolher ativos alternativos'
      );
    }
    
    if (poorQualityAssets.length > 0) {
      recommendations.push(
        'Ativos com dados de baixa qualidade podem afetar a precisão dos resultados'
      );
    }
    
    if (commonPeriod.monthsAvailable >= 12 && commonPeriod.monthsAvailable < 36) {
      recommendations.push(
        'Para resultados mais robustos, considere um período de pelo menos 3 anos'
      );
    }
    
    if (assetsAvailability.length > 10) {
      recommendations.push(
        'Carteiras com muitos ativos podem ter maior complexidade de rebalanceamento'
      );
    }
    
    const avgQuality = assetsWithData.reduce((sum, asset) => {
      const qualityScore = asset.dataQuality === 'excellent' ? 4 : 
                          asset.dataQuality === 'good' ? 3 :
                          asset.dataQuality === 'fair' ? 2 : 1;
      return sum + qualityScore;
    }, 0) / assetsWithData.length;
    
    if (avgQuality >= 3.5) {
      recommendations.push('Qualidade geral dos dados é excelente para backtesting');
    } else if (avgQuality >= 2.5) {
      recommendations.push('Qualidade geral dos dados é adequada para backtesting');
    } else {
      recommendations.push('Considere revisar a seleção de ativos para melhor qualidade de dados');
    }
  }
  
  /**
   * Calcula diferença em meses entre duas datas
   */
  private getMonthsDifference(startDate: Date, endDate: Date): number {
    if (startDate > endDate) return 0;
    
    return (endDate.getFullYear() - startDate.getFullYear()) * 12 + 
           (endDate.getMonth() - startDate.getMonth()) + 1;
  }
  
  /**
   * Verifica se um ticker existe no banco de dados
   */
  async validateTickers(tickers: string[]): Promise<{
    validTickers: string[];
    invalidTickers: string[];
  }> {
    const companies = await prisma.company.findMany({
      where: { ticker: { in: tickers } },
      select: { ticker: true }
    });
    
    const validTickers = companies.map(c => c.ticker);
    const invalidTickers = tickers.filter(t => !validTickers.includes(t));
    
    return { validTickers, invalidTickers };
  }
  
  /**
   * Obtém estatísticas gerais de disponibilidade de dados
   */
  async getDataAvailabilityStats(): Promise<{
    totalCompanies: number;
    companiesWithHistoricalData: number;
    oldestDataDate: Date | null;
    newestDataDate: Date | null;
    avgDataPointsPerCompany: number;
  }> {
    const totalCompanies = await prisma.company.count();
    
    const companiesWithData = await prisma.company.count({
      where: {
        historicalPrices: {
          some: { interval: '1mo' }
        }
      }
    });
    
    const dateStats = await prisma.historicalPrice.aggregate({
      where: { interval: '1mo' },
      _min: { date: true },
      _max: { date: true },
      _count: { id: true }
    });
    
    return {
      totalCompanies,
      companiesWithHistoricalData: companiesWithData,
      oldestDataDate: dateStats._min.date,
      newestDataDate: dateStats._max.date,
      avgDataPointsPerCompany: companiesWithData > 0 ? 
        (dateStats._count.id || 0) / companiesWithData : 0
    };
  }
}
