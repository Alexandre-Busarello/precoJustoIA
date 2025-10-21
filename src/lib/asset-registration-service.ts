/**
 * ASSET REGISTRATION SERVICE
 * 
 * Centraliza o cadastro de novos ativos (qualquer tipo)
 * quando adicionados a carteiras ou consultados
 * 
 * Features:
 * - Busca dados completos do Yahoo Finance
 * - Identifica automaticamente o tipo do ativo
 * - Salva na tabela companies
 * - Salva dados específicos (etf_data, fii_data)
 * - Busca e salva dados históricos iniciais
 */

import { prisma } from '@/lib/prisma';
import { safeWrite } from '@/lib/prisma-wrapper';
import { HistoricalDataService, type AssetInfo } from './historical-data-service';
import { YahooFinanceComplementService } from './yahoo-finance-complement-service';
import { AssetType } from '@prisma/client';

export interface AssetRegistrationResult {
  companyId: number;
  assetType: AssetType;
  success: boolean;
  isNew: boolean;
  message?: string;
}

/**
 * Asset Registration Service
 */
export class AssetRegistrationService {
  
  /**
   * Registra um ativo completo no sistema
   * 1. Busca dados do Yahoo Finance
   * 2. Identifica o tipo do ativo
   * 3. Salva ou atualiza na tabela companies (preserva sector/industry se existentes)
   * 4. Salva dados específicos (etf_data, fii_data, etc)
   * 5. Busca e salva dados históricos
   */
  static async registerAsset(ticker: string): Promise<AssetRegistrationResult> {
    const tickerUpper = ticker.toUpperCase();
    console.log(`\n📝 [REGISTRATION] Iniciando registro de ${tickerUpper}...`);

    // Check if already registered
    const existing = await prisma.company.findUnique({
      where: { ticker: tickerUpper },
      select: { 
        id: true, 
        assetType: true,
        sector: true,
        industry: true
      }
    });

    if (existing) {
      console.log(`🔄 [REGISTRATION] ${tickerUpper}: Já cadastrado (ID: ${existing.id}), atualizando dados...`);
      
      // Fetch latest data to update
      const assetInfo = await HistoricalDataService.fetchAssetInfo(tickerUpper);
      
      if (assetInfo) {
        // Update company record (preserve sector/industry if already set)
        await this.updateCompanyRecord(existing.id, assetInfo, existing);
        
        // Update asset-specific data
        await this.saveAssetSpecificData(existing.id, assetInfo);
      }
      
      // Complement with Yahoo Finance data (last source)
      // This will fill missing fields and save dividends
      await YahooFinanceComplementService.complementCompanyData(
        existing.id,
        tickerUpper,
        !!existing.sector, // preserve sector if exists
        !!existing.industry // preserve industry if exists
      );
      
      console.log(`✅ [REGISTRATION] ${tickerUpper}: Dados atualizados com sucesso`);
      
      return {
        companyId: existing.id,
        assetType: existing.assetType,
        success: true,
        isNew: false,
        message: 'Ativo atualizado com sucesso'
      };
    }

    // Fetch asset info from Yahoo Finance
    const assetInfo = await HistoricalDataService.fetchAssetInfo(tickerUpper);
    
    if (!assetInfo) {
      console.log(`❌ [REGISTRATION] ${tickerUpper}: Não encontrado no Yahoo Finance`);
      return {
        companyId: 0,
        assetType: 'OTHER' as AssetType,
        success: false,
        isNew: false,
        message: 'Ativo não encontrado no Yahoo Finance'
      };
    }

    console.log(`✅ [REGISTRATION] ${tickerUpper}: Dados obtidos - Tipo: ${assetInfo.assetType}`);

    // Create company record
    const companyId = await this.createCompanyRecord(assetInfo);
    
    if (!companyId) {
      console.log(`❌ [REGISTRATION] ${tickerUpper}: Erro ao criar registro da empresa`);
      return {
        companyId: 0,
        assetType: assetInfo.assetType as AssetType,
        success: false,
        isNew: false,
        message: 'Erro ao criar registro no banco'
      };
    }

    console.log(`✅ [REGISTRATION] ${tickerUpper}: Empresa criada (ID: ${companyId})`);

    // Save asset-specific data
    await this.saveAssetSpecificData(companyId, assetInfo);

    // Complement with Yahoo Finance data (last source)
    // This will fill missing fields and save dividends
    await YahooFinanceComplementService.complementCompanyData(
      companyId,
      tickerUpper,
      false, // Don't preserve sector (use Yahoo if available)
      false  // Don't preserve industry (use Yahoo if available)
    );

    // Fetch and save initial historical data (last 2 years, monthly)
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    
    try {
      await HistoricalDataService.ensureHistoricalData(
        tickerUpper,
        twoYearsAgo,
        new Date(),
        '1mo'
      );
      console.log(`✅ [REGISTRATION] ${tickerUpper}: Dados históricos salvos`);
    } catch (error) {
      console.log(`⚠️ [REGISTRATION] ${tickerUpper}: Erro ao salvar dados históricos:`, error);
    }

    console.log(`🎉 [REGISTRATION] ${tickerUpper}: Registro completo com complemento Yahoo Finance!\n`);

    return {
      companyId,
      assetType: assetInfo.assetType as AssetType,
      success: true,
      isNew: true,
      message: 'Ativo cadastrado com sucesso'
    };
  }

