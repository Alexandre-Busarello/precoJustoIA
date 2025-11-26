import { AbstractStrategy } from './base-strategy';
import { ScreeningParams, CompanyData, StrategyAnalysis, RankBuilderResult, ScreeningFilter } from './types';
import { toNumber } from './base-strategy';
import { GrahamStrategy } from './graham-strategy';

/**
 * Estratégia de Screening Customizável
 * Permite aplicar filtros personalizados em múltiplos indicadores
 */
export class ScreeningStrategy extends AbstractStrategy<ScreeningParams> {
  name = 'Screening de Ações';

  /**
   * Valida se um valor está dentro do range especificado no filtro
   */
  private isValueInRange(value: number | null, filter: ScreeningFilter | undefined): boolean {
    if (!filter || !filter.enabled) return true; // Filtro desativado, aceita qualquer valor
    if (value === null) return true; // Sem dados, IGNORA o filtro (não reprova)
    
    // Verifica min
    if (filter.min !== undefined && value < filter.min) return false;
    
    // Verifica max
    if (filter.max !== undefined && value > filter.max) return false;
    
    return true;
  }

  /**
   * Conta quantos filtros estão ativos
   */
  private countActiveFilters(params: ScreeningParams): number {
    let count = 0;
    
    // Valuation
    if (params.plFilter?.enabled) count++;
    if (params.pvpFilter?.enabled) count++;
    if (params.evEbitdaFilter?.enabled) count++;
    if (params.psrFilter?.enabled) count++;
    
    // Rentabilidade
    if (params.roeFilter?.enabled) count++;
    if (params.roicFilter?.enabled) count++;
    if (params.roaFilter?.enabled) count++;
    if (params.margemLiquidaFilter?.enabled) count++;
    if (params.margemEbitdaFilter?.enabled) count++;
    
    // Crescimento
    if (params.cagrLucros5aFilter?.enabled) count++;
    if (params.cagrReceitas5aFilter?.enabled) count++;
    
    // Dividendos
    if (params.dyFilter?.enabled) count++;
    if (params.payoutFilter?.enabled) count++;
    
    // Endividamento & Liquidez
    if (params.dividaLiquidaPlFilter?.enabled) count++;
    if (params.liquidezCorrenteFilter?.enabled) count++;
    if (params.dividaLiquidaEbitdaFilter?.enabled) count++;
    
    // Market Cap
    if (params.marketCapFilter?.enabled) count++;
    
    // Score Geral
    if (params.overallScoreFilter?.enabled) count++;
    
    // Graham Upside
    if (params.grahamUpsideFilter?.enabled) count++;
    
    // Setores e Indústrias
    if (params.selectedSectors && params.selectedSectors.length > 0) count++;
    if (params.selectedIndustries && params.selectedIndustries.length > 0) count++;
    
    return count;
  }

