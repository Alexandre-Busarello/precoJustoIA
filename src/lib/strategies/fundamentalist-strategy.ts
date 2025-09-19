import { AbstractStrategy, toNumber } from './base-strategy';
import { StrategyAnalysis, StrategyParams, CompanyData, RankBuilderResult, CompanyFinancialData } from './types';

export interface FundamentalistParams extends StrategyParams {
  minROE?: number;
  minROIC?: number;
  maxDebtToEbitda?: number;
  maxPayout?: number;
  minPayout?: number;
  companySize?: 'all' | 'small_caps' | 'mid_caps' | 'blue_chips';
}

export class FundamentalistStrategy extends AbstractStrategy<FundamentalistParams> {
  name = 'Fundamentalista 3+1';
  description = 'Análise fundamentalista simplificada usando 3 indicadores essenciais + análise de dividendos';

  runAnalysis(companyData: CompanyData, params: FundamentalistParams = {}): StrategyAnalysis {
    const financialData = companyData.financials;
    // Parâmetros padrão
    const minROE = params.minROE || 0.15; // 15%
    const minROIC = params.minROIC || 0.15; // 15%
    const maxDebtToEbitda = params.maxDebtToEbitda || 3.0; // 3x
    const minPayout = params.minPayout || 0.40; // 40%
    const maxPayout = params.maxPayout || 0.80; // 80%

    // Converter dados financeiros
    const roe = toNumber(financialData.roe);
    const roic = toNumber(financialData.roic);
    const pl = toNumber(financialData.pl);
    const evEbitda = toNumber(financialData.evEbitda);
    const dividaLiquidaEbitda = toNumber(financialData.dividaLiquidaEbitda);
    const cagrLucros5a = toNumber(financialData.cagrLucros5a);
    const payout = toNumber(financialData.payout);
    const dy = toNumber(financialData.dy);
    const setor = companyData.sector || '';

    // Verificar se é banco ou seguradora (exceção especial)
    const isBankOrInsurance = this.isBankOrInsurance(setor);

    // Determinar se tem dívida relevante
    const hasRelevantDebt = dividaLiquidaEbitda !== null && dividaLiquidaEbitda > 0;

    let score = 0;
    let isEligible = true;
    const reasons: string[] = [];
    const warnings: string[] = [];
    const keyMetrics: Record<string, number | null> = {};

    // PASSO 1: Avaliar Qualidade da Empresa (ROE ou ROIC)
    let qualityScore = 0;
    let qualityIndicator = '';
    let qualityValue: number | null = null;

    if (isBankOrInsurance) {
      // Para bancos e seguradoras: usar apenas ROE
      qualityIndicator = 'ROE';
      qualityValue = roe;
      keyMetrics.roe = roe;
      
      if (roe !== null) {
        if (roe >= minROE) {
          qualityScore = 35; // Máximo para qualidade
          reasons.push(`Excelente ROE de ${(roe * 100).toFixed(1)}% (≥15% para ${setor})`);
        } else if (roe >= 0.10) {
          qualityScore = 25;
          reasons.push(`ROE adequado de ${(roe * 100).toFixed(1)}% para ${setor}`);
        } else if (roe >= 0.05) {
          qualityScore = 15;
          warnings.push(`ROE baixo de ${(roe * 100).toFixed(1)}% para ${setor}`);
        } else {
          qualityScore = 5;
          warnings.push(`ROE muito baixo de ${(roe * 100).toFixed(1)}%`);
          isEligible = false;
        }
      } else {
        warnings.push('ROE não disponível');
        isEligible = false;
      }
    } else {
      // Para empresas normais: ROE se sem dívida, ROIC se com dívida
      if (!hasRelevantDebt) {
        qualityIndicator = 'ROE';
        qualityValue = roe;
        keyMetrics.roe = roe;
        
        if (roe !== null) {
          if (roe >= minROE) {
            qualityScore = 35;
            reasons.push(`Excelente ROE de ${(roe * 100).toFixed(1)}% (empresa sem dívida relevante)`);
          } else if (roe >= 0.10) {
            qualityScore = 25;
            reasons.push(`ROE adequado de ${(roe * 100).toFixed(1)}%`);
          } else if (roe >= 0.05) {
            qualityScore = 15;
            warnings.push(`ROE baixo de ${(roe * 100).toFixed(1)}%`);
          } else {
            qualityScore = 5;
            warnings.push(`ROE muito baixo de ${(roe * 100).toFixed(1)}%`);
            isEligible = false;
          }
        } else {
          warnings.push('ROE não disponível');
          isEligible = false;
        }
      } else {
        qualityIndicator = 'ROIC';
        qualityValue = roic;
        keyMetrics.roic = roic;
        
        if (roic !== null) {
          if (roic >= minROIC) {
            qualityScore = 35;
            reasons.push(`Excelente ROIC de ${(roic * 100).toFixed(1)}% (empresa com dívida)`);
          } else if (roic >= 0.10) {
            qualityScore = 25;
            reasons.push(`ROIC adequado de ${(roic * 100).toFixed(1)}%`);
          } else if (roic >= 0.05) {
            qualityScore = 15;
            warnings.push(`ROIC baixo de ${(roic * 100).toFixed(1)}%`);
          } else {
            qualityScore = 5;
            warnings.push(`ROIC muito baixo de ${(roic * 100).toFixed(1)}%`);
            isEligible = false;
          }
        } else {
          warnings.push('ROIC não disponível');
          isEligible = false;
        }
      }
    }

    // PASSO 2: Analisar Preço da Ação (P/L ou EV/EBITDA)
    let priceScore = 0;
    let priceIndicator = '';
    let priceValue: number | null = null;

    if (isBankOrInsurance) {
      // Para bancos e seguradoras: usar apenas P/L
      priceIndicator = 'P/L';
      priceValue = pl;
      keyMetrics.pl = pl;
      
      if (pl !== null && pl > 0) {
        if (pl <= 8) {
          priceScore = 30;
          reasons.push(`P/L muito atrativo de ${pl.toFixed(1)}x para ${setor}`);
        } else if (pl <= 12) {
          priceScore = 25;
          reasons.push(`P/L atrativo de ${pl.toFixed(1)}x`);
        } else if (pl <= 18) {
          priceScore = 15;
          reasons.push(`P/L moderado de ${pl.toFixed(1)}x`);
        } else if (pl <= 25) {
          priceScore = 10;
          warnings.push(`P/L elevado de ${pl.toFixed(1)}x`);
        } else {
          priceScore = 5;
          warnings.push(`P/L muito alto de ${pl.toFixed(1)}x`);
        }
      } else {
        warnings.push('P/L não disponível ou negativo');
        isEligible = false;
      }
    } else {
      // Para empresas normais: P/L se sem dívida, EV/EBITDA se com dívida
      if (!hasRelevantDebt) {
        priceIndicator = 'P/L vs CAGR Lucros 5a';
        priceValue = pl;
        keyMetrics.pl = pl;
        keyMetrics.cagrLucros5a = cagrLucros5a;
        
        if (pl !== null && pl > 0) {
          // Comparar P/L com CAGR de Lucros dos últimos 5 anos
          if (cagrLucros5a !== null && cagrLucros5a > 0) {
            const cagrPercent = cagrLucros5a * 100; // Converter para percentual
            
            // Regra: Ação é cara se P/L > CAGR de Lucros
            if (pl <= cagrPercent * 0.8) {
              priceScore = 30;
              reasons.push(`P/L ${pl.toFixed(1)}x vs CAGR 5a ${cagrPercent.toFixed(1)}% - muito atrativo (P/L < 80% CAGR)`);
            } else if (pl <= cagrPercent) {
              priceScore = 25;
              reasons.push(`P/L ${pl.toFixed(1)}x vs CAGR 5a ${cagrPercent.toFixed(1)}% - atrativo (P/L ≤ CAGR)`);
            } else if (pl <= cagrPercent * 1.5) {
              priceScore = 15;
              reasons.push(`P/L ${pl.toFixed(1)}x vs CAGR 5a ${cagrPercent.toFixed(1)}% - moderado (P/L até 150% CAGR)`);
            } else {
              priceScore = 5;
              warnings.push(`P/L ${pl.toFixed(1)}x maior que CAGR 5a ${cagrPercent.toFixed(1)}% - caro conforme regra 2.1`);
            }
          } else {
            // Se não tem CAGR 5a, avaliar P/L absoluto
            if (pl <= 10) {
              priceScore = 25;
              reasons.push(`P/L atrativo de ${pl.toFixed(1)}x (CAGR 5a não disponível)`);
            } else if (pl <= 15) {
              priceScore = 15;
              reasons.push(`P/L moderado de ${pl.toFixed(1)}x (CAGR 5a não disponível)`);
            } else {
              priceScore = 5;
              warnings.push(`P/L alto de ${pl.toFixed(1)}x (CAGR 5a não disponível)`);
            }
          }
        } else {
          warnings.push('P/L não disponível ou negativo');
          isEligible = false;
        }
      } else {
        priceIndicator = 'EV/EBITDA';
        priceValue = evEbitda;
        keyMetrics.evEbitda = evEbitda;
        
        if (evEbitda !== null && evEbitda > 0) {
          if (evEbitda <= 6) {
            priceScore = 30;
            reasons.push(`EV/EBITDA muito atrativo de ${evEbitda.toFixed(1)}x`);
          } else if (evEbitda <= 10) {
            priceScore = 25;
            reasons.push(`EV/EBITDA atrativo de ${evEbitda.toFixed(1)}x`);
          } else if (evEbitda <= 15) {
            priceScore = 15;
            reasons.push(`EV/EBITDA moderado de ${evEbitda.toFixed(1)}x`);
          } else if (evEbitda <= 20) {
            priceScore = 10;
            warnings.push(`EV/EBITDA elevado de ${evEbitda.toFixed(1)}x`);
          } else {
            priceScore = 5;
            warnings.push(`EV/EBITDA muito alto de ${evEbitda.toFixed(1)}x`);
          }
        } else {
          warnings.push('EV/EBITDA não disponível');
          isEligible = false;
        }
      }
    }

    // PASSO 3: Verificar Endividamento (exceto para bancos/seguradoras)
    let debtScore = 0;
    
    if (isBankOrInsurance) {
      debtScore = 20; // Score máximo para bancos/seguradoras (não analisamos dívida)
      reasons.push('Endividamento não aplicável para bancos/seguradoras');
    } else {
      keyMetrics.dividaLiquidaEbitda = dividaLiquidaEbitda;
      
      if (dividaLiquidaEbitda !== null) {
        if (dividaLiquidaEbitda < 0) {
          debtScore = 20;
          reasons.push('Empresa com caixa líquido positivo (sem dívida líquida)');
        } else if (dividaLiquidaEbitda <= 1) {
          debtScore = 20;
          reasons.push(`Endividamento muito baixo: ${dividaLiquidaEbitda.toFixed(1)}x EBITDA`);
        } else if (dividaLiquidaEbitda <= 2) {
          debtScore = 15;
          reasons.push(`Endividamento baixo: ${dividaLiquidaEbitda.toFixed(1)}x EBITDA`);
        } else if (dividaLiquidaEbitda <= maxDebtToEbitda) {
          debtScore = 10;
          warnings.push(`Endividamento moderado: ${dividaLiquidaEbitda.toFixed(1)}x EBITDA`);
        } else {
          debtScore = 0;
          warnings.push(`Endividamento alto: ${dividaLiquidaEbitda.toFixed(1)}x EBITDA (>3x)`);
          isEligible = false;
        }
      } else {
        debtScore = 10; // Benefício da dúvida se não tem dados
        warnings.push('Dados de endividamento não disponíveis');
      }
    }

    // PASSO 4 (BÔNUS): Análise de Dividendos
    let dividendScore = 0;
    
    keyMetrics.payout = payout;
    keyMetrics.dy = dy;
    
    if (payout !== null && dy !== null) {
      if (payout >= minPayout && payout <= maxPayout && dy >= 0.04) {
        dividendScore = 15;
        reasons.push(`Excelente pagadora de dividendos: Payout ${(payout * 100).toFixed(1)}%, DY ${(dy * 100).toFixed(1)}%`);
      } else if (payout >= minPayout && dy >= 0.02) {
        dividendScore = 10;
        reasons.push(`Boa pagadora de dividendos: Payout ${(payout * 100).toFixed(1)}%`);
      } else if (payout > 0 && dy > 0) {
        dividendScore = 5;
        reasons.push(`Paga dividendos moderados: Payout ${(payout * 100).toFixed(1)}%`);
      } else {
        dividendScore = 0;
        warnings.push('Não paga dividendos ou payout muito baixo');
      }
    } else if (dy !== null && dy >= 0.04) {
      dividendScore = 8;
      reasons.push(`Bom dividend yield: ${(dy * 100).toFixed(1)}%`);
    } else {
      dividendScore = 0;
      warnings.push('Dados de dividendos não disponíveis ou insuficientes');
    }

    // Calcular score final
    score = qualityScore + priceScore + debtScore + dividendScore;
    
    // Garantir que score não exceda 100
    score = Math.min(score, 100);

    // Adicionar métricas principais ao keyMetrics
    keyMetrics.fundamentalistScore = score;
    keyMetrics.qualityIndicator = qualityValue;
    keyMetrics.priceIndicator = priceValue;

    // Gerar rational detalhado
    const rational = this.generateDetailedRational(
      qualityIndicator,
      qualityValue,
      priceIndicator,
      priceValue,
      dividaLiquidaEbitda,
      payout,
      dy,
      cagrLucros5a,
      isBankOrInsurance,
      hasRelevantDebt,
      reasons,
      warnings
    );

    // Criar critérios baseados nos scores individuais
    const criteria = [
      {
        label: 'Qualidade da Empresa',
        description: `${qualityIndicator}: ${qualityValue !== null ? (qualityValue * 100).toFixed(1) + '%' : 'N/A'}`,
        value: qualityScore >= 25, // Considera bom se score >= 25
        weight: 35
      },
      {
        label: 'Preço Atrativo',
        description: `${priceIndicator}: ${priceValue !== null ? priceValue.toFixed(1) + 'x' : 'N/A'}`,
        value: priceScore >= 20, // Considera bom se score >= 20
        weight: 30
      },
      {
        label: 'Endividamento Controlado',
        description: isBankOrInsurance ? 'N/A (Banco/Seguradora)' : `Dívida/EBITDA: ${dividaLiquidaEbitda !== null ? dividaLiquidaEbitda.toFixed(1) + 'x' : 'N/A'}`,
        value: debtScore >= 15, // Considera bom se score >= 15
        weight: 20
      },
      {
        label: 'Dividendos (Bônus)',
        description: `Payout: ${payout !== null ? (payout * 100).toFixed(1) + '%' : 'N/A'}, DY: ${dy !== null ? (dy * 100).toFixed(1) + '%' : 'N/A'}`,
        value: dividendScore >= 8, // Considera bom se score >= 8
        weight: 15
      }
    ];

    return {
      score,
      isEligible,
      fairValue: null, // Esta estratégia não calcula preço justo
      upside: null,
      reasoning: rational,
      criteria,
      key_metrics: keyMetrics
    };
  }