  /**
   * Atualiza registro da empresa (preserva sector/industry se já existentes)
   */
  private static async updateCompanyRecord(
    companyId: number, 
    assetInfo: AssetInfo,
    existing: { sector: string | null; industry: string | null }
  ): Promise<void> {
    try {
      await safeWrite(
        'update-company',
        () => prisma.company.update({
          where: { id: companyId },
          data: {
            name: assetInfo.name,
            // Preserve sector/industry if already set, otherwise update from Yahoo
            sector: existing.sector || assetInfo.sector,
            industry: existing.industry || assetInfo.industry,
            description: assetInfo.description?.substring(0, 1000),
            country: 'BR',
            address: assetInfo.quoteSummary?.assetProfile?.address1,
            city: assetInfo.quoteSummary?.assetProfile?.city,
            state: assetInfo.quoteSummary?.assetProfile?.state,
            zip: assetInfo.quoteSummary?.assetProfile?.zip,
            phone: assetInfo.quoteSummary?.assetProfile?.phone,
            website: assetInfo.quoteSummary?.assetProfile?.website,
            fullTimeEmployees: assetInfo.quoteSummary?.assetProfile?.fullTimeEmployees,
            updatedAt: new Date()
          }
        }),
        ['companies']
      );
    } catch (error) {
      console.error(`❌ [UPDATE COMPANY] Erro ao atualizar empresa:`, error);
    }
  }

  /**
   * Cria registro da empresa no banco
   */
  private static async createCompanyRecord(assetInfo: AssetInfo): Promise<number | null> {
    try {
      const company = await safeWrite(
        'create-company',
        () => prisma.company.create({
          data: {
            ticker: assetInfo.ticker,
            name: assetInfo.name,
            assetType: assetInfo.assetType as AssetType,
            sector: assetInfo.sector,
            industry: assetInfo.industry,
            description: assetInfo.description?.substring(0, 1000), // Limit description length
            country: 'BR',
            address: assetInfo.quoteSummary?.assetProfile?.address1,
            city: assetInfo.quoteSummary?.assetProfile?.city,
            state: assetInfo.quoteSummary?.assetProfile?.state,
            zip: assetInfo.quoteSummary?.assetProfile?.zip,
            phone: assetInfo.quoteSummary?.assetProfile?.phone,
            website: assetInfo.quoteSummary?.assetProfile?.website,
            fullTimeEmployees: assetInfo.quoteSummary?.assetProfile?.fullTimeEmployees
          }
        }),
        ['companies']
      );

      return company.id;
    } catch (error) {
      console.error(`❌ [CREATE COMPANY] Erro ao criar empresa:`, error);
      return null;
    }
  }

  /**
   * Salva dados específicos por tipo de ativo
   */
  private static async saveAssetSpecificData(companyId: number, assetInfo: AssetInfo): Promise<void> {
    try {
      if (assetInfo.assetType === 'ETF') {
        await this.saveEtfData(companyId, assetInfo);
      } else if (assetInfo.assetType === 'FII') {
        await this.saveFiiData(companyId, assetInfo);
      }
      // Add more asset types as needed
    } catch (error) {
      console.error(`⚠️ [ASSET SPECIFIC DATA] Erro ao salvar dados específicos:`, error);
    }
  }