  /**
   * Gera lista de critérios aplicados
   */
  private generateCriteria(
    companyData: CompanyData,
    params: ScreeningParams
  ): { label: string; value: boolean; description: string }[] {
    const criteria: { label: string; value: boolean; description: string }[] = [];
    const financials = companyData.financials;

    // Valuation
    if (params.plFilter?.enabled) {
      const pl = toNumber(financials.pl);
      const inRange = this.isValueInRange(pl, params.plFilter);
      criteria.push({
        label: 'P/L',
        value: inRange,
        description: `${params.plFilter.min !== undefined ? `≥ ${params.plFilter.min}` : ''}${params.plFilter.min !== undefined && params.plFilter.max !== undefined ? ' e ' : ''}${params.plFilter.max !== undefined ? `≤ ${params.plFilter.max}` : ''} (atual: ${pl?.toFixed(2) || 'N/A'})`
      });
    }

    if (params.pvpFilter?.enabled) {
      const pvp = toNumber(financials.pvp);
      const inRange = this.isValueInRange(pvp, params.pvpFilter);
      criteria.push({
        label: 'P/VP',
        value: inRange,
        description: `${params.pvpFilter.min !== undefined ? `≥ ${params.pvpFilter.min}` : ''}${params.pvpFilter.min !== undefined && params.pvpFilter.max !== undefined ? ' e ' : ''}${params.pvpFilter.max !== undefined ? `≤ ${params.pvpFilter.max}` : ''} (atual: ${pvp?.toFixed(2) || 'N/A'})`
      });
    }

    if (params.evEbitdaFilter?.enabled) {
      const evEbitda = toNumber(financials.evEbitda);
      const inRange = this.isValueInRange(evEbitda, params.evEbitdaFilter);
      criteria.push({
        label: 'EV/EBITDA',
        value: inRange,
        description: `${params.evEbitdaFilter.min !== undefined ? `≥ ${params.evEbitdaFilter.min}` : ''}${params.evEbitdaFilter.min !== undefined && params.evEbitdaFilter.max !== undefined ? ' e ' : ''}${params.evEbitdaFilter.max !== undefined ? `≤ ${params.evEbitdaFilter.max}` : ''} (atual: ${evEbitda?.toFixed(2) || 'N/A'})`
      });
    }

    if (params.psrFilter?.enabled) {
      const psr = toNumber(financials.psr);
      const inRange = this.isValueInRange(psr, params.psrFilter);
      criteria.push({
        label: 'PSR',
        value: inRange,
        description: `${params.psrFilter.min !== undefined ? `≥ ${params.psrFilter.min}` : ''}${params.psrFilter.min !== undefined && params.psrFilter.max !== undefined ? ' e ' : ''}${params.psrFilter.max !== undefined ? `≤ ${params.psrFilter.max}` : ''} (atual: ${psr?.toFixed(2) || 'N/A'})`
      });
    }

    // Rentabilidade
    if (params.roeFilter?.enabled) {
      const roe = toNumber(financials.roe);
      const inRange = this.isValueInRange(roe, params.roeFilter);
      criteria.push({
        label: 'ROE',
        value: inRange,
        description: `${params.roeFilter.min !== undefined ? `≥ ${(params.roeFilter.min * 100).toFixed(1)}%` : ''}${params.roeFilter.min !== undefined && params.roeFilter.max !== undefined ? ' e ' : ''}${params.roeFilter.max !== undefined ? `≤ ${(params.roeFilter.max * 100).toFixed(1)}%` : ''} (atual: ${roe ? (roe * 100).toFixed(1) + '%' : 'N/A'})`
      });
    }

    if (params.roicFilter?.enabled) {
      const roic = toNumber(financials.roic);
      const inRange = this.isValueInRange(roic, params.roicFilter);
      criteria.push({
        label: 'ROIC',
        value: inRange,
        description: `${params.roicFilter.min !== undefined ? `≥ ${(params.roicFilter.min * 100).toFixed(1)}%` : ''}${params.roicFilter.min !== undefined && params.roicFilter.max !== undefined ? ' e ' : ''}${params.roicFilter.max !== undefined ? `≤ ${(params.roicFilter.max * 100).toFixed(1)}%` : ''} (atual: ${roic ? (roic * 100).toFixed(1) + '%' : 'N/A'})`
      });
    }

    if (params.roaFilter?.enabled) {
      const roa = toNumber(financials.roa);
      const inRange = this.isValueInRange(roa, params.roaFilter);
      criteria.push({
        label: 'ROA',
        value: inRange,
        description: `${params.roaFilter.min !== undefined ? `≥ ${(params.roaFilter.min * 100).toFixed(1)}%` : ''}${params.roaFilter.min !== undefined && params.roaFilter.max !== undefined ? ' e ' : ''}${params.roaFilter.max !== undefined ? `≤ ${(params.roaFilter.max * 100).toFixed(1)}%` : ''} (atual: ${roa ? (roa * 100).toFixed(1) + '%' : 'N/A'})`
      });
    }

    if (params.margemLiquidaFilter?.enabled) {
      const margemLiquida = toNumber(financials.margemLiquida);
      const inRange = this.isValueInRange(margemLiquida, params.margemLiquidaFilter);
      criteria.push({
        label: 'Margem Líquida',
        value: inRange,
        description: `${params.margemLiquidaFilter.min !== undefined ? `≥ ${(params.margemLiquidaFilter.min * 100).toFixed(1)}%` : ''}${params.margemLiquidaFilter.min !== undefined && params.margemLiquidaFilter.max !== undefined ? ' e ' : ''}${params.margemLiquidaFilter.max !== undefined ? `≤ ${(params.margemLiquidaFilter.max * 100).toFixed(1)}%` : ''} (atual: ${margemLiquida ? (margemLiquida * 100).toFixed(1) + '%' : 'N/A'})`
      });
    }

    if (params.margemEbitdaFilter?.enabled) {
      const margemEbitda = toNumber(financials.margemEbitda);
      const inRange = this.isValueInRange(margemEbitda, params.margemEbitdaFilter);
      criteria.push({
        label: 'Margem EBITDA',
        value: inRange,
        description: `${params.margemEbitdaFilter.min !== undefined ? `≥ ${(params.margemEbitdaFilter.min * 100).toFixed(1)}%` : ''}${params.margemEbitdaFilter.min !== undefined && params.margemEbitdaFilter.max !== undefined ? ' e ' : ''}${params.margemEbitdaFilter.max !== undefined ? `≤ ${(params.margemEbitdaFilter.max * 100).toFixed(1)}%` : ''} (atual: ${margemEbitda ? (margemEbitda * 100).toFixed(1) + '%' : 'N/A'})`
      });
    }

    // Crescimento
    if (params.cagrLucros5aFilter?.enabled) {
      const cagrLucros = toNumber(financials.crescimentoLucros);
      const inRange = this.isValueInRange(cagrLucros, params.cagrLucros5aFilter);
      criteria.push({
        label: 'CAGR Lucros 5a',
        value: inRange,
        description: `${params.cagrLucros5aFilter.min !== undefined ? `≥ ${(params.cagrLucros5aFilter.min * 100).toFixed(1)}%` : ''}${params.cagrLucros5aFilter.min !== undefined && params.cagrLucros5aFilter.max !== undefined ? ' e ' : ''}${params.cagrLucros5aFilter.max !== undefined ? `≤ ${(params.cagrLucros5aFilter.max * 100).toFixed(1)}%` : ''} (atual: ${cagrLucros ? (cagrLucros * 100).toFixed(1) + '%' : 'N/A'})`
      });
    }

    if (params.cagrReceitas5aFilter?.enabled) {
      const cagrReceitas = toNumber(financials.crescimentoReceitas);
      const inRange = this.isValueInRange(cagrReceitas, params.cagrReceitas5aFilter);
      criteria.push({
        label: 'CAGR Receitas 5a',
        value: inRange,
        description: `${params.cagrReceitas5aFilter.min !== undefined ? `≥ ${(params.cagrReceitas5aFilter.min * 100).toFixed(1)}%` : ''}${params.cagrReceitas5aFilter.min !== undefined && params.cagrReceitas5aFilter.max !== undefined ? ' e ' : ''}${params.cagrReceitas5aFilter.max !== undefined ? `≤ ${(params.cagrReceitas5aFilter.max * 100).toFixed(1)}%` : ''} (atual: ${cagrReceitas ? (cagrReceitas * 100).toFixed(1) + '%' : 'N/A'})`
      });
    }

    // Dividendos
    if (params.dyFilter?.enabled) {
      const dy = toNumber(financials.dy);
      const inRange = this.isValueInRange(dy, params.dyFilter);
      criteria.push({
        label: 'Dividend Yield',
        value: inRange,
        description: `${params.dyFilter.min !== undefined ? `≥ ${(params.dyFilter.min * 100).toFixed(1)}%` : ''}${params.dyFilter.min !== undefined && params.dyFilter.max !== undefined ? ' e ' : ''}${params.dyFilter.max !== undefined ? `≤ ${(params.dyFilter.max * 100).toFixed(1)}%` : ''} (atual: ${dy ? (dy * 100).toFixed(1) + '%' : 'N/A'})`
      });
    }

    if (params.payoutFilter?.enabled) {
      const payout = toNumber(financials.payout);
      const inRange = this.isValueInRange(payout, params.payoutFilter);
      criteria.push({
        label: 'Payout',
        value: inRange,
        description: `${params.payoutFilter.min !== undefined ? `≥ ${(params.payoutFilter.min * 100).toFixed(1)}%` : ''}${params.payoutFilter.min !== undefined && params.payoutFilter.max !== undefined ? ' e ' : ''}${params.payoutFilter.max !== undefined ? `≤ ${(params.payoutFilter.max * 100).toFixed(1)}%` : ''} (atual: ${payout ? (payout * 100).toFixed(1) + '%' : 'N/A'})`
      });
    }

    // Endividamento & Liquidez
    if (params.dividaLiquidaPlFilter?.enabled) {
      const dividaLiquidaPl = toNumber(financials.dividaLiquidaPl);
      const inRange = this.isValueInRange(dividaLiquidaPl, params.dividaLiquidaPlFilter);
      criteria.push({
        label: 'Dívida Líq./PL',
        value: inRange,
        description: `${params.dividaLiquidaPlFilter.min !== undefined ? `≥ ${(params.dividaLiquidaPlFilter.min * 100).toFixed(1)}%` : ''}${params.dividaLiquidaPlFilter.min !== undefined && params.dividaLiquidaPlFilter.max !== undefined ? ' e ' : ''}${params.dividaLiquidaPlFilter.max !== undefined ? `≤ ${(params.dividaLiquidaPlFilter.max * 100).toFixed(1)}%` : ''} (atual: ${dividaLiquidaPl ? (dividaLiquidaPl * 100).toFixed(1) + '%' : 'N/A'})`
      });
    }

    if (params.liquidezCorrenteFilter?.enabled) {
      const liquidezCorrente = toNumber(financials.liquidezCorrente);
      const inRange = this.isValueInRange(liquidezCorrente, params.liquidezCorrenteFilter);
      criteria.push({
        label: 'Liquidez Corrente',
        value: inRange,
        description: `${params.liquidezCorrenteFilter.min !== undefined ? `≥ ${params.liquidezCorrenteFilter.min.toFixed(2)}` : ''}${params.liquidezCorrenteFilter.min !== undefined && params.liquidezCorrenteFilter.max !== undefined ? ' e ' : ''}${params.liquidezCorrenteFilter.max !== undefined ? `≤ ${params.liquidezCorrenteFilter.max.toFixed(2)}` : ''} (atual: ${liquidezCorrente?.toFixed(2) || 'N/A'})`
      });
    }

    if (params.dividaLiquidaEbitdaFilter?.enabled) {
      const dividaLiquidaEbitda = toNumber(financials.dividaLiquidaEbitda);
      const inRange = this.isValueInRange(dividaLiquidaEbitda, params.dividaLiquidaEbitdaFilter);
      criteria.push({
        label: 'Dívida Líq./EBITDA',
        value: inRange,
        description: `${params.dividaLiquidaEbitdaFilter.min !== undefined ? `≥ ${params.dividaLiquidaEbitdaFilter.min.toFixed(2)}x` : ''}${params.dividaLiquidaEbitdaFilter.min !== undefined && params.dividaLiquidaEbitdaFilter.max !== undefined ? ' e ' : ''}${params.dividaLiquidaEbitdaFilter.max !== undefined ? `≤ ${params.dividaLiquidaEbitdaFilter.max.toFixed(2)}x` : ''} (atual: ${dividaLiquidaEbitda?.toFixed(2) || 'N/A'})`
      });
    }

    // Market Cap
    if (params.marketCapFilter?.enabled) {
      const marketCap = toNumber(financials.marketCap);
      const marketCapBi = marketCap ? marketCap / 1_000_000_000 : null;
      const inRange = this.isValueInRange(marketCap, params.marketCapFilter);
      criteria.push({
        label: 'Market Cap',
        value: inRange,
        description: `${params.marketCapFilter.min !== undefined ? `≥ R$ ${(params.marketCapFilter.min / 1_000_000_000).toFixed(2)}bi` : ''}${params.marketCapFilter.min !== undefined && params.marketCapFilter.max !== undefined ? ' e ' : ''}${params.marketCapFilter.max !== undefined ? `≤ R$ ${(params.marketCapFilter.max / 1_000_000_000).toFixed(2)}bi` : ''} (atual: ${marketCapBi ? `R$ ${marketCapBi.toFixed(2)}bi` : 'N/A'})`
      });
    }
    
    // Score Geral (Overall Score)
    if (params.overallScoreFilter?.enabled) {
      // Calcular overall score para a empresa usando o método herdado da base
      const overallScore = this.calculateOverallScore(companyData);
      const inRange = this.isValueInRange(overallScore, params.overallScoreFilter);
      criteria.push({
        label: 'Score Geral',
        value: inRange,
        description: `${params.overallScoreFilter.min !== undefined ? `≥ ${params.overallScoreFilter.min.toFixed(0)}` : ''}${params.overallScoreFilter.min !== undefined && params.overallScoreFilter.max !== undefined ? ' e ' : ''}${params.overallScoreFilter.max !== undefined ? `≤ ${params.overallScoreFilter.max.toFixed(0)}` : ''} (atual: ${overallScore?.toFixed(0) || 'N/A'})`
      });
    }
    
    // Graham Upside (Margem de Segurança)
    if (params.grahamUpsideFilter?.enabled) {
      const grahamUpside = this.calculateGrahamUpside(companyData);
      // Se o filtro está ativo e o valor é null, a empresa NÃO passa (reprova)
      // Se o valor existe, verifica se está no range
      const inRange = grahamUpside !== null ? this.isValueInRange(grahamUpside, params.grahamUpsideFilter) : false;
      criteria.push({
        label: 'Graham Upside',
        value: inRange,
        description: `${params.grahamUpsideFilter.min !== undefined ? `≥ ${params.grahamUpsideFilter.min.toFixed(0)}%` : ''}${params.grahamUpsideFilter.min !== undefined && params.grahamUpsideFilter.max !== undefined ? ' e ' : ''}${params.grahamUpsideFilter.max !== undefined ? `≤ ${params.grahamUpsideFilter.max.toFixed(0)}%` : ''} (atual: ${grahamUpside !== null ? grahamUpside.toFixed(1) + '%' : 'N/A - reprovado'})`
      });
    }
    
    // Setor
    if (params.selectedSectors && params.selectedSectors.length > 0) {
      const companySector = companyData.sector;
      // Se não tem dados de setor, IGNORA o filtro (considera como passou)
      const inSelectedSector = !companySector || params.selectedSectors.includes(companySector);
      criteria.push({
        label: 'Setor',
        value: inSelectedSector,
        description: `Setores selecionados: ${params.selectedSectors.join(', ')} (empresa: ${companySector || 'N/A - filtro ignorado'})`
      });
    }
    
    // Indústria
    if (params.selectedIndustries && params.selectedIndustries.length > 0) {
      const companyIndustry = companyData.industry;
      // Se não tem dados de indústria, IGNORA o filtro (considera como passou)
      const inSelectedIndustry = !companyIndustry || params.selectedIndustries.includes(companyIndustry);
      criteria.push({
        label: 'Indústria',
        value: inSelectedIndustry,
        description: `Indústrias selecionadas: ${params.selectedIndustries.join(', ')} (empresa: ${companyIndustry || 'N/A - filtro ignorado'})`
      });
    }

    return criteria;
  }
  
