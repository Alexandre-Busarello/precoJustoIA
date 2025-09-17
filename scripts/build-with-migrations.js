#!/usr/bin/env node

const { execSync } = require('child_process');

console.log('🔄 Starting build process with Prisma migrations...');

try {
  // Gerar o cliente Prisma
  console.log('📦 Generating Prisma client...');
  execSync('npx prisma generate', { stdio: 'inherit' });

  // Executar push do schema para o banco (aplica mudanças sem migrations)
  console.log('🗄️  Pushing schema changes to database...');
  execSync('npx prisma db push', { stdio: 'inherit' });

  // Verificar se existem migrations pendentes e aplicá-las
  try {
    console.log('🚀 Deploying migrations...');
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  } catch (migrateError) {
    console.log('ℹ️  No migrations to deploy or migration deploy failed, continuing with db push...');
  }

  // Build da aplicação Next.js
  console.log('🏗️  Building Next.js application...');
  execSync('npx next build --turbopack', { stdio: 'inherit' });

  console.log('✅ Build completed successfully!');
} catch (error) {
  console.error('❌ Build failed:', error.message);
  process.exit(1);
}
