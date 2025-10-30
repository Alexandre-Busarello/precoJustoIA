#!/usr/bin/env node

/**
 * Script para executar atualização de ativos BDR localmente
 * 
 * Usage:
 *   npm run update:bdr
 * 
 * Requer que o servidor Next.js esteja rodando em http://localhost:3000
 */

const https = require('https');
const http = require('http');

// Detectar se deve usar produção ou local
const args = process.argv.slice(2);
const isProduction = args.includes('--production') || args.includes('-p');

// Configuração
const config = {
  local: {
    protocol: 'http',
    host: 'localhost',
    port: 3000,
  },
  production: {
    protocol: 'https',
    host: process.env.NEXT_PUBLIC_BASE_URL?.replace(/^https?:\/\//, '') || 'precojusto.ai',
    port: 443,
  }
};

const env = isProduction ? config.production : config.local;
const baseUrl = `${env.protocol}://${env.host}${env.port !== 80 && env.port !== 443 ? `:${env.port}` : ''}`;

console.log('🌎 Executando atualização de ativos BDR...');
console.log(`📍 Ambiente: ${isProduction ? 'PRODUÇÃO' : 'LOCAL'}`);
console.log(`🔗 URL: ${baseUrl}/api/cron/update-portfolio-assets`);
console.log('');

// Verificar se CRON_SECRET está configurado
if (!process.env.CRON_SECRET) {
  console.error('❌ ERRO: CRON_SECRET não está configurado no .env');
  console.error('');
  console.error('Adicione ao seu .env:');
  console.error('CRON_SECRET="seu-secret-aqui"');
  process.exit(1);
}

// Fazer requisição
const options = {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${process.env.CRON_SECRET}`,
  },
};

const client = env.protocol === 'https' ? https : http;

console.log('⏳ Executando atualização de BDRs... (isso pode levar vários minutos)');
console.log('');

const startTime = Date.now();

const req = client.request(`${baseUrl}/api/cron/update-portfolio-assets?mode=full`, options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log('');
    console.log('📊 ===== RESULTADO =====');
    console.log('');

    if (res.statusCode === 200) {
      try {
        const result = JSON.parse(data);
        
        console.log('✅ Status: Sucesso');
        console.log(`⏱️  Tempo de execução: ${duration}s`);
        console.log('');
        
        if (result.summary) {
          console.log('📈 Estatísticas:');
          console.log(`  • Total de ativos: ${result.summary.totalTickers}`);
          console.log(`  • Processados: ${result.summary.processedTickers}`);
          console.log(`  • Falharam: ${result.summary.failedTickers?.length || 0}`);
          console.log(`  • Preços atualizados: ${result.summary.updatedHistoricalPrices}`);
          console.log(`  • Dividendos atualizados: ${result.summary.updatedDividends}`);
          console.log(`  • Ativos atualizados: ${result.summary.updatedAssets}`);
          
          if (result.summary.errors && result.summary.errors.length > 0) {
            console.log(`  ⚠️  Erros: ${result.summary.errors.length}`);
            console.log('');
            console.log('🔍 Detalhes dos erros:');
            result.summary.errors.slice(0, 5).forEach(error => {
              console.log(`  • ${error.ticker}: ${error.error}`);
            });
            if (result.summary.errors.length > 5) {
              console.log(`  • ... e mais ${result.summary.errors.length - 5} erros`);
            }
          }
          
          if (result.summary.failedTickers && result.summary.failedTickers.length > 0) {
            console.log('');
            console.log('❌ Tickers que falharam:');
            console.log(`  ${result.summary.failedTickers.join(', ')}`);
          }
        }
        
        console.log('');
        console.log(`📅 Timestamp: ${result.timestamp}`);
      } catch (error) {
        console.log('✅ Status: Sucesso');
        console.log(`⏱️  Tempo: ${duration}s`);
        console.log('');
        console.log('Resposta:');
        console.log(data);
      }
    } else {
      console.log(`❌ Status: ${res.statusCode} - Erro`);
      console.log(`⏱️  Tempo: ${duration}s`);
      console.log('');
      console.log('Resposta:');
      console.log(data);
    }

    console.log('');
    console.log('='.repeat(50));
  });
});

req.on('error', (error) => {
  console.error('');
  console.error('❌ ERRO ao fazer requisição:');
  console.error('');
  console.error(error.message);
  console.error('');
  
  if (!isProduction && error.code === 'ECONNREFUSED') {
    console.error('💡 Dica: Certifique-se de que o servidor Next.js está rodando:');
    console.error('   npm run dev');
  }
  
  process.exit(1);
});

req.end();