#!/usr/bin/env node

/**
 * Script para processar usuários inativos na fase Alfa
 * Marca usuários como inativos (ao invés de deletar) para liberar vagas
 * Deve ser executado diariamente via cron job
 * 
 * Uso: node scripts/process-inactive-users.js
 */

const https = require('https');
const http = require('http');

const API_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';
const CRON_SECRET = process.env.CRON_SECRET;

if (!CRON_SECRET) {
  console.error('❌ CRON_SECRET não configurado');
  process.exit(1);
}

function makeRequest(url, options) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https:') ? https : http;
    
    const req = lib.request(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({ status: res.statusCode, data: jsonData });
        } catch (error) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function processInactiveUsers() {
  try {
    console.log('🔄 Iniciando processamento de usuários inativos...');
    console.log('ℹ️  Usuários serão marcados como inativos (não deletados)');
    
    const response = await makeRequest(`${API_URL}/api/alfa/process-inactive`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CRON_SECRET}`
      }
    });
    
    if (response.status === 200) {
      console.log('✅ Processamento concluído com sucesso:');
      console.log(`   - Total de usuários inativos encontrados: ${response.data.totalInactive || 0}`);
      console.log(`   - Usuários marcados como inativos: ${response.data.processed || 0}`);
      console.log(`   - Vagas liberadas para a lista de interesse: ${response.data.processed || 0}`);
      
      if (response.data.errors && response.data.errors.length > 0) {
        console.log('⚠️  Erros encontrados:');
        response.data.errors.forEach(error => {
          console.log(`   - ${error}`);
        });
      }
      
      if (response.data.processed > 0) {
        console.log('💡 Usuários inativos podem ser reativados automaticamente ao fazer login novamente');
      }
    } else {
      console.error('❌ Erro no processamento:', response.data);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Erro ao processar usuários inativos:', error.message);
    process.exit(1);
  }
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  processInactiveUsers();
}

module.exports = { processInactiveUsers };