  /**
   * Calcula o Graham Upside para uma empresa
   */
  private calculateGrahamUpside(companyData: CompanyData): number | null {
    try {
      const grahamStrategy = new GrahamStrategy();
      
      // Validar se temos dados suficientes
      if (!grahamStrategy.validateCompanyData(companyData)) {
        return null;
      }
      
      // Executar análise Graham
      const analysis = grahamStrategy.runAnalysis(companyData, {});
      
      // Retornar upside
      return analysis.upside;
    } catch (error) {
      console.error('Erro ao calcular Graham upside:', error);
      return null;
    }
  }

  runAnalysis(companyData: CompanyData, params: ScreeningParams): StrategyAnalysis {
    const financials = companyData.financials;
    const criteria = this.generateCriteria(companyData, params);
    
    // Conta quantos critérios passaram
    const passedCriteria = criteria.filter(c => c.value).length;
    const totalCriteria = criteria.length;
    
    // Empresa é elegível se passou em TODOS os critérios ativos
    const isEligible = passedCriteria === totalCriteria && totalCriteria > 0;
    
    // Score baseado na porcentagem de critérios atendidos
    const score = totalCriteria > 0 ? (passedCriteria / totalCriteria) * 100 : 0;

    // Gera reasoning dinâmico
    const passedList = criteria.filter(c => c.value).map(c => c.label).join(', ');
    const failedList = criteria.filter(c => !c.value).map(c => c.label).join(', ');
    
    let reasoning = `**Screening Customizado**: Aplicados ${totalCriteria} filtros.\n\n`;
    
    if (isEligible) {
      reasoning += `✅ **Empresa APROVADA**: Atende todos os ${totalCriteria} critérios configurados.\n\n`;
      reasoning += `**Critérios atendidos**: ${passedList}`;
    } else {
      reasoning += `❌ **Empresa NÃO aprovada**: Atende ${passedCriteria} de ${totalCriteria} critérios.\n\n`;
      if (passedCriteria > 0) {
        reasoning += `✅ **Passou em**: ${passedList}\n\n`;
      }
      if (failedList) {
        reasoning += `❌ **Não passou em**: ${failedList}`;
      }
    }

    // Coletar métricas-chave
    const key_metrics: Record<string, number | null> = {
      pl: toNumber(financials.pl),
      pvp: toNumber(financials.pvp),
      roe: toNumber(financials.roe),
      roic: toNumber(financials.roic),
      dy: toNumber(financials.dy),
      margemLiquida: toNumber(financials.margemLiquida),
      liquidezCorrente: toNumber(financials.liquidezCorrente),
      dividaLiquidaPl: toNumber(financials.dividaLiquidaPl)
    };

    return {
      isEligible,
      score,
      fairValue: null, // Screening não calcula preço justo
      upside: null,
      reasoning,
      criteria,
      key_metrics
    };
  }

