#!/usr/bin/env node

const axios = require('axios');
require('dotenv').config();

async function runFetchWard() {
  const args = process.argv.slice(2);
  const isLocal = args.includes('--local');
  const tickers = args.filter(arg => !arg.startsWith('--'));
  const noBrapi = args.includes('--no-brapi');
  const forceFullUpdate = args.includes('--force-full');
  const resetState = args.includes('--reset');
  
  // Extrair tickers para resetar
  let resetTickers = null;
  const resetTickerArg = args.find(arg => arg.startsWith('--reset-ticker='));
  if (resetTickerArg) {
    const tickersStr = resetTickerArg.split('=')[1];
    resetTickers = tickersStr.split(',').map(t => t.trim().toUpperCase());
  }

  if (isLocal) {
    // Executar localmente
    console.log('🏠 Executando localmente...');
    const { main } = require('./fetch-data-ward.ts');
    await main();
  } else {
    // Executar na Vercel
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const apiSecret = process.env.FETCH_API_SECRET;
    const bypassToken = process.env.VERCEL_BYPASS_TOKEN;
    
    if (!apiSecret) {
      console.error('❌ FETCH_API_SECRET não configurado');
      process.exit(1);
    }

    console.log('☁️  Executando na Vercel...');
    
    try {
      const headers = {
        'Authorization': `Bearer ${apiSecret}`,
        'Content-Type': 'application/json'
      };

      // Adicionar bypass token se disponível
      if (bypassToken) {
        headers['x-vercel-protection-bypass'] = bypassToken;
        console.log('🔓 Usando bypass token para deployment protection');
      }

      const response = await axios.post(`${baseUrl}/api/fetch-ward-data`, {
        tickers: tickers.length > 0 ? tickers : undefined,
        noBrapi,
        forceFullUpdate,
        resetState,
        resetTickers
      }, {
        headers,
        timeout: 300000 // 5 minutos
      });

      console.log('✅ Sucesso:', response.data.message);
      if (response.data.logs) {
        console.log('\n📋 Últimos logs:');
        response.data.logs.forEach(log => console.log(log));
      }
    } catch (error) {
      if (error.response) {
        console.error('❌ Erro:', error.response.data);
      } else {
        console.error('❌ Erro de rede:', error.message);
      }
      process.exit(1);
    }
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  runFetchWard().catch(console.error);
}

module.exports = { runFetchWard };
