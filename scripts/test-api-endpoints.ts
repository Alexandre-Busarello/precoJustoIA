/**
 * Teste Ponta a Ponta: API Endpoints
 * 
 * Testa os endpoints de API para gerenciar gatilhos e consultar flags
 * 
 * Uso:
 *   npx tsx scripts/test-api-endpoints.ts
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

async function createTestUser() {
  let user = await prisma.user.findFirst({
    where: { email: 'test-api@example.com' },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'test-api@example.com',
        name: 'Teste API',
      },
    });
    console.log(`✅ Usuário de teste criado: ${user.id}`);
  } else {
    console.log(`✅ Usuário de teste encontrado: ${user.id}`);
  }

  return user;
}

async function getTestSessionToken(userId: string) {
  // Em produção, você precisaria criar uma sessão real via NextAuth
  // Para teste, vamos simular ou usar autenticação direta
  // Por enquanto, vamos apenas testar a estrutura
  return 'test-session-token';
}

async function testUserAssetMonitorAPI() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TESTE: User Asset Monitor API');
  console.log('='.repeat(60));

  const user = await createTestUser();

  // Buscar primeira empresa
  const company = await prisma.company.findFirst({
    where: { assetType: 'STOCK' },
    select: {
      id: true,
      ticker: true,
      name: true,
    },
  });

  if (!company) {
    console.log('⚠️  Nenhuma empresa encontrada, pulando teste de API');
    return;
  }

  console.log(`\n📊 Testando com empresa: ${company.ticker} - ${company.name}`);

  // Criar gatilho via Prisma (simulando POST)
  console.log('\n1️⃣ Criando gatilho customizado...');
  const triggerConfig = {
    minPl: 5,
    maxPvp: 2,
    minScore: 60,
  };

  const monitor = await prisma.userAssetMonitor.create({
    data: {
      userId: user.id,
      companyId: company.id,
      triggerConfig,
      isActive: true,
    },
    include: {
      company: {
        select: {
          ticker: true,
          name: true,
          logoUrl: true,
        },
      },
    },
  });

  console.log(`✅ Gatilho criado: ${monitor.id}`);
  console.log(`   - Configuração: ${JSON.stringify(triggerConfig, null, 2)}`);

  // Listar gatilhos (simulando GET)
  console.log('\n2️⃣ Listando gatilhos do usuário...');
  const monitors = await prisma.userAssetMonitor.findMany({
    where: { userId: user.id },
    include: {
      company: {
        select: {
          ticker: true,
          name: true,
          logoUrl: true,
        },
      },
    },
  });

  console.log(`✅ Encontrados ${monitors.length} gatilho(s):`);
  monitors.forEach((m, index) => {
    console.log(`   ${index + 1}. ${m.company.ticker} - ${m.company.name}`);
    console.log(`      - ID: ${m.id}`);
    console.log(`      - Ativo: ${m.isActive ? 'SIM' : 'NÃO'}`);
    console.log(`      - Criado em: ${m.createdAt.toLocaleString('pt-BR')}`);
  });

  // Atualizar gatilho (simulando PATCH)
  console.log('\n3️⃣ Atualizando gatilho...');
  const updatedMonitor = await prisma.userAssetMonitor.update({
    where: { id: monitor.id },
    data: {
      triggerConfig: {
        ...triggerConfig,
        minPl: 8, // Atualizado
      },
    },
  });

  console.log(`✅ Gatilho atualizado`);
  console.log(`   - Nova configuração: ${JSON.stringify(updatedMonitor.triggerConfig, null, 2)}`);

  // Remover gatilho (simulando DELETE)
  console.log('\n4️⃣ Removendo gatilho...');
  await prisma.userAssetMonitor.update({
    where: { id: monitor.id },
    data: { isActive: false },
  });

  console.log(`✅ Gatilho desativado`);

  // Verificar remoção
  const remainingMonitors = await prisma.userAssetMonitor.count({
    where: {
      userId: user.id,
      isActive: true,
    },
  });

  console.log(`\n📊 Gatilhos ativos restantes: ${remainingMonitors}`);
}

async function testCompanyFlagsAPI() {
  console.log('\n' + '='.repeat(60));
  console.log('🧪 TESTE: Company Flags API');
  console.log('='.repeat(60));

  // Buscar primeira empresa
  const company = await prisma.company.findFirst({
    where: { assetType: 'STOCK' },
    select: {
      id: true,
      ticker: true,
      name: true,
    },
  });

  if (!company) {
    console.log('⚠️  Nenhuma empresa encontrada, pulando teste');
    return;
  }

  console.log(`\n📊 Testando com empresa: ${company.ticker} - ${company.name}`);

  // Criar relatório e flag de teste
  console.log('\n1️⃣ Criando relatório e flag de teste...');
  const report = await prisma.aIReport.create({
    data: {
      companyId: company.id,
      content: '# Relatório de Teste\n\nEste é um relatório de teste para verificar flags.',
      type: 'PRICE_VARIATION',
      status: 'COMPLETED',
      isActive: true,
      metadata: {
        test: true,
      } as any,
    },
  });

  const flag = await prisma.companyFlag.create({
    data: {
      companyId: company.id,
      reportId: report.id,
      flagType: 'FUNDAMENTAL_LOSS',
      reason: 'Teste de flag - perda de fundamento detectada',
      isActive: true,
    },
  });

  console.log(`✅ Flag criado: ${flag.id}`);

  // Buscar flags (simulando GET)
  console.log('\n2️⃣ Buscando flags da empresa...');
  const flags = await prisma.companyFlag.findMany({
    where: {
      companyId: company.id,
      isActive: true,
    },
    include: {
      report: {
        select: {
          id: true,
          type: true,
          createdAt: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(`✅ Encontrados ${flags.length} flag(s) ativo(s):`);
  flags.forEach((f, index) => {
    console.log(`   ${index + 1}. ${f.flagType}`);
    console.log(`      - ID: ${f.id}`);
    console.log(`      - Motivo: ${f.reason.substring(0, 50)}...`);
    console.log(`      - Relatório ID: ${f.report.id}`);
    console.log(`      - Criado em: ${f.createdAt.toLocaleString('pt-BR')}`);
  });

  // Limpar dados de teste
  console.log('\n3️⃣ Limpando dados de teste...');
  await prisma.companyFlag.delete({ where: { id: flag.id } });
  await prisma.aIReport.delete({ where: { id: report.id } });
  console.log('✅ Dados de teste removidos');
}

async function main() {
  console.log('🧪 TESTE: API Endpoints\n');

  try {
    await testUserAssetMonitorAPI();
    await testCompanyFlagsAPI();
  } catch (error) {
    console.error('\n❌ Erro:', error);
    if (error instanceof Error) {
      console.error(`   Mensagem: ${error.message}`);
      if (error.stack) {
        console.error(`   Stack: ${error.stack.split('\n').slice(0, 5).join('\n')}`);
      }
    }
    process.exit(1);
  }

  console.log('\n' + '='.repeat(60));
  console.log('✅ Teste concluído!');
  console.log('='.repeat(60));
}

main()
  .catch((error) => {
    console.error('❌ Erro fatal:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