  private isBankOrInsurance(setor: string): boolean {
    const bankInsuranceSectors = [
      'bancos',
      'seguradoras',
      'previdência',
      'serviços financeiros',
      'intermediários financeiros'
    ];
    
    return bankInsuranceSectors.some(sector => 
      setor.toLowerCase().includes(sector.toLowerCase())
    );
  }


  private generateDetailedRational(
    qualityIndicator: string,
    qualityValue: number | null,
    priceIndicator: string,
    priceValue: number | null,
    dividaLiquidaEbitda: number | null,
    payout: number | null,
    dy: number | null,
    cagrLucros5a: number | null,
    isBankOrInsurance: boolean,
    hasRelevantDebt: boolean,
    reasons: string[],
    warnings: string[]
  ): string {
    // Determinar status geral
    const qualityStatus = qualityValue && qualityValue >= 0.15 ? '✅' : qualityValue && qualityValue >= 0.10 ? '🟡' : '❌';
    const qualityText = qualityValue ? `${(qualityValue * 100).toFixed(1)}%` : 'N/D';
    
    let priceStatus = '❌';
    let priceText = priceValue ? `${priceValue.toFixed(1)}x` : 'N/D';
    
    if (priceValue) {
      if (priceIndicator.includes('vs CAGR') && cagrLucros5a && cagrLucros5a > 0) {
        const cagrPercent = cagrLucros5a * 100;
        priceStatus = priceValue <= cagrPercent ? '✅' : '❌';
        priceText = `${priceValue.toFixed(1)}x vs CAGR ${cagrPercent.toFixed(1)}%`;
      } else if (priceIndicator === 'EV/EBITDA') {
        priceStatus = priceValue <= 10 ? '✅' : '❌';
      } else if (priceIndicator === 'P/L') {
        priceStatus = priceValue <= 12 ? '✅' : '❌';
      }
    }
    
    const debtStatus = isBankOrInsurance ? '✅' : 
                     dividaLiquidaEbitda === null ? '🟡' :
                     dividaLiquidaEbitda < 0 ? '✅' :
                     dividaLiquidaEbitda <= 3 ? '✅' : '❌';
    
    const debtText = isBankOrInsurance ? 'N/A (setor especial)' :
                    dividaLiquidaEbitda === null ? 'N/D' :
                    dividaLiquidaEbitda < 0 ? 'Caixa positivo' :
                    `${dividaLiquidaEbitda.toFixed(1)}x EBITDA`;
    
    const dividendStatus = payout && dy && payout >= 0.40 && dy >= 0.04 ? '✅' :
                          payout && dy && payout >= 0.40 && dy >= 0.02 ? '🟡' : '❌';
    
    const dividendText = payout && dy ? `Payout ${(payout * 100).toFixed(1)}%, DY ${(dy * 100).toFixed(1)}%` : 'N/D';

    return `**Análise Fundamentalista 3+1**: Esta empresa ${isBankOrInsurance ? '(banco/seguradora)' : hasRelevantDebt ? '(com dívida)' : '(sem dívida)'} apresenta **Qualidade** ${qualityStatus} ${qualityText} (${qualityIndicator}), **Preço** ${priceStatus} ${priceText} (${priceIndicator}), **Endividamento** ${debtStatus} ${debtText}, e **Dividendos** ${dividendStatus} ${dividendText}. ${reasons.length > 0 ? 'Pontos fortes: ' + reasons.slice(0, 2).join(', ') + '.' : ''} ${warnings.length > 0 ? 'Atenção: ' + warnings.slice(0, 2).join(', ') + '.' : ''}`;
  }

