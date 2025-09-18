import axios from 'axios';
import * as dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { backgroundPrisma, backgroundPrismaManager } from './prisma-background';
import { ConcurrencyManager, executeWithRetry, executeWithTimeout } from './concurrency-manager';

// Carregar variáveis de ambiente
dotenv.config();

// Usar o cliente Prisma otimizado para background
const prisma = backgroundPrisma;

// Tokens das APIs
const BRAPI_TOKEN = process.env.BRAPI_TOKEN;

// Função para traduzir texto usando Gemini AI
async function translateToPortuguese(text: string, fieldType: 'description' | 'sector' | 'industry' = 'description'): Promise<string> {
  if (!text || text.trim().length === 0) {
    return text;
  }

  // Verificar se a API key do Gemini está configurada
  if (!process.env.GEMINI_API_KEY) {
    console.log(`⚠️  GEMINI_API_KEY não configurada, mantendo texto original`);
    return text;
  }

  try {
    const fieldNames = {
      description: 'descrição da empresa',
      sector: 'setor',
      industry: 'indústria'
    };
    
    console.log(`🌐 Traduzindo ${fieldNames[fieldType]} com Gemini AI...`);
    
    // Configurar Gemini AI
    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!,
    });

    let prompt: string;
    
    if (fieldType === 'description') {
      prompt = `Traduza o seguinte texto do inglês para português brasileiro de forma natural e fluida, mantendo o contexto empresarial e técnico. Retorne APENAS a tradução, sem explicações adicionais:

"${text}"`;
    } else {
      prompt = `Traduza o seguinte ${fieldType === 'sector' ? 'setor empresarial' : 'ramo de indústria'} do inglês para português brasileiro. Use a terminologia padrão do mercado brasileiro. Retorne APENAS a tradução, sem explicações adicionais:

"${text}"`;
    }

    const model = 'gemini-2.5-flash-lite';
    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ];

    // Fazer chamada para Gemini API (sem ferramentas de busca para tradução simples)
    const response = await ai.models.generateContentStream({
      model,
      contents,
    });

    // Coletar resposta completa
    let translatedText = '';
    for await (const chunk of response) {
      if (chunk.text) {
        translatedText += chunk.text;
      }
    }

    // Limpar a resposta (remover aspas extras, quebras de linha desnecessárias)
    translatedText = translatedText.trim().replace(/^["']|["']$/g, '');

    if (translatedText && translatedText.length > 0 && translatedText !== text) {
      console.log(`✅ ${fieldNames[fieldType].charAt(0).toUpperCase() + fieldNames[fieldType].slice(1)} traduzida com sucesso pelo Gemini`);
      return translatedText;
    }

    console.log(`⚠️  Tradução não disponível, mantendo texto original`);
    return text;

  } catch (error: any) {
    console.log(`⚠️  Erro na tradução com Gemini, mantendo texto original:`, error.message);
    return text;
  }
}

// Interface para resposta básica da Brapi
interface BrapiBasicResponse {
  results: Array<{
    symbol: string;
    shortName: string;
    longName: string;
    currency: string;
    regularMarketPrice: number;
    logourl?: string;
    sector?: string;
    summaryProfile?: {
      sector?: string;
      industry?: string;
      longBusinessSummary?: string;
      website?: string;
      address1?: string;
      address2?: string;
      address3?: string;
      city?: string;
      state?: string;
      country?: string;
      zip?: string;
      phone?: string;
      fax?: string;
      fullTimeEmployees?: number;
      industryKey?: string;
      industryDisp?: string;
      sectorKey?: string;
      sectorDisp?: string;
    };
  }>;
}

