#!/usr/bin/env node

/**
 * Script para testar a solução de Crawl Budget
 * Verifica se todos os sitemaps estão funcionando corretamente
 */

const https = require('https');
const http = require('http');

const BASE_URL = 'https://precojusto.ai';
const TEST_URLS = [
  '/sitemap.xml',
  '/sitemap-index.xml', 
  '/sitemap-blog.xml',
  '/sitemap-companies.xml',
  '/sitemap-comparisons.xml',
  '/robots.txt'
];

async function testUrl(url) {
  return new Promise((resolve) => {
    const fullUrl = `${BASE_URL}${url}`;
    const client = fullUrl.startsWith('https') ? https : http;
    
    console.log(`🔍 Testando: ${fullUrl}`);
    
    const req = client.get(fullUrl, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const success = res.statusCode === 200;
        const size = Buffer.byteLength(data, 'utf8');
        
        if (success) {
          console.log(`✅ ${url} - Status: ${res.statusCode} - Tamanho: ${(size / 1024).toFixed(1)}KB`);
          
          // Análise específica por tipo
          if (url.includes('sitemap') && url.endsWith('.xml')) {
            const urlCount = (data.match(/<url>/g) || []).length;
            const sitemapCount = (data.match(/<sitemap>/g) || []).length;
            
            if (urlCount > 0) {
              console.log(`   📊 URLs encontradas: ${urlCount}`);
            }
            if (sitemapCount > 0) {
              console.log(`   📊 Sitemaps encontrados: ${sitemapCount}`);
            }
            
            // Verificar se tem URLs com prioridade
            if (data.includes('<priority>')) {
              const priorities = data.match(/<priority>([\d.]+)<\/priority>/g) || [];
              const uniquePriorities = [...new Set(priorities)].sort().reverse();
              console.log(`   🎯 Prioridades: ${uniquePriorities.slice(0, 5).join(', ')}`);
            }
          }
          
          if (url === '/robots.txt') {
            const hasDisallow = data.includes('Disallow:');
            const hasSitemap = data.includes('Sitemap:');
            const hasCrawlDelay = data.includes('Crawl-delay:');
            
            console.log(`   🤖 Disallow: ${hasDisallow ? '✅' : '❌'}`);
            console.log(`   🗺️  Sitemap: ${hasSitemap ? '✅' : '❌'}`);
            console.log(`   ⏱️  Crawl-delay: ${hasCrawlDelay ? '✅' : '❌'}`);
          }
          
        } else {
          console.log(`❌ ${url} - Status: ${res.statusCode}`);
        }
        
        resolve({ url, success, status: res.statusCode, size });
      });
    });
    
    req.on('error', (err) => {
      console.log(`❌ ${url} - Erro: ${err.message}`);
      resolve({ url, success: false, error: err.message });
    });
    
    req.setTimeout(10000, () => {
      console.log(`⏰ ${url} - Timeout`);
      req.destroy();
      resolve({ url, success: false, error: 'Timeout' });
    });
  });
}

async function testRedirects() {
  console.log('\n🔄 Testando redirecionamentos...');
  
  const redirectTests = [
    '/acao/PETR4', // Deve redirecionar para /acao/petr4
    '/compara-acoes/ITUB4/BBDC4', // Deve redirecionar para /compara-acoes/itub4/bbdc4
  ];
  
  for (const testUrl of redirectTests) {
    const fullUrl = `${BASE_URL}${testUrl}`;
    
    try {
      const response = await fetch(fullUrl, { 
        method: 'HEAD',
        redirect: 'manual' 
      });
      
      if (response.status === 301 || response.status === 302) {
        const location = response.headers.get('location');
        console.log(`✅ ${testUrl} → ${location} (${response.status})`);
      } else {
        console.log(`⚠️  ${testUrl} - Status: ${response.status} (esperado: 301/302)`);
      }
    } catch (error) {
      console.log(`❌ ${testUrl} - Erro: ${error.message}`);
    }
  }
}

async function main() {
  console.log('🚀 TESTE DA SOLUÇÃO DE CRAWL BUDGET\n');
  console.log('='.repeat(50));
  
  // Testar URLs principais
  const results = [];
  for (const url of TEST_URLS) {
    const result = await testUrl(url);
    results.push(result);
    console.log(''); // Linha em branco
  }
  
  // Testar redirecionamentos (se fetch estiver disponível)
  if (typeof fetch !== 'undefined') {
    await testRedirects();
  }
  
  // Resumo
  console.log('\n📊 RESUMO DOS TESTES');
  console.log('='.repeat(30));
  
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log(`✅ Sucessos: ${successful}/${total}`);
  console.log(`❌ Falhas: ${total - successful}/${total}`);
  
  if (successful === total) {
    console.log('\n🎉 TODOS OS TESTES PASSARAM!');
    console.log('A solução de crawl budget está funcionando corretamente.');
    console.log('\n📋 PRÓXIMOS PASSOS:');
    console.log('1. Submeter sitemaps no Google Search Console');
    console.log('2. Monitorar indexação nas próximas 2-4 semanas');
    console.log('3. Verificar redução de URLs "detectadas mas não indexadas"');
  } else {
    console.log('\n⚠️  ALGUNS TESTES FALHARAM');
    console.log('Verifique os erros acima e corrija antes de prosseguir.');
  }
  
  console.log('\n' + '='.repeat(50));
}

// Executar apenas se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

module.exports = { testUrl, main };
