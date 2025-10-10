#!/usr/bin/env node

/**
 * Script para executar o cron job de monitoramento de ativos localmente
 * 
 * Usage:
 *   npm run monitor:run
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

console.log('🚀 Executando monitoramento de ativos...');
console.log(`📍 Ambiente: ${isProduction ? 'PRODUÇÃO' : 'LOCAL'}`);
console.log(`🔗 URL: ${baseUrl}/api/cron/monitor-assets`);
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

console.log('⏳ Executando... (isso pode levar alguns minutos)');
console.log('');

const startTime = Date.now();

const req = client.request(`${baseUrl}/api/cron/monitor-assets`, options, (res) => {
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
        
        if (result.stats) {
          console.log('📈 Estatísticas:');
          console.log(`  • Empresas processadas: ${result.stats.processedCount}`);
          console.log(`  • Snapshots criados: ${result.stats.snapshotsCreated}`);
          console.log(`  • Mudanças detectadas: ${result.stats.changesDetected}`);
          console.log(`  • Relatórios gerados: ${result.stats.reportsGenerated}`);
          console.log(`  • Emails enviados: ${result.stats.emailsSent}`);
          
          if (result.stats.errors > 0) {
            console.log(`  ⚠️  Erros: ${result.stats.errors}`);
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

