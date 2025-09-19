#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Caminho para o script TypeScript
const scriptPath = path.join(__dirname, 'update-financial-data-brapi.ts');

// Argumentos passados para o script
const args = process.argv.slice(2);

console.log('🚀 Executando script de atualização da tabela financial_data...\n');

if (args.length > 0) {
  console.log(`📋 Tickers especificados: ${args.join(', ')}`);
} else {
  console.log('📋 Processando todas as empresas do banco');
}

console.log('\n' + '='.repeat(60) + '\n');

// Executar o script TypeScript com tsx
const child = spawn('npx', ['tsx', scriptPath, ...args], {
  stdio: 'inherit',
  cwd: path.dirname(__dirname), // Diretório raiz do projeto
  env: { ...process.env }
});

child.on('close', (code) => {
  console.log('\n' + '='.repeat(60));
  if (code === 0) {
    console.log('✅ Script executado com sucesso!');
  } else {
    console.log(`❌ Script finalizado com código de erro: ${code}`);
  }
  process.exit(code);
});

child.on('error', (error) => {
  console.error('❌ Erro ao executar o script:', error.message);
  process.exit(1);
});
