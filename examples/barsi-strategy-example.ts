/**
 * Exemplo de uso da Estratégia Barsi
 * 
 * Este exemplo demonstra como usar o Método Barsi implementado
 * para encontrar oportunidades de investimento em dividendos.
 */

import { BarsiStrategy } from '../src/lib/strategies/barsi-strategy';
import { BarsiParams, CompanyData } from '../src/lib/strategies/types';

// Configuração da estratégia Barsi
const barsiParams: BarsiParams = {
  targetDividendYield: 0.06,      // Meta de 6% de dividend yield
  maxPriceToPayMultiplier: 1.0,   // Preço teto exato (sem margem adicional)
  minConsecutiveDividends: 5,     // Mínimo 5 anos consecutivos pagando dividendos
  maxDebtToEquity: 1.0,           // Máximo 100% de Dívida/PL
  minROE: 0.10,                   // ROE mínimo de 10%
  focusOnBEST: true,              // Focar apenas nos setores B.E.S.T.
  companySize: 'all',             // Todas as empresas
  useTechnicalAnalysis: false,    // Sem análise técnica (foco no longo prazo)
  use7YearAverages: true          // Usar médias de 7 anos
};

// Exemplo de empresa que atenderia aos critérios Barsi
const exemploEmpresaBarsi: CompanyData = {
  ticker: 'TAEE11',
  name: 'Transmissão Aliança de Energia Elétrica S.A.',
  sector: 'Energia Elétrica', // Setor perene (B.E.S.T.)
  currentPrice: 35.50,
  financials: {
    // Dividendos
    dy: 0.045,                    // 4.5% de dividend yield atual
    ultimoDividendo: 2.10,        // R$ 2,10 por ação no último ano
    payout: 0.65,                 // 65% de payout (sustentável)
    
    // Rentabilidade
    roe: 0.12,                    // 12% de ROE (boa rentabilidade)
    roa: 0.08,                    // 8% de ROA
    margemLiquida: 0.15,          // 15% de margem líquida
    
    // Endividamento e Liquidez
    dividaLiquidaPl: 0.80,        // 80% de Dívida/PL (controlado)
    liquidezCorrente: 1.5,        // 1.5 de liquidez corrente
    
    // Tamanho
    marketCap: 5000000000,        // R$ 5 bilhões de market cap
    
    // Outros indicadores
    pl: 12.5,                     // P/L de 12.5x
    pvp: 1.2,                     // P/VP de 1.2x
  },
  // Histórico consistente de dividendos (simulado)
  historicalFinancials: [
    { year: 2023, dy: 0.045, roe: 0.12, dividaLiquidaPl: 0.80 },
    { year: 2022, dy: 0.048, roe: 0.11, dividaLiquidaPl: 0.85 },
    { year: 2021, dy: 0.052, roe: 0.13, dividaLiquidaPl: 0.75 },
    { year: 2020, dy: 0.041, roe: 0.10, dividaLiquidaPl: 0.90 },
    { year: 2019, dy: 0.055, roe: 0.14, dividaLiquidaPl: 0.70 },
  ]
};

