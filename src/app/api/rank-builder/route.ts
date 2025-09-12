import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Interfaces para os diferentes modelos
interface GrahamParams {
  marginOfSafety: number; // Ex: 0.3 para 30%
}

interface DividendYieldParams {
  minYield: number; // Ex: 0.06 para 6%
}

interface LowPEParams {
  maxPE: number; // Ex: 15 para P/L máximo de 15
  minROE?: number; // Ex: 0.15 para ROE mínimo de 15%
}

interface MagicFormulaParams {
  limit?: number; // Número de resultados (padrão 10)
}

type ModelParams = GrahamParams | DividendYieldParams | LowPEParams | MagicFormulaParams;

interface RankBuilderRequest {
  model: 'graham' | 'dividendYield' | 'lowPE' | 'magicFormula';
  params: ModelParams;
}

interface RankBuilderResult {
  ticker: string;
  name: string;
  sector: string | null;
  currentPrice: number;
  fairValue: number | null;
  upside: number | null; // Potencial de alta em %
  marginOfSafety: number | null; // Margem de segurança em %
  rational: string; // Explicação detalhada da estratégia e critérios aplicados
  key_metrics?: Record<string, number | null>; // Métricas relevantes para o modelo
}

// Função para gerar o racional de cada modelo
function generateRational(model: string, params: ModelParams): string {
  switch (model) {
    case 'graham':
      const grahamParams = params as GrahamParams;
      return `**MODELO GRAHAM APRIMORADO**

**Filosofia**: Baseado na fórmula clássica de Benjamin Graham para encontrar ações baratas de empresas sólidas.

**Estratégia**: Preço Justo = √(22.5 × LPA × VPA), buscando margem de segurança de ${(grahamParams.marginOfSafety * 100).toFixed(0)}%.

**Filtros de Qualidade Aplicados**:
• ROE ≥ 10% (rentabilidade consistente)
• Liquidez Corrente ≥ 1.0 (capacidade de honrar compromissos)
• Margem Líquida > 0% (empresa lucrativa)
• Crescimento Lucros ≥ -15% (não em declínio severo)
• Dívida Líquida/PL ≤ 150% (endividamento controlado)

**Ordenação**: Por Score de Qualidade (combina solidez financeira + margem de segurança).

**Objetivo**: Encontrar empresas subvalorizadas MAS financeiramente saudáveis, evitando "value traps".`;

    case 'dividendYield':
      const dividendParams = params as DividendYieldParams;
      return `**MODELO ANTI-DIVIDEND TRAP**

**Filosofia**: Focado em renda passiva sustentável, evitando empresas que pagam dividendos altos mas estão em declínio.

**Estratégia**: Dividend Yield ≥ ${(dividendParams.minYield * 100).toFixed(1)}% + rigorosos filtros de sustentabilidade.

**Problema Resolvido**: Elimina "dividend traps" - empresas com DY artificial por queda no preço ou dividendos insustentáveis.

**Filtros Anti-Trap**:
• ROE ≥ 10% (rentabilidade forte e consistente)
• Liquidez Corrente ≥ 1.2 (capacidade real de pagar dividendos)
• P/L entre 5-25 (evita preços artificiais ou empresas caras demais)
• Margem Líquida ≥ 5% (lucratividade real e saudável)
• Dívida Líquida/PL ≤ 100% (não comprometida por dívidas)
• Market Cap ≥ R$ 1B (tamanho e liquidez adequados)

**Ordenação**: Por Score de Sustentabilidade (combina DY + saúde financeira).

**Objetivo**: Renda passiva de qualidade, não armadilhas disfarçadas.`;

    case 'lowPE':
      const lowPEParams = params as LowPEParams;
      return `💎 **MODELO VALUE INVESTING**

**Filosofia**: Baseado no value investing clássico - empresas baratas (baixo P/L) MAS de qualidade comprovada.

**Estratégia**: P/L ≤ ${lowPEParams.maxPE} + ROE ≥ ${((lowPEParams.minROE || 0) * 100).toFixed(0)}% + filtros rigorosos de qualidade.

**Problema Resolvido**: Evita "value traps" - ações baratas que continuam caindo por problemas fundamentais.

**Filtros Anti-Value Trap**:
• P/L > 3 (evita preços suspeitosamente baixos)
• ROA ≥ 5% (eficiência na gestão dos ativos)
• Crescimento Receitas ≥ -10% (não em forte declínio operacional)
• Margem Líquida ≥ 3% (operação rentável e sustentável)
• Liquidez Corrente ≥ 1.0 (situação financeira adequada)
• Dívida Líquida/PL ≤ 200% (endividamento não excessivo)
• Market Cap ≥ R$ 500M (liquidez e estabilidade mínimas)

**Ordenação**: Por Value Score (combina preço atrativo + indicadores de qualidade).

**Objetivo**: Empresas baratas que são REALMENTE bons negócios, não problemas disfarçados.`;

    case 'magicFormula':
      const magicParams = params as MagicFormulaParams;
      return `🧙‍♂️ **FÓRMULA MÁGICA APRIMORADA**

**Filosofia**: Baseada na metodologia de Joel Greenblatt, buscando empresas com alta qualidade operacional a preços atrativos.

**Estratégia**: Ranking duplo por ROIC (qualidade) + Earnings Yield (preço), retornando ${magicParams.limit || 10} melhores empresas.

**Melhorias Implementadas**:
• ROIC Ajustado por margem EBITDA e crescimento
• Filtros adicionais de qualidade financeira
• Eliminação de empresas em declínio operacional

**Filtros de Qualidade**:
• ROIC > 0% (retorno eficiente sobre capital investido)
• ROE ≥ 8% (rentabilidade mínima sobre patrimônio)
• Margem EBITDA ≥ 10% (operação eficiente e rentável)
• Crescimento Receitas ≥ -15% (não em declínio severo)
• Liquidez Corrente ≥ 1.0 (situação financeira não crítica)
• Market Cap ≥ R$ 1B (empresas consolidadas e líquidas)

**Metodologia**:
1. Ranking por ROIC Ajustado (maior = melhor qualidade)
2. Ranking por Earnings Yield (maior = melhor preço)
3. Soma dos rankings (menor pontuação = melhor combinação)

**Objetivo**: Empresas com excelente retorno sobre capital investido disponíveis a preços atrativos.`;

    default:
      return 'Modelo não encontrado.';
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: RankBuilderRequest = await request.json();
    const { model, params } = body;

    // Validação básica
    if (!model || !params) {
      return NextResponse.json(
        { error: 'Model e params são obrigatórios' },
        { status: 400 }
      );
    }

    // Verificar se o usuário está autenticado para salvar histórico
    const session = await getServerSession(authOptions);

    let results: RankBuilderResult[] = [];

    switch (model) {
      case 'graham':
        results = await processGrahamModel(params as GrahamParams);
        break;
      case 'dividendYield':
        results = await processDividendYieldModel(params as DividendYieldParams);
        break;
      case 'lowPE':
        results = await processLowPEModel(params as LowPEParams);
        break;
      case 'magicFormula':
        results = await processMagicFormulaModel(params as MagicFormulaParams);
        break;
      default:
        return NextResponse.json(
          { error: `Modelo '${model}' não suportado` },
          { status: 400 }
        );
    }

    // Gerar racional para o modelo usado
    const rational = generateRational(model, params);

    // Salvar no histórico se o usuário estiver logado
    if (session?.user?.id) {
      try {
        await prisma.rankingHistory.create({
          data: {
            userId: session.user.id,
            model,
            params: JSON.parse(JSON.stringify(params)), // Conversão para Json type
            results: JSON.parse(JSON.stringify(results)), // Cache dos resultados como Json
            resultCount: results.length,
          }
        });
      } catch (historyError) {
        // Não falhar a request se não conseguir salvar no histórico
        console.error('Erro ao salvar histórico:', historyError);
      }
    }

    return NextResponse.json({
      model,
      params,
      rational,
      results,
      count: results.length
    });

  } catch (error) {
    console.error('Erro na API rank-builder:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// === MODELO DE GRAHAM APRIMORADO ===
async function processGrahamModel(params: GrahamParams): Promise<RankBuilderResult[]> {
  const { marginOfSafety } = params;

  // Buscar dados com critérios de qualidade
  const companies = await prisma.company.findMany({
    include: {
      financialData: {
        orderBy: { reportDate: 'desc' },
        take: 1, // Dados mais recentes
      },
      dailyQuotes: {
        orderBy: { date: 'desc' },
        take: 1, // Cotação mais recente
      }
    },
    where: {
      financialData: {
        some: {
          AND: [
            // Critérios básicos do Graham
            { lpa: { not: null } },
            { lpa: { gt: 0 } }, // LPA positivo
            { vpa: { not: null } },
            { vpa: { gt: 0 } }, // VPA positivo
            
            // === FILTROS DE QUALIDADE ===
            // 1. Rentabilidade consistente
            { roe: { not: null } },
            { roe: { gte: 0.10 } }, // ROE >= 10% (em decimal)
            
            // 2. Situação financeira sólida
            { liquidezCorrente: { not: null } },
            { liquidezCorrente: { gte: 1.0 } }, // LC >= 1.0
            
            // 3. Empresa lucrativa
            { margemLiquida: { not: null } },
            { margemLiquida: { gt: 0 } }, // Margem positiva
            
            // 4. Não muito endividada
            { dividaLiquidaPl: { lte: 1.5 } }, // Dívida Líquida/PL <= 150%
            
            // 5. Crescimento não negativo
            { crescimentoLucros: { gte: -0.15 } }, // Queda máxima de 15% (decimal)
          ]
        }
      },
      dailyQuotes: {
        some: {}
      }
    }
  });

  const results: RankBuilderResult[] = [];

  for (const company of companies) {
    const latestFinancial = company.financialData[0];
    const latestQuote = company.dailyQuotes[0];

    if (!latestFinancial || !latestQuote) continue;

    const { 
      lpa, vpa, roe, liquidezCorrente, margemLiquida, 
      crescimentoLucros 
    } = latestFinancial;
    const currentPrice = Number(latestQuote.price);

    if (!lpa || !vpa || Number(lpa) <= 0 || Number(vpa) <= 0) continue;

    // Fórmula de Graham: Preço Justo = √(22.5 × LPA × VPA)
    const fairValue = Math.sqrt(22.5 * Number(lpa) * Number(vpa));
    const marginOfSafetyActual = (fairValue / currentPrice) - 1;

    // Filtrar apenas empresas com margem de segurança >= parâmetro
    if (marginOfSafetyActual >= marginOfSafety) {
      const upside = ((fairValue / currentPrice) - 1) * 100;

      // Score de qualidade para Graham (peso na solidez da empresa)
      const roeValue = roe ? Number(roe) : 0;
      const lcValue = liquidezCorrente ? Number(liquidezCorrente) : 0;
      const margem = margemLiquida ? Number(margemLiquida) : 0;
      const crescimento = crescimentoLucros ? Number(crescimentoLucros) : 0;
      
      const qualityScore = (
        Math.min(roeValue, 25) * 0.4 +        // ROE (peso alto)
        Math.min(lcValue, 2.5) * 20 +         // Liquidez
        Math.min(margem, 15) * 1.0 +          // Margem líquida
        Math.max(0, crescimento + 15) * 0.5   // Crescimento (penaliza declínio)
      );

      results.push({
        ticker: company.ticker,
        name: company.name,
        sector: company.sector,
        currentPrice,
        fairValue: Number(fairValue.toFixed(2)),
        upside: Number(upside.toFixed(2)),
        marginOfSafety: Number((marginOfSafetyActual * 100).toFixed(2)),
        rational: `Aprovada no Graham Quality Model com ${Number((marginOfSafetyActual * 100).toFixed(1))}% de margem de segurança. Empresa sólida: ROE ${Number((roeValue * 100)).toFixed(1)}%, LC ${Number((lcValue * 100)).toFixed(2)}, Margem Líquida ${Number((margem * 100)).toFixed(1)}%. Score de qualidade: ${Number(qualityScore.toFixed(1))}/100.`,
        key_metrics: {
          lpa: Number(lpa),
          vpa: Number(vpa),
          qualityScore: Number(qualityScore.toFixed(1)),
          pl: latestFinancial.pl ? Number(latestFinancial.pl) : null,
          pvp: latestFinancial.pvp ? Number(latestFinancial.pvp) : null,
          roe: roeValue,
          liquidezCorrente: lcValue,
          margemLiquida: margem,
          crescimentoLucros: crescimento,
        }
      });
    }
  }

  // Ordenar por qualidade (empresas sólidas primeiro)
  return results
    .sort((a, b) => (b.key_metrics?.qualityScore || 0) - (a.key_metrics?.qualityScore || 0))
    .slice(0, 10);
}

// === MODELO DE DIVIDEND YIELD APRIMORADO ===
async function processDividendYieldModel(params: DividendYieldParams): Promise<RankBuilderResult[]> {
  const { minYield } = params;

  const companies = await prisma.company.findMany({
    include: {
      financialData: {
        orderBy: { reportDate: 'desc' },
        take: 1,
      },
      dailyQuotes: {
        orderBy: { date: 'desc' },
        take: 1,
      }
    },
    where: {
      financialData: {
        some: {
          AND: [
            // Critérios básicos de DY
            { dy: { not: null } },
            { dy: { gte: minYield } }, // DY já em decimal no banco
            
            // === FILTROS DE QUALIDADE PARA EVITAR DIVIDEND TRAPS ===
            // 1. Rentabilidade consistente
            { roe: { not: null } },
            { roe: { gte: 0.10 } }, // ROE >= 10% (em decimal)
            
            // 2. Capacidade de pagar dividendos
            { liquidezCorrente: { not: null } },
            { liquidezCorrente: { gte: 1.2 } }, // LC >= 1.2
            
            // 3. Não excessivamente endividada
            { dividaLiquidaPl: { lte: 1.0 } }, // Dívida Líquida/PL <= 100%
            
            // 4. P/L razoável (evita empresas em declínio com DY artificial)
            { pl: { not: null } },
            { pl: { gte: 5 } },  // P/L >= 5 (não suspeito)
            { pl: { lte: 25 } }, // P/L <= 25 (não muito cara)
            
            // 5. Lucratividade real
            { margemLiquida: { not: null } },
            { margemLiquida: { gte: 0.05 } }, // Margem Líquida >= 5% (em decimal)
            
            // 6. Tamanho mínimo (liquidez e estabilidade)
            { marketCap: { gte: 1000000000 } }, // Market cap >= R$ 1B
          ]
        }
      },
      dailyQuotes: {
        some: {}
      }
    }
  });

  const results: RankBuilderResult[] = [];

  for (const company of companies) {
    const latestFinancial = company.financialData[0];
    const latestQuote = company.dailyQuotes[0];

    if (!latestFinancial || !latestQuote) continue;

    const { 
      dy, pl, roe, liquidezCorrente, dividaLiquidaPl, 
      margemLiquida, marketCap, roic 
    } = latestFinancial;
    
    const currentPrice = Number(latestQuote.price);

    if (!dy) continue;

    // Calcular "Score de Qualidade" para evitar dividend traps
    const dividendYield = Number(dy);
    const roeValue = roe ? Number(roe) : 0;
    const lcValue = liquidezCorrente ? Number(liquidezCorrente) : 0;
    const divPl = dividaLiquidaPl ? Number(dividaLiquidaPl) : 0;
    const margem = margemLiquida ? Number(margemLiquida) : 0;
    const roicValue = roic ? Number(roic) : 0;

    // Score de sustentabilidade (0-100): prioriza qualidade sobre DY puro
    const sustainabilityScore = (
      Math.min(roeValue, 30) * 0.25 +       // ROE forte (peso 25%)
      Math.min(lcValue, 3) * 15 +           // Liquidez adequada (peso alto)
      Math.max(0, 50 - divPl * 50) +        // Penaliza alta dívida
      Math.min(margem, 20) * 0.75 +         // Margem líquida saudável
      Math.min(roicValue, 25) * 0.2 +       // ROIC para eficiência
      dividendYield * 0.5                   // DY ainda importa, mas não domina
    );

    results.push({
      ticker: company.ticker,
      name: company.name,
      sector: company.sector,
      currentPrice,
      fairValue: null, // Não aplicável para modelo DY
      upside: null,
      marginOfSafety: null,
      rational: `Aprovada no Anti-Dividend Trap Model com DY ${dividendYield.toFixed(1)}%. Empresa sustentável: ROE ${roeValue.toFixed(1)}%, LC ${lcValue.toFixed(2)}, Margem Líquida ${margem.toFixed(1)}%. Score de sustentabilidade: ${Number(sustainabilityScore.toFixed(1))}/100. Evita dividend traps.`,
      key_metrics: {
        dy: dividendYield,
        sustainabilityScore: Number(sustainabilityScore.toFixed(1)),
        pl: pl ? Number(pl) : null,
        roe: roeValue,
        roic: roicValue,
        liquidezCorrente: lcValue,
        dividaLiquidaPl: divPl,
        margemLiquida: margem,
        marketCapBi: marketCap ? Number((Number(marketCap) / 1000000000).toFixed(1)) : null, // Em bilhões
      }
    });
  }

  // Ordenar por Score de Sustentabilidade (evita dividend traps!)
  return results
    .sort((a, b) => (b.key_metrics?.sustainabilityScore || 0) - (a.key_metrics?.sustainabilityScore || 0))
    .slice(0, 10);
}

// === MODELO DE BAIXO P/L APRIMORADO ===
async function processLowPEModel(params: LowPEParams): Promise<RankBuilderResult[]> {
  const { maxPE, minROE = 0 } = params;

  const companies = await prisma.company.findMany({
    include: {
      financialData: {
        orderBy: { reportDate: 'desc' },
        take: 1,
      },
      dailyQuotes: {
        orderBy: { date: 'desc' },
        take: 1,
      }
    },
    where: {
      financialData: {
        some: {
          AND: [
            // Critérios básicos de P/L
            { pl: { not: null } },
            { pl: { gt: 3 } },      // P/L > 3 (evita muito barato suspeito)
            { pl: { lte: maxPE } },
            { roe: { gte: minROE } }, // ROE já em decimal no banco
            
            // === FILTROS DE QUALIDADE ===
            // 1. Empresa não em forte declínio
            { crescimentoReceitas: { gte: -0.10 } }, // Queda máxima 10% receitas (decimal)
            
            // 2. Margens saudáveis
            { margemLiquida: { not: null } },
            { margemLiquida: { gte: 0.03 } }, // Margem Líquida >= 3% (em decimal)
            
            // 3. Situação financeira adequada
            { liquidezCorrente: { not: null } },
            { liquidezCorrente: { gte: 1.0 } }, // LC >= 1.0
            
            // 4. ROA positivo (eficiência dos ativos)
            { roa: { not: null } },
            { roa: { gte: 0.05 } }, // ROA >= 5% (em decimal)
            
            // 5. Não excessivamente endividada
            { dividaLiquidaPl: { lte: 2.0 } }, // Dívida Líquida/PL <= 200%
            
            // 6. Tamanho mínimo
            { marketCap: { gte: 500000000 } }, // Market cap >= R$ 500M
          ]
        }
      },
      dailyQuotes: {
        some: {}
      }
    }
  });

  const results: RankBuilderResult[] = [];

  for (const company of companies) {
    const latestFinancial = company.financialData[0];
    const latestQuote = company.dailyQuotes[0];

    if (!latestFinancial || !latestQuote) continue;

    const { 
      pl, roe, roa, margemLiquida, liquidezCorrente,
      crescimentoReceitas, roic 
    } = latestFinancial;
    const currentPrice = Number(latestQuote.price);

    if (!pl || !roe) continue;

    // Score de value investing (qualidade + preço baixo)
    const plValue = Number(pl);
    const roeValue = roe ? Number(roe) : 0;
    const roaValue = roa ? Number(roa) : 0;
    const margem = margemLiquida ? Number(margemLiquida) : 0;
    const crescimento = crescimentoReceitas ? Number(crescimentoReceitas) : 0;
    const roicValue = roic ? Number(roic) : 0;

    // Value Score: premia P/L baixo + qualidade alta
    const valueScore = (
      Math.max(0, 50 - plValue * 2) +         // Premia P/L baixo
      Math.min(roeValue, 30) * 0.5 +          // ROE forte
      Math.min(roaValue, 20) * 1.0 +          // ROA eficiente
      Math.min(margem, 20) * 0.8 +            // Margem saudável
      Math.max(0, crescimento + 10) * 0.3 +   // Crescimento não negativo
      Math.min(roicValue, 25) * 0.4           // ROIC para qualidade
    );

    results.push({
      ticker: company.ticker,
      name: company.name,
      sector: company.sector,
      currentPrice,
      fairValue: null,
      upside: null,
      marginOfSafety: null,
      rational: `Aprovada no Value Investing Model com P/L ${plValue.toFixed(1)}. Empresa de qualidade: ROE ${roeValue.toFixed(1)}%, ROA ${roaValue.toFixed(1)}%, Margem ${margem.toFixed(1)}%. Crescimento Receitas: ${crescimento.toFixed(1)}%. Value Score: ${Number(valueScore.toFixed(1))}/100. Não é value trap.`,
      key_metrics: {
        pl: plValue,
        valueScore: Number(valueScore.toFixed(1)),
        roe: roeValue,
        roa: roaValue,
        roic: roicValue,
        dy: latestFinancial.dy ? Number(latestFinancial.dy) : null,
        liquidezCorrente: liquidezCorrente ? Number(liquidezCorrente) : null,
        margemLiquida: margem,
        crescimentoReceitas: crescimento,
      }
    });
  }

  // Ordenar por Value Score (combina P/L baixo + qualidade)
  return results
    .sort((a, b) => (b.key_metrics?.valueScore || 0) - (a.key_metrics?.valueScore || 0))
    .slice(0, 10);
}

// === FÓRMULA MÁGICA APRIMORADA (GREENBLATT) ===
async function processMagicFormulaModel(params: MagicFormulaParams): Promise<RankBuilderResult[]> {
  const { limit = 10 } = params;

  const companies = await prisma.company.findMany({
    include: {
      financialData: {
        orderBy: { reportDate: 'desc' },
        take: 1,
      },
      dailyQuotes: {
        orderBy: { date: 'desc' },
        take: 1,
      }
    },
    where: {
      financialData: {
        some: {
          AND: [
            // Critérios básicos da Fórmula Mágica
            { roic: { not: null } },
            { roic: { gt: 0 } },
            { pl: { not: null } },
            { pl: { gt: 0 } },
            { marketCap: { gte: 1000000000 } }, // Market cap >= R$ 1B
            
            // === FILTROS DE QUALIDADE ADICIONAIS ===
            // 1. Empresa não em declínio forte
            { crescimentoReceitas: { gte: -0.15 } }, // Queda máxima 15% (decimal)
            
            // 2. Margens operacionais saudáveis
            { margemEbitda: { not: null } },
            { margemEbitda: { gte: 0.10 } }, // Margem EBITDA >= 10% (decimal)
            
            // 3. Situação financeira não crítica
            { liquidezCorrente: { not: null } },
            { liquidezCorrente: { gte: 1.0 } }, // LC >= 1.0
            
            // 4. ROE mínimo para qualidade
            { roe: { not: null } },
            { roe: { gte: 0.08 } }, // ROE >= 8% (decimal)
          ]
        }
      },
      dailyQuotes: {
        some: {}
      }
    }
  });

  const validCompanies = companies
    .map(company => {
      const latestFinancial = company.financialData[0];
      const latestQuote = company.dailyQuotes[0];

      if (!latestFinancial || !latestQuote) return null;

      const { roic, pl, margemEbitda, crescimentoReceitas } = latestFinancial;
      const currentPrice = Number(latestQuote.price);

      if (!roic || !pl || Number(roic) <= 0 || Number(pl) <= 0) return null;

      // Ajustar ROIC por qualidade da margem e crescimento
      const roicValue = Number(roic);
      const margemValue = margemEbitda ? Number(margemEbitda) : 0;
      const crescimento = crescimentoReceitas ? Number(crescimentoReceitas) : 0;
      
      // ROIC Ajustado: considera margem forte e crescimento
      const adjustedROIC = roicValue * (
        1 + Math.min(margemValue - 10, 20) * 0.01 +  // Premia margem > 10%
        Math.max(-0.15, crescimento) * 0.005          // Premia crescimento
      );

      return {
        company,
        latestFinancial,
        currentPrice,
        roic: adjustedROIC,
        pl: Number(pl),
        earningsYield: 1 / Number(pl), // Inverso do P/L
        margemEbitda: margemValue,
        crescimentoReceitas: crescimento,
      };
    })
    .filter(Boolean);

  // Ranking por ROIC Ajustado (maior = melhor)
  const sortedByROIC = [...validCompanies].sort((a, b) => b!.roic - a!.roic);
  const roicRanks = new Map();
  sortedByROIC.forEach((item, index) => {
    roicRanks.set(item!.company.ticker, index + 1);
  });

  // Ranking por Earnings Yield (maior = melhor, menor P/L)
  const sortedByEY = [...validCompanies].sort((a, b) => b!.earningsYield - a!.earningsYield);
  const eyRanks = new Map();
  sortedByEY.forEach((item, index) => {
    eyRanks.set(item!.company.ticker, index + 1);
  });

  // Calcular pontuação combinada (menor = melhor)
  const results: RankBuilderResult[] = validCompanies.map(item => {
    const roicRank = roicRanks.get(item!.company.ticker);
    const eyRank = eyRanks.get(item!.company.ticker);
    const combinedRank = roicRank + eyRank;

    return {
      ticker: item!.company.ticker,
      name: item!.company.name,
      sector: item!.company.sector,
      currentPrice: item!.currentPrice,
      fairValue: null,
      upside: null,
      marginOfSafety: null,
      rational: `Aprovada na Enhanced Magic Formula (Rank #${combinedRank}). ROIC Ajustado: ${Number(item!.roic.toFixed(1))}%, Earnings Yield: ${Number((item!.earningsYield * 100).toFixed(1))}%, P/L: ${item!.pl.toFixed(1)}. Margem EBITDA: ${item!.margemEbitda.toFixed(1)}%. Empresa com qualidade operacional + preço atrativo.`,
      key_metrics: {
        roic: Number(item!.roic.toFixed(2)),
        roicOriginal: item!.latestFinancial.roic ? Number(item!.latestFinancial.roic) : null,
        pl: item!.pl,
        earningsYield: Number((item!.earningsYield * 100).toFixed(2)),
        roicRank,
        eyRank,
        combinedRank,
        margemEbitda: item!.margemEbitda,
        crescimentoReceitas: item!.crescimentoReceitas,
        marketCapBi: item!.latestFinancial.marketCap ? 
          Number((Number(item!.latestFinancial.marketCap) / 1000000000).toFixed(1)) : null,
      }
    };
  });

  // Ordenar por pontuação combinada (menor = melhor)
  return results
    .sort((a, b) => (a.key_metrics?.combinedRank || Infinity) - (b.key_metrics?.combinedRank || Infinity))
    .slice(0, limit);
}
