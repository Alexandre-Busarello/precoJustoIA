#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Caminho para o script TypeScript
const scriptPath = path.join(__dirname, 'update-company-profiles.ts');

// Argumentos passados para o script
const args = process.argv.slice(2);

console.log('🚀 Executando script de atualização de perfis de empresas...\n');

// Executar o script TypeScript com tsx
const child = spawn('npx', ['tsx', scriptPath, ...args], {
  stdio: 'inherit',
  cwd: path.dirname(__dirname) // Diretório raiz do projeto
});

child.on('close', (code) => {
  if (code === 0) {
    console.log('\n✅ Script executado com sucesso!');
  } else {
    console.log(`\n❌ Script finalizado com código de erro: ${code}`);
  }
  process.exit(code);
});

child.on('error', (error) => {
  console.error('❌ Erro ao executar o script:', error.message);
  process.exit(1);
});
