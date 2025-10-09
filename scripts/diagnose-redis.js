/**
 * Script de diagnóstico para problemas de conexão Redis
 */

const { createClient } = require('redis');

async function diagnoseRedis() {
  console.log('🔍 DIAGNÓSTICO DE CONEXÃO REDIS\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // 1. Verificar variável de ambiente
  console.log('1️⃣ Verificando configuração...');
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl) {
    console.log('❌ REDIS_URL não configurada!\n');
    process.exit(1);
  }
  
  console.log('✅ REDIS_URL configurada');
  
  // Extrair host (sem mostrar senha)
  const urlParts = redisUrl.match(/redis:\/\/([^:]+):([^@]+)@([^:]+):(\d+)/);
  if (urlParts) {
    console.log(`   Host: ${urlParts[3]}`);
    console.log(`   Porta: ${urlParts[4]}`);
    console.log(`   User: ${urlParts[1]}`);
    console.log(`   Password: ${'*'.repeat(10)}\n`);
  }

  // 2. Testar conexão
  console.log('2️⃣ Testando conexão...');
  
  const client = createClient({
    url: redisUrl,
    socket: {
      connectTimeout: 5000,
      commandTimeout: 3000,
    }
  });

  // Listeners de eventos
  let connected = false;
  let errorOccurred = null;

  client.on('connect', () => {
    console.log('🔗 Conectando ao Redis...');
  });

  client.on('ready', () => {
    console.log('✅ Redis READY!');
    connected = true;
  });

  client.on('error', (error) => {
    console.log(`❌ Erro: ${error.message}`);
    errorOccurred = error;
  });

  client.on('end', () => {
    console.log('🔌 Conexão encerrada');
  });

  try {
    // Tentar conectar
    await client.connect();
    
    if (connected) {
      console.log('\n3️⃣ Testando comandos...');
      
      // Teste PING
      const ping = await client.ping();
      console.log(`✅ PING: ${ping}`);
      
      // Teste SET
      await client.set('test:diagnostico', 'ok', { EX: 10 });
      console.log('✅ SET: ok');
      
      // Teste GET
      const value = await client.get('test:diagnostico');
      console.log(`✅ GET: ${value}`);
      
      // Info
      const info = await client.info('keyspace');
      console.log('\n4️⃣ Informações do Redis:');
      console.log(info || 'Nenhuma database com chaves');
      
      // Verificar maxclients
      const configMaxClients = await client.configGet('maxclients');
      console.log(`\n5️⃣ Configuração:`);
      console.log(`   maxclients: ${configMaxClients.maxclients}`);
      
      // Verificar clientes conectados
      const clientList = await client.clientList();
      const numClients = clientList.split('\n').filter(line => line.trim()).length;
      console.log(`   Clientes conectados: ${numClients}`);
      console.log(`   Uso: ${((numClients / parseInt(configMaxClients.maxclients)) * 100).toFixed(1)}%`);
      
      console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('✅ DIAGNÓSTICO: Redis está funcionando PERFEITAMENTE!');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      
      console.log('💡 Possíveis causas do problema:');
      console.log('   1. Redis foi marcado como "disabled" por erro anterior');
      console.log('   2. Aplicação não está usando a mesma REDIS_URL');
      console.log('   3. Código tem try-catch que está silenciando erros\n');
      
      console.log('🔧 Próximos passos:');
      console.log('   1. Reinicie a aplicação: npm run dev');
      console.log('   2. Verifique logs da aplicação');
      console.log('   3. Use o endpoint /api/admin/cache-status para ver lastCriticalError\n');
    }
    
    await client.disconnect();
    process.exit(0);
    
  } catch (error) {
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('❌ DIAGNÓSTICO: PROBLEMA ENCONTRADO!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('❌ Erro:', error.message);
    console.log('\n📋 Stack:');
    console.log(error.stack);
    
    console.log('\n💡 Possíveis soluções:');
    
    if (error.message.includes('WRONGPASS') || error.message.includes('NOAUTH')) {
      console.log('   🔑 Senha incorreta na REDIS_URL');
      console.log('   → Verifique as credenciais no painel do Redis Cloud');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.log('   🔌 Conexão recusada');
      console.log('   → Verifique se o Redis está ativo no painel');
      console.log('   → Verifique regras de firewall');
    } else if (error.message.includes('ETIMEDOUT') || error.message.includes('timeout')) {
      console.log('   ⏱️ Timeout de conexão');
      console.log('   → Redis pode estar sobrecarregado');
      console.log('   → Verifique a latência de rede');
    } else if (error.message.includes('max number of clients')) {
      console.log('   👥 Limite de clientes atingido');
      console.log('   → Aumente maxclients no Redis');
      console.log('   → Ou ative REDIS_DISCONNECT_AFTER_OP=true');
    } else {
      console.log('   ❓ Erro desconhecido');
      console.log('   → Veja a documentação do Redis');
      console.log('   → Verifique logs do servidor Redis');
    }
    
    console.log('\n');
    
    try {
      await client.disconnect();
    } catch (e) {
      // Ignora
    }
    
    process.exit(1);
  }
}

// Executar diagnóstico
diagnoseRedis().catch(error => {
  console.error('Erro fatal:', error);
  process.exit(1);
});