// Exemplo de uso da estratégia
async function exemploUsoBarsi() {
  const strategy = new BarsiStrategy();
  
  console.log('=== MÉTODO BARSI - EXEMPLO DE USO ===\n');
  
  // 1. Gerar racional da estratégia
  console.log('1. RACIONAL DA ESTRATÉGIA:');
  console.log(strategy.generateRational(barsiParams));
  console.log('\n' + '='.repeat(80) + '\n');
  
  // 2. Analisar empresa individual
  console.log('2. ANÁLISE INDIVIDUAL - TAEE11:');
  const analysis = await strategy.runAnalysis(exemploEmpresaBarsi, barsiParams);
  
  console.log(`Empresa: ${exemploEmpresaBarsi.name} (${exemploEmpresaBarsi.ticker})`);
  console.log(`Setor: ${exemploEmpresaBarsi.sector}`);
  console.log(`Preço Atual: R$ ${exemploEmpresaBarsi.currentPrice.toFixed(2)}`);
  console.log(`\nResultado: ${analysis.isEligible ? '✅ APROVADA' : '❌ REPROVADA'}`);
  console.log(`Score: ${analysis.score.toFixed(1)}/100`);
  console.log(`Preço Teto: R$ ${analysis.fairValue?.toFixed(2) || 'N/A'}`);
  console.log(`Desconto do Teto: ${analysis.upside?.toFixed(1) || 'N/A'}%`);
  console.log(`\nRaciocínio: ${analysis.reasoning}`);
  
  console.log('\nCritérios Avaliados:');
  analysis.criteria.forEach(criterion => {
    const status = criterion.value ? '✅' : '❌';
    console.log(`${status} ${criterion.label}: ${criterion.description}`);
  });
  
  if (analysis.key_metrics) {
    console.log('\nMétricas Principais:');
    console.log(`- Preço Teto: R$ ${analysis.key_metrics.ceilingPrice?.toFixed(2)}`);
    console.log(`- Desconto do Teto: ${analysis.key_metrics.discountFromCeiling?.toFixed(1)}%`);
    console.log(`- Score Barsi: ${analysis.key_metrics.barsiScore}/100`);
    console.log(`- Dividend Yield: ${(analysis.key_metrics.dividendYield! * 100).toFixed(1)}%`);
    console.log(`- Média Dividendo 5-6 anos: R$ ${analysis.key_metrics.averageDividend?.toFixed(2)}`);
    console.log(`- ROE: ${(analysis.key_metrics.roe! * 100).toFixed(1)}%`);
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
  
  // 3. Explicar o cálculo do preço teto
  console.log('3. CÁLCULO DO PREÇO TETO (CONCEITO CENTRAL):');
  const dividendoPorAcao = exemploEmpresaBarsi.financials.ultimoDividendo as number;
  const dyMeta = barsiParams.targetDividendYield;
  const precoTeto = dividendoPorAcao / dyMeta;
  
  console.log(`Fórmula: Preço Teto = Dividendo por Ação ÷ DY Meta`);
  console.log(`Preço Teto = R$ ${dividendoPorAcao.toFixed(2)} ÷ ${(dyMeta * 100).toFixed(1)}%`);
  console.log(`Preço Teto = R$ ${precoTeto.toFixed(2)}`);
  console.log(`\nPreço Atual: R$ ${exemploEmpresaBarsi.currentPrice.toFixed(2)}`);
  console.log(`Desconto: ${(((precoTeto - exemploEmpresaBarsi.currentPrice) / precoTeto) * 100).toFixed(1)}%`);
  
  if (exemploEmpresaBarsi.currentPrice <= precoTeto) {
    console.log('✅ OPORTUNIDADE: Preço atual está abaixo do teto!');
    console.log('📈 Segundo Barsi, esta seria uma boa oportunidade de compra.');
  } else {
    console.log('❌ CARO: Preço atual está acima do teto.');
    console.log('⏳ Segundo Barsi, aguardar preço mais baixo.');
  }
  
  console.log('\n' + '='.repeat(80) + '\n');
  
  // 4. Explicar a filosofia do método
  console.log('4. FILOSOFIA DO MÉTODO BARSI:');
  console.log('🎯 OBJETIVO: Independência financeira através de renda passiva');
  console.log('📊 FOCO: Empresas de setores "perenes" (B.E.S.T.) com dividendos consistentes');
  console.log('💰 ESTRATÉGIA: Comprar apenas quando preço ≤ preço teto');
  console.log('🔄 DISCIPLINA: Aporte mensal + reinvestimento 100% dos dividendos');
  console.log('⏰ HORIZONTE: Longo prazo (20-30 anos) para efeito "bola de neve"');
  console.log('🚫 NÃO FAZ: Day trade, especulação, venda (exceto se perder fundamentos)');
  
  console.log('\n📈 EXEMPLO DE "BOLA DE NEVE":');
  console.log('Ano 1: 1.000 ações → R$ 2.100 dividendos → Compra +59 ações');
  console.log('Ano 2: 1.059 ações → R$ 2.224 dividendos → Compra +63 ações');
  console.log('Ano 3: 1.122 ações → R$ 2.356 dividendos → Compra +66 ações');
  console.log('...');
  console.log('Ano 20: ~3.200 ações → R$ 6.720 dividendos/ano');
  console.log('(Valores ilustrativos considerando crescimento dos dividendos)');
}

// Executar exemplo
if (require.main === module) {
  exemploUsoBarsi().catch(console.error);
}

export { exemploUsoBarsi, barsiParams, exemploEmpresaBarsi };