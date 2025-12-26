/**
 * Teste Ponta a Ponta: Price Variation Report Service
 * 
 * Testa a geração de relatório de variação de preço com pesquisa na internet
 * 
 * Uso:
 *   npx tsx scripts/test-price-variation-report.ts PETR4
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
import {
  researchPriceDropReason,
  analyzeFundamentalImpact,
  generatePriceVariationReport,
  createFlagIfNeeded,
} from '../src/lib/price-variation-report-service';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function main() {
  const ticker = process.argv[2]?.toUpperCase();

  if (!ticker) {
    console.error('❌ Erro: Forneça um ticker');
    console.log('Uso: npx tsx scripts/test-price-variation-report.ts PETR4');
    process.exit(1);
  }

  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ Erro: GEMINI_API_KEY não configurada');
    console.log('   Configure a variável de ambiente GEMINI_API_KEY');
    process.exit(1);
  }

  console.log('🧪 TESTE: Price Variation Report Service\n');
  console.log(`📊 Testando ticker: ${ticker}\n`);

  try {
    // Buscar empresa
    const company = await prisma.company.findUnique({
      where: { ticker },
      select: {
        id: true,
        ticker: true,
        name: true,
      },
    });

    if (!company) {
      console.error(`❌ Empresa ${ticker} não encontrada no banco de dados`);
      process.exit(1);
    }

    console.log(`✅ Empresa encontrada: ${company.name} (ID: ${company.id})\n`);

    // Dados de teste de variação
    const variation = {
      days: 30,
      variation: -15.5, // Queda de 15.5%
      currentPrice: 25.50,
      previousPrice: 30.20,
    };

    console.log('='.repeat(60));
    console.log('TESTE 1: Pesquisa na Internet');
    console.log('='.repeat(60));
    console.log(`🔍 Pesquisando motivo da queda de ${Math.abs(variation.variation).toFixed(2)}%...\n`);

    const research = await researchPriceDropReason(
      company.ticker,
      company.name,
      variation
    );

    console.log('✅ Pesquisa concluída!\n');
    console.log('📄 Resultado da Pesquisa:');
    console.log('-'.repeat(60));
    console.log(research);
    console.log('-'.repeat(60));
    console.log();

    // Teste 2: Análise de impacto fundamental
    console.log('='.repeat(60));
    console.log('TESTE 2: Análise de Impacto Fundamental');
    console.log('='.repeat(60));
    console.log('🤖 Analisando se é perda de fundamento...\n');

    const analysis = await analyzeFundamentalImpact(
      company.ticker,
      company.name,
      variation,
      research,
      company.id // Passar companyId para verificar dividendos
    );

    console.log('✅ Análise concluída!\n');
    console.log('📊 Resultado da Análise:');
    console.log(`   - É perda de fundamento: ${analysis.isFundamentalLoss ? 'SIM ⚠️' : 'NÃO ✅'}`);
    console.log(`   - Conclusão: ${analysis.conclusion}`);
    console.log(`   - Raciocínio:`);
    console.log(`     ${analysis.reasoning.split('\n').join('\n     ')}`);
    console.log();

    // Teste 3: Geração de relatório completo
    console.log('='.repeat(60));
    console.log('TESTE 3: Geração de Relatório Completo');
    console.log('='.repeat(60));
    console.log('📝 Gerando relatório...\n');

    const report = await generatePriceVariationReport({
      ticker: company.ticker,
      companyName: company.name,
      variation,
      researchData: research,
    }, company.id); // Passar companyId para verificar dividendos

    console.log('✅ Relatório gerado!\n');
    console.log('📄 Relatório Completo:');
    console.log('='.repeat(60));
    console.log(report);
    console.log('='.repeat(60));
    console.log();

    // Teste 4: Criar flag se necessário
    if (analysis.isFundamentalLoss) {
      console.log('='.repeat(60));
      console.log('TESTE 4: Criação de Flag de Perda de Fundamento');
      console.log('='.repeat(60));

      // Criar relatório temporário para o flag
      const tempReport = await prisma.aIReport.create({
        data: {
          companyId: company.id,
          content: report,
          type: 'PRICE_VARIATION',
          status: 'COMPLETED',
          isActive: true,
          metadata: {
            test: true,
          } as any,
        },
      });

      const flagId = await createFlagIfNeeded(
        company.id,
        tempReport.id,
        analysis.conclusion || 'Perda de fundamento detectada'
      );

      if (flagId) {
        console.log(`✅ Flag criado: ${flagId}\n`);

        // Verificar flag criado
        const flag = await prisma.companyFlag.findUnique({
          where: { id: flagId },
          include: {
            report: {
              select: {
                id: true,
                type: true,
              },
            },
          },
        });

        if (flag) {
          console.log('📋 Detalhes do Flag:');
          console.log(`   - ID: ${flag.id}`);
          console.log(`   - Tipo: ${flag.flagType}`);
          console.log(`   - Motivo: ${flag.reason.substring(0, 100)}...`);
          console.log(`   - Relatório ID: ${flag.report.id}`);
          console.log(`   - Ativo: ${flag.isActive ? 'SIM' : 'NÃO'}`);
          console.log(`   - Criado em: ${flag.createdAt.toLocaleString('pt-BR')}`);
        }

        // Limpar flag de teste
        await prisma.companyFlag.delete({ where: { id: flagId } });
        await prisma.aIReport.delete({ where: { id: tempReport.id } });
        console.log('\n🧹 Flag e relatório de teste removidos');
      }
    } else {
      console.log('='.repeat(60));
      console.log('TESTE 4: Criação de Flag (PULADO)');
      console.log('='.repeat(60));
      console.log('✅ Não é perda de fundamento, flag não será criado');
    }

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

