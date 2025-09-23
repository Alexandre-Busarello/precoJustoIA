#!/usr/bin/env node

/**
 * Script de teste para validar o cálculo das métricas de crescimento
 * Testa a função calculateAndUpdateAllGrowthMetrics
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['warn', 'error']
});

async function testGrowthMetrics() {
  try {
    console.log('🧪 Testando cálculo de métricas de crescimento...\n');
    
    // Buscar uma empresa com dados históricos
    const company = await prisma.company.findFirst({
      where: {
        financialData: {
          some: {}
        }
      },
      include: {
        financialData: {
          orderBy: { year: 'desc' },
          take: 6 // Últimos 6 anos
        }
      }
    });
    
    if (!company) {
      console.log('❌ Nenhuma empresa encontrada com dados financeiros');
      return;
    }
    
    console.log(`📊 Testando com empresa: ${company.ticker} (${company.name})`);
    console.log(`📈 Dados disponíveis: ${company.financialData.length} anos\n`);
    
    // Mostrar dados antes do cálculo
    console.log('📋 Dados ANTES do recálculo:');
    company.financialData.forEach(data => {
      const metrics = [];
      if (data.cagrLucros5a) metrics.push(`CAGR-L: ${(Number(data.cagrLucros5a) * 100).toFixed(1)}%`);
      if (data.cagrReceitas5a) metrics.push(`CAGR-R: ${(Number(data.cagrReceitas5a) * 100).toFixed(1)}%`);
      if (data.crescimentoLucros) metrics.push(`Cresc-L: ${(Number(data.crescimentoLucros) * 100).toFixed(1)}%`);
      if (data.crescimentoReceitas) metrics.push(`Cresc-R: ${(Number(data.crescimentoReceitas) * 100).toFixed(1)}%`);
      
      console.log(`  ${data.year}: ${metrics.length > 0 ? metrics.join(', ') : 'Sem métricas calculadas'}`);
    });
    
    // Importar e executar a função de cálculo
    const { calculateAndUpdateAllGrowthMetrics } = require('./fetch-data-fundamentus');
    
    console.log('\n🔄 Executando recálculo de métricas...');
    await calculateAndUpdateAllGrowthMetrics(company.id);
    
    // Buscar dados atualizados
    const updatedCompany = await prisma.company.findUnique({
      where: { id: company.id },
      include: {
        financialData: {
          orderBy: { year: 'desc' },
          take: 6
        }
      }
    });
    
    console.log('\n📋 Dados DEPOIS do recálculo:');
    updatedCompany.financialData.forEach(data => {
      const metrics = [];
      if (data.cagrLucros5a) metrics.push(`CAGR-L: ${(Number(data.cagrLucros5a) * 100).toFixed(1)}%`);
      if (data.cagrReceitas5a) metrics.push(`CAGR-R: ${(Number(data.cagrReceitas5a) * 100).toFixed(1)}%`);
      if (data.crescimentoLucros) metrics.push(`Cresc-L: ${(Number(data.crescimentoLucros) * 100).toFixed(1)}%`);
      if (data.crescimentoReceitas) metrics.push(`Cresc-R: ${(Number(data.crescimentoReceitas) * 100).toFixed(1)}%`);
      
      console.log(`  ${data.year}: ${metrics.length > 0 ? metrics.join(', ') : 'Sem métricas calculadas'}`);
    });
    
    console.log('\n✅ Teste concluído com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

// Executar teste
testGrowthMetrics();