  runRanking(companies: CompanyData[], params: ScreeningParams): RankBuilderResult[] {
    const activeFiltersCount = this.countActiveFilters(params);
    
    // Filtrar por tipo de ativo primeiro (b3, bdr, both)
    let filteredCompaniesForEmptyFilters = this.filterByAssetType(companies, params.assetTypeFilter);
    
    if (activeFiltersCount === 0) {
      // Se não há filtros ativos, retorna todas as empresas ordenadas por market cap
      const allResults = filteredCompaniesForEmptyFilters
        .map(company => {
          const marketCap = toNumber(company.financials.marketCap) || 0;
          return {
            ticker: company.ticker,
            name: company.name,
            sector: company.sector,
            currentPrice: company.currentPrice,
            logoUrl: company.logoUrl,
            fairValue: null,
            upside: null,
            marginOfSafety: null,
            rational: '⚠️ **Nenhum filtro ativo**: Configure ao menos um filtro para realizar o screening.',
            key_metrics: {
              marketCap: toNumber(company.financials.marketCap)
            }
          };
        })
        .sort((a, b) => ((b.key_metrics?.marketCap as number) || 0) - ((a.key_metrics?.marketCap as number) || 0));
      
      // Remover empresas duplicadas (ex: SAPR3, SAPR4, SAPR11 - mantém apenas a primeira)
      const uniqueResults = this.removeDuplicateCompanies(allResults);
      
      return uniqueResults.slice(0, params.limit || 100);
    }

    // Filtrar por tipo de ativo primeiro (b3, bdr, both)
    let filteredCompanies = this.filterByAssetType(companies, params.assetTypeFilter);
    
    // Filtrar por tamanho de empresa (se configurado)
    if (params.companySize && params.companySize !== 'all') {
      filteredCompanies = this.filterCompaniesBySize(filteredCompanies, params.companySize);
    }

    // Aplicar filtros e ranquear
    const results: RankBuilderResult[] = [];

    for (const company of filteredCompanies) {
      const analysis = this.runAnalysis(company, params);
      
      if (analysis.isEligible) {
        results.push({
          ticker: company.ticker,
          name: company.name,
          sector: company.sector,
          currentPrice: company.currentPrice,
          logoUrl: company.logoUrl,
          fairValue: null,
          upside: null,
          marginOfSafety: null,
          rational: this.generateIndividualRational(company, params, analysis),
          key_metrics: analysis.key_metrics
        });
      }
    }

    // Ordenar por score (mais alto primeiro)
    results.sort((a, b) => {
      // Priorizar por análise técnica se ativada
      if (params.useTechnicalAnalysis && a.key_metrics?.technicalScore && b.key_metrics?.technicalScore) {
        const techDiff = (b.key_metrics.technicalScore as number) - (a.key_metrics.technicalScore as number);
        if (Math.abs(techDiff) > 5) return techDiff;
      }
      
      // Ordenar por market cap (maiores primeiro)
      return ((b.key_metrics?.marketCap as number) || 0) - ((a.key_metrics?.marketCap as number) || 0);
    });

    // Remover empresas duplicadas (ex: SAPR3, SAPR4, SAPR11 - mantém apenas a primeira)
    const uniqueResults = this.removeDuplicateCompanies(results);

    return uniqueResults.slice(0, params.limit || 100);
  }

