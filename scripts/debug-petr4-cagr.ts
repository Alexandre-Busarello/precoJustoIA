import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function debugPetr4CAGR() {
  try {
    const company = await prisma.company.findUnique({
      where: { ticker: 'PETR4' },
      select: { id: true, ticker: true }
    });

    if (!company) {
      console.log('❌ PETR4 não encontrada');
      return;
    }

    console.log(`\n📊 Analisando CAGR de Lucros 5a para ${company.ticker}\n`);

    // Buscar dados financeiros dos últimos 7 anos
    const financialData = await prisma.financialData.findMany({
      where: {
        companyId: company.id,
        year: { gte: 2019 }
      },
      select: {
        year: true,
        lucroLiquido: true,
        cagrLucros5a: true
      },
      orderBy: { year: 'asc' }
    });

    console.log('📈 Dados Históricos de Lucro Líquido:');
    console.log('Ano | Lucro Líquido (R$ milhões) | CAGR 5a');
    console.log('----|---------------------------|---------');
    
    financialData.forEach(data => {
      const lucro = data.lucroLiquido ? Number(data.lucroLiquido) / 1000000 : null;
      const cagr = data.cagrLucros5a ? (Number(data.cagrLucros5a) * 100).toFixed(2) + '%' : 'N/A';
      const lucroStr = lucro !== null ? lucro.toFixed(2) : 'N/A';
      console.log(`${data.year} | ${lucroStr.padEnd(25)} | ${cagr}`);
    });

    // Calcular CAGR manualmente para verificar
    console.log('\n🧮 Cálculo Manual do CAGR:\n');
    
    for (let i = 5; i < financialData.length; i++) {
      const currentYear = financialData[i];
      const fiveYearsAgo = financialData[i - 5];
      
      if (fiveYearsAgo && currentYear && 
          fiveYearsAgo.lucroLiquido && currentYear.lucroLiquido) {
        
        const initialValue = Number(fiveYearsAgo.lucroLiquido);
        const finalValue = Number(currentYear.lucroLiquido);
        const years = currentYear.year - fiveYearsAgo.year;
        
        console.log(`\n📊 CAGR ${fiveYearsAgo.year} → ${currentYear.year} (${years} anos):`);
        console.log(`   Valor Inicial (${fiveYearsAgo.year}): R$ ${(initialValue / 1000000).toFixed(2)}M`);
        console.log(`   Valor Final (${currentYear.year}): R$ ${(finalValue / 1000000).toFixed(2)}M`);
        
        let cagr: number | null = null;
        let scenario = '';
        
        if (initialValue > 0 && finalValue > 0) {
          scenario = 'Lucro → Lucro';
          cagr = Math.pow(finalValue / initialValue, 1 / years) - 1;
        } else if (initialValue < 0 && finalValue < 0) {
          scenario = 'Prejuízo → Prejuízo';
          cagr = -(Math.pow(Math.abs(finalValue) / Math.abs(initialValue), 1 / years) - 1);
        } else if (initialValue < 0 && finalValue > 0) {
          scenario = 'Prejuízo → Lucro (Recuperação)';
          const recoveryBase = Math.abs(initialValue);
          const totalImprovement = finalValue + recoveryBase;
          cagr = Math.pow(totalImprovement / recoveryBase, 1 / years) - 1;
        } else if (initialValue > 0 && finalValue < 0) {
          scenario = 'Lucro → Prejuízo (Deterioração)';
          const deteriorationBase = initialValue;
          const totalDeterioration = deteriorationBase + Math.abs(finalValue);
          cagr = -(Math.pow(totalDeterioration / deteriorationBase, 1 / years) - 1);
        }
        
        console.log(`   Cenário: ${scenario}`);
        if (cagr !== null) {
          console.log(`   CAGR Calculado: ${(cagr * 100).toFixed(2)}%`);
          console.log(`   CAGR no Banco: ${currentYear.cagrLucros5a ? (Number(currentYear.cagrLucros5a) * 100).toFixed(2) + '%' : 'N/A'}`);
          
          if (currentYear.cagrLucros5a) {
            const diff = Math.abs(cagr - Number(currentYear.cagrLucros5a));
            if (diff > 0.01) {
              console.log(`   ⚠️  DIFERENÇA DETECTADA: ${(diff * 100).toFixed(2)}%`);
            }
          }
        }
      }
    }

    // Análise específica de 2025 e 2026
    console.log('\n\n🔍 Análise Específica: 2025 vs 2026\n');
    
    const data2025 = financialData.find(d => d.year === 2025);
    const data2026 = financialData.find(d => d.year === 2026);
    const data2020 = financialData.find(d => d.year === 2020);
    const data2021 = financialData.find(d => d.year === 2021);
    
    if (data2025 && data2020) {
      console.log('📊 CAGR 2025 (2020→2025):');
      console.log(`   2020: R$ ${data2020.lucroLiquido ? (Number(data2020.lucroLiquido) / 1000000).toFixed(2) + 'M' : 'N/A'}`);
      console.log(`   2025: R$ ${data2025.lucroLiquido ? (Number(data2025.lucroLiquido) / 1000000).toFixed(2) + 'M' : 'N/A'}`);
      console.log(`   CAGR: ${data2025.cagrLucros5a ? (Number(data2025.cagrLucros5a) * 100).toFixed(2) + '%' : 'N/A'}`);
    }
    
    if (data2026 && data2021) {
      console.log('\n📊 CAGR 2026 (2021→2026):');
      console.log(`   2021: R$ ${data2021.lucroLiquido ? (Number(data2021.lucroLiquido) / 1000000).toFixed(2) + 'M' : 'N/A'}`);
      console.log(`   2026: R$ ${data2026.lucroLiquido ? (Number(data2026.lucroLiquido) / 1000000).toFixed(2) + 'M' : 'N/A'}`);
      console.log(`   CAGR: ${data2026.cagrLucros5a ? (Number(data2026.cagrLucros5a) * 100).toFixed(2) + '%' : 'N/A'}`);
      
      if (data2021.lucroLiquido && data2026.lucroLiquido) {
        const initial = Number(data2021.lucroLiquido);
        const final = Number(data2026.lucroLiquido);
        const years = 5;
        
        console.log(`\n   🧮 Cálculo Manual:`);
        if (initial > 0 && final < 0) {
          const deteriorationBase = initial;
          const totalDeterioration = deteriorationBase + Math.abs(final);
          const cagr = -(Math.pow(totalDeterioration / deteriorationBase, 1 / years) - 1);
          console.log(`   Deterioração Base: R$ ${(deteriorationBase / 1000000).toFixed(2)}M`);
          console.log(`   Deterioração Total: R$ ${(totalDeterioration / 1000000).toFixed(2)}M`);
          console.log(`   Razão: ${(totalDeterioration / deteriorationBase).toFixed(4)}`);
          console.log(`   CAGR Calculado: ${(cagr * 100).toFixed(2)}%`);
        }
      }
    }

  } catch (error: any) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugPetr4CAGR();























