/**
 * Teste Ponta a Ponta: Cron Endpoints
 * 
 * Testa os endpoints de cron via HTTP
 * 
 * Uso:
 *   npx tsx scripts/test-cron-endpoints.ts monitor-price-variations
 *   npx tsx scripts/test-cron-endpoints.ts monitor-custom-triggers
 *   npx tsx scripts/test-cron-endpoints.ts generate-ai-reports
 *   npx tsx scripts/test-cron-endpoints.ts all
 */

import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET || 'test-secret';

async function testCronEndpoint(endpoint: string, name: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 TESTE: ${name}`);
  console.log('='.repeat(60));
  console.log(`📡 Endpoint: ${BASE_URL}${endpoint}\n`);

  try {
    const startTime = Date.now();
    
    const response = await fetch(`${BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`,
      },
    });

    const duration = Date.now() - startTime;
    const data = await response.json();

    if (response.ok) {
      console.log(`✅ Status: ${response.status} (${duration}ms)`);
      console.log('\n📊 Resposta:');
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.log(`❌ Status: ${response.status} (${duration}ms)`);
      console.log('\n❌ Erro:');
      console.log(JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.error(`❌ Erro ao chamar endpoint:`, error);
    if (error instanceof Error) {
      console.error(`   Mensagem: ${error.message}`);
    }
  }
}

async function main() {
  const command = process.argv[2];

  console.log('🧪 TESTE: Cron Endpoints\n');
  console.log(`🌐 Base URL: ${BASE_URL}`);
  console.log(`🔐 Cron Secret: ${CRON_SECRET.substring(0, 10)}...\n`);

  if (!command || command === 'all') {
    await testCronEndpoint('/api/cron/monitor-price-variations', 'Monitor Price Variations');
    await testCronEndpoint('/api/cron/monitor-custom-triggers', 'Monitor Custom Triggers');
    await testCronEndpoint('/api/cron/generate-ai-reports', 'Generate AI Reports');
  } else if (command === 'monitor-price-variations') {
    await testCronEndpoint('/api/cron/monitor-price-variations', 'Monitor Price Variations');
  } else if (command === 'monitor-custom-triggers') {
    await testCronEndpoint('/api/cron/monitor-custom-triggers', 'Monitor Custom Triggers');
  } else if (command === 'generate-ai-reports') {
    await testCronEndpoint('/api/cron/generate-ai-reports', 'Generate AI Reports');
  } else {
    console.error('❌ Comando inválido');
    console.log('\nUso:');
    console.log('  npx tsx scripts/test-cron-endpoints.ts monitor-price-variations');
    console.log('  npx tsx scripts/test-cron-endpoints.ts monitor-custom-triggers');
    console.log('  npx tsx scripts/test-cron-endpoints.ts generate-ai-reports');
    console.log('  npx tsx scripts/test-cron-endpoints.ts all');
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Teste concluído!');
  console.log('='.repeat(60));
}

main().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});