  runRanking(companies: CompanyData[], params: FundamentalistParams): RankBuilderResult[] {
    const results: RankBuilderResult[] = [];
    
    // Filtrar empresas por tamanho se especificado
    const filteredCompanies = this.filterCompaniesBySize(companies, params.companySize || 'all');
    
    for (const company of filteredCompanies) {
      if (!this.validateCompanyData(company, params)) continue;
      
      const analysis = this.runAnalysis(company, params);
      if (analysis.isEligible) {
        results.push(this.convertToRankingResult(company, analysis));
      }
    }
    
    // Ordenar por score (maior primeiro)
    results.sort((a, b) => {
      const scoreA = a.key_metrics?.fundamentalistScore || 0;
      const scoreB = b.key_metrics?.fundamentalistScore || 0;
      return scoreB - scoreA;
    });
    
    // Aplicar limite se especificado
    const limit = params.limit || 10;
    return results.slice(0, limit);
  }

  generateRational(params: FundamentalistParams): string {
    const minROE = ((params.minROE || 0.15) * 100).toFixed(0);
    const minROIC = ((params.minROIC || 0.15) * 100).toFixed(0);
    const maxDebt = (params.maxDebtToEbitda || 3.0).toFixed(1);
    const minPayout = ((params.minPayout || 0.40) * 100).toFixed(0);
    const maxPayout = ((params.maxPayout || 0.80) * 100).toFixed(0);
    
    const sizeFilter = params.companySize || 'all';
    const sizeDescription = {
      'all': 'Todas as empresas',
      'small_caps': 'Small Caps (< R$ 2 bi)',
      'mid_caps': 'Empresas Médias (R$ 2-10 bi)',
      'blue_chips': 'Blue Chips (> R$ 10 bi)'
    }[sizeFilter];
    
    return `**ESTRATÉGIA FUNDAMENTALISTA 3+1**

**Filosofia**: Análise fundamentalista simplificada usando apenas 3 indicadores essenciais para tomar decisões de investimento rápidas e precisas.

**Metodologia Adaptativa**:
• **Empresas SEM dívida relevante**: ROE + P/L vs CAGR Lucros 5a + Endividamento
• **Empresas COM dívida relevante**: ROIC + EV/EBITDA + Endividamento  
• **Bancos/Seguradoras**: ROE + P/L (endividamento não aplicável)
• **Bônus Dividendos**: Payout + Dividend Yield para renda passiva

**Parâmetros Aplicados**:
• **Filtro de Tamanho**: ${sizeDescription}
• **ROE Mínimo**: ${minROE}% (empresas sem dívida)
• **ROIC Mínimo**: ${minROIC}% (empresas com dívida)
• **Dívida Líquida/EBITDA**: Máximo ${maxDebt}x
• **Payout Ideal**: ${minPayout}% - ${maxPayout}% (análise de dividendos)

**Resultado**: Empresas de qualidade com preços atrativos e endividamento controlado, ranqueadas por score fundamentalista.`;
  }

  validateCompanyData(companyData: CompanyData, params: FundamentalistParams): boolean {
    const financialData = companyData.financials;
    
    // Verificações básicas
    if (!financialData || companyData.currentPrice <= 0) return false;
    
    // Deve ter pelo menos ROE ou ROIC
    const hasROE = toNumber(financialData.roe) !== null;
    const hasROIC = toNumber(financialData.roic) !== null;
    
    if (!hasROE && !hasROIC) return false;
    
    return true;
  }
}