  /**
   * Salva dados específicos de ETF
   */
  private static async saveEtfData(companyId: number, assetInfo: AssetInfo): Promise<void> {
    const quote = assetInfo.quote;
    const quoteSummary = assetInfo.quoteSummary;

    await safeWrite(
      'upsert-etf_data',
      () => prisma.etfData.upsert({
        where: { companyId },
        update: {
          netAssets: quote?.netAssets,
          netExpenseRatio: quote?.netExpenseRatio,
          dividendYield: quote?.dividendYield || quoteSummary?.summaryDetail?.dividendYield,
          ytdReturn: quote?.ytdReturn,
          totalAssets: quoteSummary?.summaryDetail?.totalAssets
        },
        create: {
          companyId,
          netAssets: quote?.netAssets,
          netExpenseRatio: quote?.netExpenseRatio,
          dividendYield: quote?.dividendYield || quoteSummary?.summaryDetail?.dividendYield,
          ytdReturn: quote?.ytdReturn,
          totalAssets: quoteSummary?.summaryDetail?.totalAssets
        }
      }),
      ['etf_data']
    );

    console.log(`✅ [ETF DATA] Dados de ETF salvos para companyId ${companyId}`);
  }

  /**
   * Salva dados específicos de FII
   */
  private static async saveFiiData(companyId: number, assetInfo: AssetInfo): Promise<void> {
    const quote = assetInfo.quote;
    const quoteSummary = assetInfo.quoteSummary;

    await safeWrite(
      'upsert-fii_data',
      () => prisma.fiiData.upsert({
        where: { companyId },
        update: {
          netAssets: quote?.netAssets || quote?.marketCap,
          dividendYield: quote?.dividendYield || quoteSummary?.summaryDetail?.dividendYield,
          lastDividendValue: quote?.trailingAnnualDividendRate,
          patrimonioLiquido: quoteSummary?.summaryDetail?.marketCap
        },
        create: {
          companyId,
          netAssets: quote?.netAssets || quote?.marketCap,
          dividendYield: quote?.dividendYield || quoteSummary?.summaryDetail?.dividendYield,
          lastDividendValue: quote?.trailingAnnualDividendRate,
          patrimonioLiquido: quoteSummary?.summaryDetail?.marketCap
        }
      }),
      ['fii_data']
    );

    console.log(`✅ [FII DATA] Dados de FII salvos para companyId ${companyId}`);
  }

  /**
   * Verifica se um ativo já está cadastrado
   */
  static async isAssetRegistered(ticker: string): Promise<boolean> {
    const tickerUpper = ticker.toUpperCase();
    const company = await prisma.company.findUnique({
      where: { ticker: tickerUpper },
      select: { id: true }
    });
    return !!company;
  }

  /**
   * Atualiza dados de um ativo existente
   */
  static async updateAsset(ticker: string): Promise<boolean> {
    const tickerUpper = ticker.toUpperCase();
    console.log(`🔄 [UPDATE] Atualizando dados de ${tickerUpper}...`);

    const company = await prisma.company.findUnique({
      where: { ticker: tickerUpper },
      select: { id: true, assetType: true }
    });

    if (!company) {
      console.log(`⚠️ [UPDATE] ${tickerUpper}: Não encontrado no banco`);
      return false;
    }

    // Fetch updated info from Yahoo Finance
    const assetInfo = await HistoricalDataService.fetchAssetInfo(tickerUpper);
    
    if (!assetInfo) {
      console.log(`⚠️ [UPDATE] ${tickerUpper}: Erro ao buscar dados atualizados`);
      return false;
    }

    // Update company record
    await safeWrite(
      'update-company',
      () => prisma.company.update({
        where: { id: company.id },
        data: {
          name: assetInfo.name,
          sector: assetInfo.sector,
          industry: assetInfo.industry,
          description: assetInfo.description?.substring(0, 1000),
          updatedAt: new Date()
        }
      }),
      ['companies']
    );

    // Update asset-specific data
    await this.saveAssetSpecificData(company.id, assetInfo);

    console.log(`✅ [UPDATE] ${tickerUpper}: Dados atualizados com sucesso`);
    return true;
  }

  /**
   * Registra múltiplos ativos em batch
   */
  static async registerMultipleAssets(tickers: string[]): Promise<AssetRegistrationResult[]> {
    const results: AssetRegistrationResult[] = [];

    for (const ticker of tickers) {
      const result = await this.registerAsset(ticker);
      results.push(result);
      
      // Add delay between requests to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return results;
  }
}