// Função para buscar dados básicos da empresa na Brapi API
async function fetchBrapiBasicData(ticker: string): Promise<BrapiBasicResponse['results'][0] | null> {
  return executeWithRetry(async () => {
    console.log(`🔍 Buscando dados básicos da Brapi para ${ticker}...`);
    
    const headers: Record<string, string> = {
      'User-Agent': 'analisador-acoes/1.0.0'
    };
    
    if (BRAPI_TOKEN) {
      headers['Authorization'] = `Bearer ${BRAPI_TOKEN}`;
    }
    
    const response = await axios.get<BrapiBasicResponse>(
      `https://brapi.dev/api/quote/${ticker}`,
      {
        headers,
        params: {
          token: '',
          range: '5d',
          interval: '1d',
          fundamental: 'true',
          dividends: 'true',
          modules: 'summaryProfile,balanceSheetHistory,financialDataHistory'
        },
        timeout: 15000
      }
    );

    if (response.status === 200 && response.data.results && response.data.results.length > 0) {
      console.log(`✅ Dados básicos obtidos da Brapi para ${ticker}`);
      return response.data.results[0];
    } else {
      console.log(`⚠️  Nenhum dado encontrado na Brapi para ${ticker}`);
      return null;
    }
  }, 3, 2000); // 3 tentativas, 2s de delay inicial
}

// Função para buscar empresas com campos faltantes
async function getCompaniesWithMissingFields(): Promise<Array<{
  id: number;
  ticker: string;
  name: string;
  sector: string | null;
  industry: string | null;
  description: string | null;
}>> {
  try {
    console.log('🔍 Buscando empresas com campos faltantes...');
    
    const companies = await prisma.company.findMany({
      where: {
        OR: [
          { sector: null },
          { industry: null },
          { description: null },
          { sector: '' },
          { industry: '' },
          { description: '' }
        ]
      },
      select: {
        id: true,
        ticker: true,
        name: true,
        sector: true,
        industry: true,
        description: true
      },
      orderBy: {
        ticker: 'asc'
      }
    });

    console.log(`📋 Encontradas ${companies.length} empresas com campos faltantes`);
    
    // Log detalhado dos campos faltantes
    const missingStats = {
      sector: companies.filter(c => !c.sector || c.sector.trim() === '').length,
      industry: companies.filter(c => !c.industry || c.industry.trim() === '').length,
      description: companies.filter(c => !c.description || c.description.trim() === '').length
    };
    
    console.log(`   📊 Campos faltantes: ${missingStats.sector} setores, ${missingStats.industry} indústrias, ${missingStats.description} descrições`);
    
    return companies;
    
  } catch (error: any) {
    console.error('❌ Erro ao buscar empresas com campos faltantes:', error.message);
    throw error;
  }
}

// Função para atualizar perfil de uma empresa
async function updateCompanyProfile(company: {
  id: number;
  ticker: string;
  name: string;
  sector: string | null;
  industry: string | null;
  description: string | null;
}): Promise<void> {
  try {
    console.log(`\n🏢 Atualizando perfil de ${company.ticker} - ${company.name}`);
    
    // Identificar campos faltantes
    const missingFields = [];
    if (!company.sector || company.sector.trim() === '') missingFields.push('setor');
    if (!company.industry || company.industry.trim() === '') missingFields.push('indústria');
    if (!company.description || company.description.trim() === '') missingFields.push('descrição');
    
    console.log(`   📋 Campos faltantes: ${missingFields.join(', ')}`);
    
    // Buscar dados da Brapi
    const brapiData = await fetchBrapiBasicData(company.ticker);
    
    if (!brapiData || !brapiData.summaryProfile) {
      console.log(`⚠️  Dados do summaryProfile não encontrados para ${company.ticker}`);
      return;
    }
    
    const profile = brapiData.summaryProfile;
    
    // Preparar dados para atualização
    const updateData: {
      sector?: string;
      industry?: string;
      description?: string;
    } = {};
    
    // Processar setor
    if (!company.sector || company.sector.trim() === '') {
      const sectorSource = profile.sector || brapiData.sector;
      if (sectorSource) {
        console.log(`   🏭 Traduzindo setor: "${sectorSource}"`);
        updateData.sector = await translateToPortuguese(sectorSource, 'sector');
        console.log(`   ✅ Setor traduzido: "${updateData.sector}"`);
      }
    }
    
    // Processar indústria
    if (!company.industry || company.industry.trim() === '') {
      if (profile.industry) {
        console.log(`   🏭 Traduzindo indústria: "${profile.industry}"`);
        updateData.industry = await translateToPortuguese(profile.industry, 'industry');
        console.log(`   ✅ Indústria traduzida: "${updateData.industry}"`);
      }
    }
    
    // Processar descrição
    if (!company.description || company.description.trim() === '') {
      if (profile.longBusinessSummary) {
        console.log(`   📝 Traduzindo descrição (${profile.longBusinessSummary.length} caracteres)`);
        updateData.description = await translateToPortuguese(profile.longBusinessSummary, 'description');
        console.log(`   ✅ Descrição traduzida (${updateData.description.length} caracteres)`);
      }
    }
    
    // Atualizar no banco se há dados para atualizar
    if (Object.keys(updateData).length > 0) {
      await prisma.company.update({
        where: { id: company.id },
        data: updateData
      });
      
      console.log(`✅ Perfil atualizado para ${company.ticker}: ${Object.keys(updateData).join(', ')}`);
    } else {
      console.log(`⚠️  Nenhum dado novo encontrado para ${company.ticker}`);
    }
    
  } catch (error: any) {
    console.error(`❌ Erro ao atualizar perfil de ${company.ticker}:`, error.message);
    throw error;
  }
}

