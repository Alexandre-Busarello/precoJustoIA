import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { ticker: string } }
) {
  try {
    const { ticker } = params;
    const { searchParams } = new URL(request.url);
    const indicator = searchParams.get('indicator');

    if (!indicator) {
      return NextResponse.json(
        { error: 'Parâmetro indicator é obrigatório' },
        { status: 400 }
      );
    }

    // Buscar a empresa
    const company = await prisma.company.findUnique({
      where: { ticker: ticker.toUpperCase() }
    });

    if (!company) {
      return NextResponse.json(
        { error: 'Empresa não encontrada' },
        { status: 404 }
      );
    }

    // Mapeamento dos nomes dos indicadores para os campos do banco
    const indicatorMapping: Record<string, string> = {
      // Valuation
      'pl': 'pl',
      'pvp': 'pvp',
      'dy': 'dy',
      'ev_ebitda': 'evEbitda',
      'ev_ebit': 'evEbit',
      'psr': 'psr',
      'p_ativos': 'pAtivos',
      'p_cap_giro': 'pCapGiro',
      'p_ebit': 'pEbit',
      'lpa': 'lpa',
      'vpa': 'vpa',
      
      // Rentabilidade
      'roe': 'roe',
      'roic': 'roic',
      'roa': 'roa',
      'margem_bruta': 'margemBruta',
      'margem_ebitda': 'margemEbitda',
      'margem_liquida': 'margemLiquida',
      'giro_ativos': 'giroAtivos',
      
      // Endividamento e Liquidez
      'divida_liquida_pl': 'dividaLiquidaPl',
      'divida_liquida_ebitda': 'dividaLiquidaEbitda',
      'liquidez_corrente': 'liquidezCorrente',
      'liquidez_rapida': 'liquidezRapida',
      'passivo_ativos': 'passivoAtivos',
      'debt_to_equity': 'debtToEquity',
      
      // Dados de Mercado
      'market_cap': 'marketCap',
      'enterprise_value': 'enterpriseValue',
      'shares_outstanding': 'sharesOutstanding',
      'variacao_52_semanas': 'variacao52Semanas',
      'retorno_ano_atual': 'retornoAnoAtual',
      
      // Crescimento
      'cagr_lucros_5a': 'cagrLucros5a',
      'crescimento_lucros': 'crescimentoLucros',
      'crescimento_receitas': 'crescimentoReceitas',
      
      // Dividendos
      'dividend_yield_12m': 'dividendYield12m',
      'ultimo_dividendo': 'ultimoDividendo',
      'payout': 'payout'
    };

    const dbField = indicatorMapping[indicator];
    
    if (!dbField) {
      return NextResponse.json(
        { error: 'Indicador não suportado' },
        { status: 400 }
      );
    }

    // Buscar dados históricos ordenados por ano (últimos 5 anos)
    const currentYear = new Date().getFullYear();
    const fiveYearsAgo = currentYear - 5;
    
    const historicalData = await prisma.financialData.findMany({
      where: {
        companyId: company.id,
        year: {
          gte: fiveYearsAgo
        },
        [dbField]: {
          not: null
        }
      },
      select: {
        year: true,
        [dbField]: true
      },
      orderBy: {
        year: 'asc'
      }
    });

    // Indicadores que são percentuais (precisam ser multiplicados por 100)
    const percentualIndicators = [
      'dy', 'roe', 'roic', 'roa', 'margem_bruta', 'margem_ebitda', 'margem_liquida',
      'crescimento_lucros', 'crescimento_receitas', 'dividend_yield_12m', 'payout',
      'variacao_52_semanas', 'retorno_ano_atual'
    ];

    const isPercentual = percentualIndicators.includes(indicator);

    // Formatar dados para o gráfico
    const chartData = historicalData.map(data => {
      let value = Number(data[dbField as keyof typeof data]) || 0;
      // Converter para percentual se necessário
      if (isPercentual && value < 1 && value > -1) {
        value = value * 100;
      }
      return {
        year: data.year,
        value: value
      };
    });

    // Informações do indicador para o frontend
    const indicatorInfo = getIndicatorInfo(indicator);

    return NextResponse.json({
      ticker: ticker.toUpperCase(),
      indicator,
      indicatorInfo,
      data: chartData,
      dataPoints: chartData.length
    });

  } catch (error) {
    console.error('Erro ao buscar dados históricos:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    );
  }
}

// Função para obter informações sobre cada indicador
function getIndicatorInfo(indicator: string) {
  const indicatorInfoMap: Record<string, { name: string; unit: string; description: string }> = {
    // Valuation
    'pl': {
      name: 'P/L (Preço/Lucro)',
      unit: 'x',
      description: 'Relação entre o preço da ação e o lucro por ação'
    },
    'pvp': {
      name: 'P/VP (Preço/Valor Patrimonial)',
      unit: 'x',
      description: 'Relação entre o preço da ação e o valor patrimonial por ação'
    },
    'dy': {
      name: 'Dividend Yield',
      unit: '%',
      description: 'Percentual de dividendos pagos em relação ao preço da ação'
    },
    'ev_ebitda': {
      name: 'EV/EBITDA',
      unit: 'x',
      description: 'Relação entre o valor da empresa e o EBITDA'
    },
    'ev_ebit': {
      name: 'EV/EBIT',
      unit: 'x',
      description: 'Relação entre o valor da empresa e o EBIT'
    },
    'psr': {
      name: 'P/S (Preço/Receita)',
      unit: 'x',
      description: 'Relação entre o preço da ação e a receita por ação'
    },
    'lpa': {
      name: 'LPA (Lucro por Ação)',
      unit: 'R$',
      description: 'Lucro líquido dividido pelo número de ações'
    },
    'vpa': {
      name: 'VPA (Valor Patrimonial por Ação)',
      unit: 'R$',
      description: 'Patrimônio líquido dividido pelo número de ações'
    },
    
    // Rentabilidade
    'roe': {
      name: 'ROE (Return on Equity)',
      unit: '%',
      description: 'Retorno sobre o patrimônio líquido'
    },
    'roic': {
      name: 'ROIC (Return on Invested Capital)',
      unit: '%',
      description: 'Retorno sobre o capital investido'
    },
    'roa': {
      name: 'ROA (Return on Assets)',
      unit: '%',
      description: 'Retorno sobre os ativos'
    },
    'margem_bruta': {
      name: 'Margem Bruta',
      unit: '%',
      description: 'Percentual da receita que resta após custos diretos'
    },
    'margem_ebitda': {
      name: 'Margem EBITDA',
      unit: '%',
      description: 'EBITDA como percentual da receita'
    },
    'margem_liquida': {
      name: 'Margem Líquida',
      unit: '%',
      description: 'Lucro líquido como percentual da receita'
    },
    
    // Endividamento e Liquidez
    'divida_liquida_pl': {
      name: 'Dívida Líquida/PL',
      unit: 'x',
      description: 'Relação entre dívida líquida e patrimônio líquido'
    },
    'divida_liquida_ebitda': {
      name: 'Dívida Líquida/EBITDA',
      unit: 'x',
      description: 'Capacidade de pagamento da dívida'
    },
    'liquidez_corrente': {
      name: 'Liquidez Corrente',
      unit: 'x',
      description: 'Capacidade de pagamento de obrigações de curto prazo'
    },
    'debt_to_equity': {
      name: 'Dívida/Patrimônio',
      unit: 'x',
      description: 'Relação entre dívida total e patrimônio líquido'
    },
    
    // Crescimento
    'crescimento_lucros': {
      name: 'Crescimento dos Lucros',
      unit: '%',
      description: 'Taxa de crescimento anual dos lucros'
    },
    'crescimento_receitas': {
      name: 'Crescimento das Receitas',
      unit: '%',
      description: 'Taxa de crescimento anual das receitas'
    }
  };

  return indicatorInfoMap[indicator] || {
    name: indicator.toUpperCase(),
    unit: '',
    description: 'Indicador financeiro'
  };
}