  private generateIndividualRational(
    company: CompanyData,
    params: ScreeningParams,
    analysis: StrategyAnalysis
  ): string {
    const financials = company.financials;
    let rational = `**${company.ticker}** passou em todos os filtros configurados.\n\n`;
    
    rational += `**Critérios atendidos**:\n`;
    analysis.criteria.filter(c => c.value).forEach(criterion => {
      rational += `• ${criterion.label}: ${criterion.description}\n`;
    });

    return rational;
  }

  generateRational(params: ScreeningParams): string {
    const activeFiltersCount = this.countActiveFilters(params);
    
    if (activeFiltersCount === 0) {
      return `**SCREENING CUSTOMIZÁVEL DE AÇÕES**

**Status**: Nenhum filtro ativo

Configure pelo menos um filtro nas categorias disponíveis para realizar o screening.`;
    }

    let rational = `**SCREENING CUSTOMIZÁVEL DE AÇÕES**

**Filosofia**: Busca personalizada de ações baseada nos seus critérios específicos de investimento.

**Filtros Ativos**: ${activeFiltersCount}

`;

    // Listar filtros por categoria
    const sections: { title: string; filters: string[] }[] = [];

    // Valuation
    const valuationFilters: string[] = [];
    if (params.plFilter?.enabled) {
      valuationFilters.push(`• **P/L**: ${params.plFilter.min !== undefined ? `≥ ${params.plFilter.min}` : ''}${params.plFilter.min !== undefined && params.plFilter.max !== undefined ? ' e ' : ''}${params.plFilter.max !== undefined ? `≤ ${params.plFilter.max}` : ''}`);
    }
    if (params.pvpFilter?.enabled) {
      valuationFilters.push(`• **P/VP**: ${params.pvpFilter.min !== undefined ? `≥ ${params.pvpFilter.min}` : ''}${params.pvpFilter.min !== undefined && params.pvpFilter.max !== undefined ? ' e ' : ''}${params.pvpFilter.max !== undefined ? `≤ ${params.pvpFilter.max}` : ''}`);
    }
    if (params.evEbitdaFilter?.enabled) {
      valuationFilters.push(`• **EV/EBITDA**: ${params.evEbitdaFilter.min !== undefined ? `≥ ${params.evEbitdaFilter.min}` : ''}${params.evEbitdaFilter.min !== undefined && params.evEbitdaFilter.max !== undefined ? ' e ' : ''}${params.evEbitdaFilter.max !== undefined ? `≤ ${params.evEbitdaFilter.max}` : ''}`);
    }
    if (params.psrFilter?.enabled) {
      valuationFilters.push(`• **PSR**: ${params.psrFilter.min !== undefined ? `≥ ${params.psrFilter.min}` : ''}${params.psrFilter.min !== undefined && params.psrFilter.max !== undefined ? ' e ' : ''}${params.psrFilter.max !== undefined ? `≤ ${params.psrFilter.max}` : ''}`);
    }
    if (valuationFilters.length > 0) {
      sections.push({ title: '**📊 Valuation**', filters: valuationFilters });
    }

    // Rentabilidade
    const rentabilidadeFilters: string[] = [];
    if (params.roeFilter?.enabled) {
      rentabilidadeFilters.push(`• **ROE**: ${params.roeFilter.min !== undefined ? `≥ ${(params.roeFilter.min * 100).toFixed(1)}%` : ''}${params.roeFilter.min !== undefined && params.roeFilter.max !== undefined ? ' e ' : ''}${params.roeFilter.max !== undefined ? `≤ ${(params.roeFilter.max * 100).toFixed(1)}%` : ''}`);
    }
    if (params.roicFilter?.enabled) {
      rentabilidadeFilters.push(`• **ROIC**: ${params.roicFilter.min !== undefined ? `≥ ${(params.roicFilter.min * 100).toFixed(1)}%` : ''}${params.roicFilter.min !== undefined && params.roicFilter.max !== undefined ? ' e ' : ''}${params.roicFilter.max !== undefined ? `≤ ${(params.roicFilter.max * 100).toFixed(1)}%` : ''}`);
    }
    if (params.roaFilter?.enabled) {
      rentabilidadeFilters.push(`• **ROA**: ${params.roaFilter.min !== undefined ? `≥ ${(params.roaFilter.min * 100).toFixed(1)}%` : ''}${params.roaFilter.min !== undefined && params.roaFilter.max !== undefined ? ' e ' : ''}${params.roaFilter.max !== undefined ? `≤ ${(params.roaFilter.max * 100).toFixed(1)}%` : ''}`);
    }
    if (params.margemLiquidaFilter?.enabled) {
      rentabilidadeFilters.push(`• **Margem Líquida**: ${params.margemLiquidaFilter.min !== undefined ? `≥ ${(params.margemLiquidaFilter.min * 100).toFixed(1)}%` : ''}${params.margemLiquidaFilter.min !== undefined && params.margemLiquidaFilter.max !== undefined ? ' e ' : ''}${params.margemLiquidaFilter.max !== undefined ? `≤ ${(params.margemLiquidaFilter.max * 100).toFixed(1)}%` : ''}`);
    }
    if (params.margemEbitdaFilter?.enabled) {
      rentabilidadeFilters.push(`• **Margem EBITDA**: ${params.margemEbitdaFilter.min !== undefined ? `≥ ${(params.margemEbitdaFilter.min * 100).toFixed(1)}%` : ''}${params.margemEbitdaFilter.min !== undefined && params.margemEbitdaFilter.max !== undefined ? ' e ' : ''}${params.margemEbitdaFilter.max !== undefined ? `≤ ${(params.margemEbitdaFilter.max * 100).toFixed(1)}%` : ''}`);
    }
    if (rentabilidadeFilters.length > 0) {
      sections.push({ title: '**💰 Rentabilidade**', filters: rentabilidadeFilters });
    }

    // Crescimento
    const crescimentoFilters: string[] = [];
    if (params.cagrLucros5aFilter?.enabled) {
      crescimentoFilters.push(`• **CAGR Lucros 5a**: ${params.cagrLucros5aFilter.min !== undefined ? `≥ ${(params.cagrLucros5aFilter.min * 100).toFixed(1)}%` : ''}${params.cagrLucros5aFilter.min !== undefined && params.cagrLucros5aFilter.max !== undefined ? ' e ' : ''}${params.cagrLucros5aFilter.max !== undefined ? `≤ ${(params.cagrLucros5aFilter.max * 100).toFixed(1)}%` : ''}`);
    }
    if (params.cagrReceitas5aFilter?.enabled) {
      crescimentoFilters.push(`• **CAGR Receitas 5a**: ${params.cagrReceitas5aFilter.min !== undefined ? `≥ ${(params.cagrReceitas5aFilter.min * 100).toFixed(1)}%` : ''}${params.cagrReceitas5aFilter.min !== undefined && params.cagrReceitas5aFilter.max !== undefined ? ' e ' : ''}${params.cagrReceitas5aFilter.max !== undefined ? `≤ ${(params.cagrReceitas5aFilter.max * 100).toFixed(1)}%` : ''}`);
    }
    if (crescimentoFilters.length > 0) {
      sections.push({ title: '**📈 Crescimento**', filters: crescimentoFilters });
    }

    // Dividendos
    const dividendosFilters: string[] = [];
    if (params.dyFilter?.enabled) {
      dividendosFilters.push(`• **Dividend Yield**: ${params.dyFilter.min !== undefined ? `≥ ${(params.dyFilter.min * 100).toFixed(1)}%` : ''}${params.dyFilter.min !== undefined && params.dyFilter.max !== undefined ? ' e ' : ''}${params.dyFilter.max !== undefined ? `≤ ${(params.dyFilter.max * 100).toFixed(1)}%` : ''}`);
    }
    if (params.payoutFilter?.enabled) {
      dividendosFilters.push(`• **Payout**: ${params.payoutFilter.min !== undefined ? `≥ ${(params.payoutFilter.min * 100).toFixed(1)}%` : ''}${params.payoutFilter.min !== undefined && params.payoutFilter.max !== undefined ? ' e ' : ''}${params.payoutFilter.max !== undefined ? `≤ ${(params.payoutFilter.max * 100).toFixed(1)}%` : ''}`);
    }
    if (dividendosFilters.length > 0) {
      sections.push({ title: '**💵 Dividendos**', filters: dividendosFilters });
    }

    // Endividamento & Liquidez
    const endividamentoFilters: string[] = [];
    if (params.dividaLiquidaPlFilter?.enabled) {
      endividamentoFilters.push(`• **Dívida Líq./PL**: ${params.dividaLiquidaPlFilter.min !== undefined ? `≥ ${(params.dividaLiquidaPlFilter.min * 100).toFixed(1)}%` : ''}${params.dividaLiquidaPlFilter.min !== undefined && params.dividaLiquidaPlFilter.max !== undefined ? ' e ' : ''}${params.dividaLiquidaPlFilter.max !== undefined ? `≤ ${(params.dividaLiquidaPlFilter.max * 100).toFixed(1)}%` : ''}`);
    }
    if (params.liquidezCorrenteFilter?.enabled) {
      endividamentoFilters.push(`• **Liquidez Corrente**: ${params.liquidezCorrenteFilter.min !== undefined ? `≥ ${params.liquidezCorrenteFilter.min.toFixed(2)}` : ''}${params.liquidezCorrenteFilter.min !== undefined && params.liquidezCorrenteFilter.max !== undefined ? ' e ' : ''}${params.liquidezCorrenteFilter.max !== undefined ? `≤ ${params.liquidezCorrenteFilter.max.toFixed(2)}` : ''}`);
    }
    if (params.dividaLiquidaEbitdaFilter?.enabled) {
      endividamentoFilters.push(`• **Dívida Líq./EBITDA**: ${params.dividaLiquidaEbitdaFilter.min !== undefined ? `≥ ${params.dividaLiquidaEbitdaFilter.min.toFixed(2)}x` : ''}${params.dividaLiquidaEbitdaFilter.min !== undefined && params.dividaLiquidaEbitdaFilter.max !== undefined ? ' e ' : ''}${params.dividaLiquidaEbitdaFilter.max !== undefined ? `≤ ${params.dividaLiquidaEbitdaFilter.max.toFixed(2)}x` : ''}`);
    }
    if (endividamentoFilters.length > 0) {
      sections.push({ title: '**🏦 Endividamento & Liquidez**', filters: endividamentoFilters });
    }

    // Market Cap
    if (params.marketCapFilter?.enabled) {
      const marketCapFilters: string[] = [];
      marketCapFilters.push(`• **Market Cap**: ${params.marketCapFilter.min !== undefined ? `≥ R$ ${(params.marketCapFilter.min / 1_000_000_000).toFixed(2)}bi` : ''}${params.marketCapFilter.min !== undefined && params.marketCapFilter.max !== undefined ? ' e ' : ''}${params.marketCapFilter.max !== undefined ? `≤ R$ ${(params.marketCapFilter.max / 1_000_000_000).toFixed(2)}bi` : ''}`);
      sections.push({ title: '**🏢 Tamanho**', filters: marketCapFilters });
    }
    
    // Score Geral e Graham Upside
    const advancedFilters: string[] = [];
    if (params.overallScoreFilter?.enabled) {
      advancedFilters.push(`• **Score Geral**: ${params.overallScoreFilter.min !== undefined ? `≥ ${params.overallScoreFilter.min.toFixed(0)}` : ''}${params.overallScoreFilter.min !== undefined && params.overallScoreFilter.max !== undefined ? ' e ' : ''}${params.overallScoreFilter.max !== undefined ? `≤ ${params.overallScoreFilter.max.toFixed(0)}` : ''}`);
    }
    if (params.grahamUpsideFilter?.enabled) {
      advancedFilters.push(`• **Graham Upside**: ${params.grahamUpsideFilter.min !== undefined ? `≥ ${params.grahamUpsideFilter.min.toFixed(0)}%` : ''}${params.grahamUpsideFilter.min !== undefined && params.grahamUpsideFilter.max !== undefined ? ' e ' : ''}${params.grahamUpsideFilter.max !== undefined ? `≤ ${params.grahamUpsideFilter.max.toFixed(0)}%` : ''}`);
    }
    if (advancedFilters.length > 0) {
      sections.push({ title: '**🎯 Qualidade & Oportunidade**', filters: advancedFilters });
    }
    
    // Setores e Indústrias
    const sectorFilters: string[] = [];
    if (params.selectedSectors && params.selectedSectors.length > 0) {
      sectorFilters.push(`• **Setores**: ${params.selectedSectors.join(', ')}`);
    }
    if (params.selectedIndustries && params.selectedIndustries.length > 0) {
      sectorFilters.push(`• **Indústrias**: ${params.selectedIndustries.join(', ')}`);
    }
    if (sectorFilters.length > 0) {
      sections.push({ title: '**🏭 Filtro Setorial**', filters: sectorFilters });
    }

    // Adicionar seções ao rational
    sections.forEach(section => {
      rational += `${section.title}\n`;
      section.filters.forEach(filter => {
        rational += `${filter}\n`;
      });
      rational += '\n';
    });

    rational += `**Ordenação**: Empresas que atendem TODOS os critérios, ordenadas por Market Cap${params.useTechnicalAnalysis ? ' + Priorização por Análise Técnica' : ''}.

**Objetivo**: Encontrar empresas que atendem seus critérios específicos de investimento${params.useTechnicalAnalysis ? '. Com análise técnica ativa, priorizamos ativos em sobrevenda para melhor timing de entrada' : ''}.`;

    return rational;
  }

  validateCompanyData(companyData: CompanyData, params: ScreeningParams): boolean {
    // Screening precisa de pelo menos market cap
    const marketCap = toNumber(companyData.financials.marketCap);
    return marketCap !== null && marketCap > 0;
  }
}
