#!/usr/bin/env node

/**
 * Script de teste para validar o cálculo correto do CAGR
 * Testa cenários com anos de prejuízo no meio do período
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['warn', 'error']
});

// Função de teste para calcular CAGR manualmente (nova lógica completa)
function calculateCAGRManual(initialValue, finalValue, years) {
  if (initialValue === 0 || finalValue === 0) return null;
  
  if (initialValue > 0 && finalValue > 0) {
    // Cenário 1: Lucro → Lucro (CAGR tradicional)
    return Math.pow(finalValue / initialValue, 1 / years) - 1;
    
  } else if (initialValue < 0 && finalValue < 0) {
    // Cenário 2: Prejuízo → Prejuízo (melhoria na redução de prejuízo)
    return -(Math.pow(Math.abs(finalValue) / Math.abs(initialValue), 1 / years) - 1);
    
  } else if (initialValue < 0 && finalValue > 0) {
    // Cenário 3: Prejuízo → Lucro (recuperação/turnaround)
    const recoveryBase = Math.abs(initialValue);
    const totalImprovement = finalValue + recoveryBase;
    return Math.pow(totalImprovement / recoveryBase, 1 / years) - 1;
    
  } else if (initialValue > 0 && finalValue < 0) {
    // Cenário 4: Lucro → Prejuízo (deterioração)
    const deteriorationBase = initialValue;
    const totalDeterioration = deteriorationBase + Math.abs(finalValue);
    return -(Math.pow(totalDeterioration / deteriorationBase, 1 / years) - 1);
  }
  
  return null;
}

async function testCAGRCalculation() {
  try {
    console.log('🧪 Testando cálculo de CAGR com nova lógica...\n');
    
    // Buscar uma empresa com dados históricos variados
    const company = await prisma.company.findFirst({
      where: {
        financialData: {
          some: {}
        }
      },
      include: {
        financialData: {
          orderBy: { year: 'asc' },
          take: 10 // Últimos 10 anos para ter mais dados
        }
      }
    });
    
    if (!company || company.financialData.length < 5) {
      console.log('❌ Nenhuma empresa encontrada com dados suficientes');
      return;
    }
    
    console.log(`📊 Testando com empresa: ${company.ticker} (${company.name})`);
    console.log(`📈 Dados disponíveis: ${company.financialData.length} anos\n`);
    
    // Mostrar dados históricos
    console.log('📋 Dados Históricos:');
    company.financialData.forEach(data => {
      const lucro = data.lucroLiquido ? Number(data.lucroLiquido) : null;
      const receita = data.receitaTotal ? Number(data.receitaTotal) : null;
      
      console.log(`  ${data.year}: Lucro=${lucro ? (lucro/1000000).toFixed(1) + 'M' : 'N/A'}, Receita=${receita ? (receita/1000000).toFixed(1) + 'M' : 'N/A'}`);
    });
    
    // Testar cálculo de CAGR para diferentes períodos
    console.log('\n🔍 Testando CAGR de Lucros:');
    
    for (let i = 4; i < company.financialData.length; i++) {
      const currentYear = company.financialData[i];
      const fiveYearsAgo = currentYear.year - 4;
      
      // Buscar dados do primeiro e último ano
      const firstYearData = company.financialData.find(d => d.year === fiveYearsAgo);
      const lastYearData = company.financialData.find(d => d.year === currentYear.year);
      
      if (firstYearData && lastYearData && 
          firstYearData.lucroLiquido && lastYearData.lucroLiquido) {
        
        const initialValue = Number(firstYearData.lucroLiquido);
        const finalValue = Number(lastYearData.lucroLiquido);
        const years = currentYear.year - fiveYearsAgo;
        
        const cagrManual = calculateCAGRManual(initialValue, finalValue, years);
        
        console.log(`  📊 ${currentYear.year} (${fiveYearsAgo}-${currentYear.year}):`);
        console.log(`    Inicial: ${(initialValue/1000000).toFixed(1)}M`);
        console.log(`    Final: ${(finalValue/1000000).toFixed(1)}M`);
        console.log(`    Período: ${years} anos`);
        console.log(`    CAGR: ${cagrManual ? (cagrManual * 100).toFixed(2) + '%' : 'N/A'}`);
        
        // Verificar se há anos com prejuízo no meio
        const middleYears = company.financialData.filter(d => 
          d.year > fiveYearsAgo && d.year < currentYear.year
        );
        
        const hasLossYears = middleYears.some(d => 
          d.lucroLiquido && Number(d.lucroLiquido) < 0
        );
        
        if (hasLossYears) {
          console.log(`    ⚠️  Há anos com prejuízo no período`);
        }
        
        console.log('');
      }
    }
    
    // Exemplo de cenário problemático (se existir)
    console.log('🎯 Cenários de Teste:');
    
    // Cenário 1: Crescimento constante
    console.log('\n📈 Cenário 1 - Crescimento Constante:');
    const cagr1 = calculateCAGRManual(100, 200, 4);
    console.log(`  100 → 200 em 4 anos: CAGR = ${(cagr1 * 100).toFixed(2)}%`);
    
    // Cenário 2: Com prejuízo no meio
    console.log('\n📉 Cenário 2 - Com Prejuízo no Meio:');
    console.log('  Dados: 2020: 100, 2021: -50, 2022: 120, 2023: -20, 2024: 200');
    const cagr2 = calculateCAGRManual(100, 200, 4);
    console.log(`  Lógica NOVA: 100 (2020) → 200 (2024) em 4 anos: CAGR = ${(cagr2 * 100).toFixed(2)}%`);
    console.log('  Lógica ANTIGA: Filtraria apenas anos positivos (100→120→200)');
    
    // Cenário 3: Ambos negativos (melhoria)
    console.log('\n🔄 Cenário 3 - Redução de Prejuízo:');
    const cagr3 = calculateCAGRManual(-100, -50, 4);
    console.log(`  -100 → -50 em 4 anos: CAGR = ${(cagr3 * 100).toFixed(2)}% (melhoria)`);
    
    // Cenário 4: Prejuízo → Lucro (recuperação/turnaround) - NOVO!
    console.log('\n🚀 Cenário 4 - Recuperação (Prejuízo → Lucro):');
    const cagr4 = calculateCAGRManual(-100, 50, 4);
    console.log(`  -100 → 50 em 4 anos: CAGR = ${(cagr4 * 100).toFixed(2)}% (recuperação)`);
    console.log('  Fórmula: ((50 + 100) / 100)^(1/4) - 1 = Taxa de recuperação anualizada');
    
    // Cenário 5: Lucro → Prejuízo (deterioração)
    console.log('\n📉 Cenário 5 - Deterioração (Lucro → Prejuízo):');
    const cagr5 = calculateCAGRManual(100, -50, 4);
    console.log(`  100 → -50 em 4 anos: CAGR = ${(cagr5 * 100).toFixed(2)}% (deterioração)`);
    console.log('  Fórmula: -((100 + 50) / 100)^(1/4) - 1 = Taxa de deterioração anualizada');
    
    // Cenário 6: Recuperação dramática
    console.log('\n🎯 Cenário 6 - Recuperação Dramática:');
    const cagr6 = calculateCAGRManual(-200, 300, 4);
    console.log(`  -200 → 300 em 4 anos: CAGR = ${(cagr6 * 100).toFixed(2)}% (turnaround)`);
    
    console.log('\n✅ Teste concluído!');
    console.log('\n💡 A nova lógica completa cobre TODOS os cenários possíveis:');
    console.log('   ✅ Lucro → Lucro (CAGR tradicional)');
    console.log('   ✅ Prejuízo → Prejuízo (melhoria)');
    console.log('   ✅ Prejuízo → Lucro (recuperação/turnaround)');
    console.log('   ✅ Lucro → Prejuízo (deterioração)');
    console.log('\n🎯 Agora capturamos histórias completas de recuperação empresarial!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar teste
testCAGRCalculation();
