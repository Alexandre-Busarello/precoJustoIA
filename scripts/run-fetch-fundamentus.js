#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Configurar variáveis de ambiente
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

// Caminho para o script TypeScript
const scriptPath = path.join(__dirname, 'fetch-data-fundamentus.ts');

// Argumentos passados para o script
const args = process.argv.slice(2);

console.log('🚀 Executando fetch de dados do Fundamentus...');
console.log(`📁 Script: ${scriptPath}`);
if (args.length > 0) {
  console.log(`📋 Tickers: ${args.join(', ')}`);
}
console.log('');

// Executar o script TypeScript com tsx
const child = spawn('npx', ['tsx', scriptPath, ...args], {
  stdio: 'inherit',
  cwd: path.dirname(__dirname), // Diretório raiz do projeto
  env: process.env
});

child.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Fetch do Fundamentus concluído com sucesso!');
  } else {
    console.log(`\n❌ Fetch do Fundamentus falhou com código ${code}`);
  }
  process.exit(code);
});

child.on('error', (error) => {
  console.error('❌ Erro ao executar o script:', error.message);
  process.exit(1);
});