// Função para processar empresas em lotes
async function processCompaniesInBatches(
  companies: Array<{
    id: number;
    ticker: string;
    name: string;
    sector: string | null;
    industry: string | null;
    description: string | null;
  }>,
  batchSize: number = 3,
  maxConcurrency: number = 2
): Promise<void> {
  console.log(`\n🔄 Processando ${companies.length} empresas em lotes de ${batchSize} com paralelismo ${maxConcurrency}`);
  
  const concurrencyManager = new ConcurrencyManager(maxConcurrency);
  let processedCount = 0;
  let successCount = 0;
  let errorCount = 0;
  
  for (let i = 0; i < companies.length; i += batchSize) {
    const batch = companies.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(companies.length / batchSize);
    
    console.log(`\n📦 Lote ${batchNumber}/${totalBatches}: ${batch.map(c => c.ticker).join(', ')}`);
    
    const batchStartTime = Date.now();
    
    // Processar lote em paralelo
    const results = await concurrencyManager.executeBatch(
      batch,
      async (company) => {
        try {
          await executeWithTimeout(
            () => updateCompanyProfile(company),
            60000 // 1 minuto timeout por empresa
          );
          return { success: true, ticker: company.ticker };
        } catch (error: any) {
          console.error(`❌ Erro ao processar ${company.ticker}:`, error.message);
          return { success: false, ticker: company.ticker, error: error.message };
        }
      },
      maxConcurrency
    );
    
    // Contar resultados do lote
    const batchSuccessful = results.filter(r => r.success).length;
    const batchFailed = results.filter(r => !r.success).length;
    
    processedCount += batch.length;
    successCount += batchSuccessful;
    errorCount += batchFailed;
    
    const batchTime = Date.now() - batchStartTime;
    console.log(`📦 Lote ${batchNumber} concluído em ${Math.round(batchTime / 1000)}s: ${batchSuccessful} sucessos, ${batchFailed} falhas`);
    
    // Log de progresso geral
    console.log(`📊 Progresso geral: ${processedCount}/${companies.length} empresas processadas (${successCount} sucessos, ${errorCount} falhas)`);
    
    // Pequeno delay entre lotes para não sobrecarregar as APIs
    if (i + batchSize < companies.length) {
      console.log('⏳ Aguardando 2s antes do próximo lote...');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log(`\n🎉 Processamento concluído:`);
  console.log(`   ✅ Sucessos: ${successCount}`);
  console.log(`   ❌ Falhas: ${errorCount}`);
  console.log(`   📊 Total processado: ${processedCount}`);
}

// Função principal
async function main() {
  const startTime = Date.now();
  console.log(`🚀 Iniciando atualização de perfis de empresas... [${new Date().toLocaleString('pt-BR')}]\n`);
  
  try {
    // Verificar argumentos
    const args = process.argv.slice(2);
    const specificTickers = args.filter(arg => !arg.startsWith('--')).map(t => t.toUpperCase());
    const dryRun = args.includes('--dry-run');
    const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='));
    const concurrencyArg = args.find(arg => arg.startsWith('--concurrency='));
    
    const batchSize = batchSizeArg ? parseInt(batchSizeArg.split('=')[1]) : 3;
    const maxConcurrency = concurrencyArg ? parseInt(concurrencyArg.split('=')[1]) : 2;
    
    console.log(`🔧 Configurações:`);
    console.log(`   📦 Tamanho do lote: ${batchSize}`);
    console.log(`   🔄 Paralelismo: ${maxConcurrency}`);
    console.log(`   🧪 Modo dry-run: ${dryRun ? '✅ Ativado' : '❌ Desativado'}`);
    
    if (specificTickers.length > 0) {
      console.log(`   📋 Tickers específicos: ${specificTickers.join(', ')}`);
    }
    
    // Verificar APIs necessárias
    if (!BRAPI_TOKEN) {
      console.log('⚠️  BRAPI_TOKEN não configurado - usando API gratuita');
    }
    
    if (!process.env.GEMINI_API_KEY) {
      console.log('❌ GEMINI_API_KEY não configurado - tradução não será possível');
      return;
    }
    
    // Buscar empresas com campos faltantes
    let companies;
    if (specificTickers.length > 0) {
      // Buscar apenas tickers específicos
      companies = await prisma.company.findMany({
        where: {
          ticker: { in: specificTickers },
          OR: [
            { sector: null },
            { industry: null },
            { description: null },
            { sector: '' },
            { industry: '' },
            { description: '' }
          ]
        },
        select: {
          id: true,
          ticker: true,
          name: true,
          sector: true,
          industry: true,
          description: true
        },
        orderBy: { ticker: 'asc' }
      });
      
      console.log(`📋 Encontradas ${companies.length} empresas específicas com campos faltantes`);
    } else {
      companies = await getCompaniesWithMissingFields();
    }
    
    if (companies.length === 0) {
      console.log('🎉 Nenhuma empresa encontrada com campos faltantes!');
      return;
    }
    
    // Mostrar preview das empresas que serão processadas
    console.log('\n📋 Empresas que serão processadas:');
    companies.slice(0, 10).forEach((company, index) => {
      const missing = [];
      if (!company.sector || company.sector.trim() === '') missing.push('setor');
      if (!company.industry || company.industry.trim() === '') missing.push('indústria');
      if (!company.description || company.description.trim() === '') missing.push('descrição');
      
      console.log(`   ${index + 1}. ${company.ticker} - ${company.name} (falta: ${missing.join(', ')})`);
    });
    
    if (companies.length > 10) {
      console.log(`   ... e mais ${companies.length - 10} empresas`);
    }
    
    if (dryRun) {
      console.log('\n🧪 Modo dry-run ativado - nenhuma alteração será feita no banco');
      return;
    }
    
    // Confirmar processamento
    console.log(`\n⚠️  Você está prestes a atualizar ${companies.length} empresas.`);
    console.log('   Pressione Ctrl+C para cancelar ou aguarde 5 segundos para continuar...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Processar empresas
    await processCompaniesInBatches(companies, batchSize, maxConcurrency);
    
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const minutes = Math.floor(totalTime / 60000);
    const seconds = Math.floor((totalTime % 60000) / 1000);
    
    console.log('\n✅ Atualização de perfis concluída!');
    console.log(`⏱️  Tempo total: ${minutes}m ${seconds}s`);
    console.log(`📅 Finalizado em: ${new Date().toLocaleString('pt-BR')}`);
    
  } catch (error: any) {
    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const minutes = Math.floor(totalTime / 60000);
    const seconds = Math.floor((totalTime % 60000) / 1000);
    
    console.error('❌ Erro geral:', error.message);
    console.log(`⏱️  Tempo até erro: ${minutes}m ${seconds}s`);
  } finally {
    // Desconectar o cliente Prisma de background
    await backgroundPrismaManager.disconnect();
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  main().catch(console.error);
}

export { 
  main, 
  updateCompanyProfile, 
  getCompaniesWithMissingFields, 
  fetchBrapiBasicData, 
  translateToPortuguese,
  processCompaniesInBatches
};
