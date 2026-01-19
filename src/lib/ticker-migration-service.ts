/**
 * Ticker Migration Service
 * 
 * Serviço para migrar histórico financeiro quando empresas alteram código de negociação na B3.
 * Unifica dados históricos do ticker antigo para o novo, mantendo integridade para cálculos de Valuation.
 */

import { prisma } from '@/lib/prisma';
import { AssetRegistrationService } from './asset-registration-service';
import { smartCache } from './smart-query-cache';

interface MigrationStats {
  balanceSheets: number;
  incomeStatements: number;
  cashflowStatements: number;
  dividendHistory: number;
  financialData: number;
  keyStatistics: number;
  dailyQuotes: number;
  historicalPrices: number;
  valueAddedStatements: number;
  quarterlyFinancials: number;
  priceOscillations: number;
  totalRecords: number;
}

export interface MigrationResult {
  success: boolean;
  oldTicker: string;
  newTicker: string;
  oldCompanyId: number;
  newCompanyId: number;
  stats: MigrationStats;
  message: string;
}

export class TickerMigrationService {
  /**
   * Migra histórico financeiro de um ticker antigo para um novo
   */
  static async migrateTickerHistory(
    oldTicker: string,
    newTicker: string
  ): Promise<MigrationResult> {
    const normalizedOldTicker = oldTicker.toUpperCase();
    const normalizedNewTicker = newTicker.toUpperCase();

    // Validação inicial
    if (normalizedOldTicker === normalizedNewTicker) {
      throw new Error('Tickers antigo e novo não podem ser iguais');
    }

    // Buscar empresa antiga
    const oldCompany = await prisma.company.findUnique({
      where: { ticker: normalizedOldTicker },
    });

    if (!oldCompany) {
      throw new Error(`Ticker antigo ${normalizedOldTicker} não encontrado`);
    }

    // Verificar se já foi migrado
    if (!oldCompany.isActive && oldCompany.successorId) {
      throw new Error(
        `Ticker ${normalizedOldTicker} já foi migrado para outro ticker`
      );
    }

    // Buscar ou criar empresa nova
    let newCompany = await prisma.company.findUnique({
      where: { ticker: normalizedNewTicker },
    });

    if (!newCompany) {
      // Criar empresa nova usando AssetRegistrationService
      console.log(
        `📝 Criando empresa ${normalizedNewTicker} via AssetRegistrationService...`
      );
      try {
        await AssetRegistrationService.registerAsset(normalizedNewTicker);
        newCompany = await prisma.company.findUnique({
          where: { ticker: normalizedNewTicker },
        });

        if (!newCompany) {
          throw new Error(
            `Não foi possível criar empresa ${normalizedNewTicker}`
          );
        }
      } catch (error) {
        console.error(
          `❌ Erro ao criar empresa ${normalizedNewTicker}:`,
          error
        );
        throw new Error(
          `Não foi possível criar empresa ${normalizedNewTicker}: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
        );
      }
    }

    // Executar migração em transação atômica
    return await prisma.$transaction(
      async (tx) => {
        const stats: MigrationStats = {
          balanceSheets: 0,
          incomeStatements: 0,
          cashflowStatements: 0,
          dividendHistory: 0,
          financialData: 0,
          keyStatistics: 0,
          dailyQuotes: 0,
          historicalPrices: 0,
          valueAddedStatements: 0,
          quarterlyFinancials: 0,
          priceOscillations: 0,
          totalRecords: 0,
        };

        // 1. Balance Sheets - Gap Analysis por endDate e period
        const existingBalanceSheets = await tx.balanceSheet.findMany({
          where: { companyId: newCompany.id },
          select: { endDate: true, period: true },
        });
        const existingBalanceSheetKeys = new Set(
          existingBalanceSheets.map(
            (bs) => `${bs.endDate.toISOString()}-${bs.period}`
          )
        );

        const balanceSheetsToMigrate = await tx.balanceSheet.findMany({
          where: {
            companyId: oldCompany.id,
            NOT: {
              AND: [
                { endDate: { in: existingBalanceSheets.map((bs) => bs.endDate) } },
                { period: { in: existingBalanceSheets.map((bs) => bs.period) } },
              ],
            },
          },
        });

        // Filtrar por chave única
        const filteredBalanceSheets = balanceSheetsToMigrate.filter(
          (bs) =>
            !existingBalanceSheetKeys.has(
              `${bs.endDate.toISOString()}-${bs.period}`
            )
        );

        if (filteredBalanceSheets.length > 0) {
          await tx.balanceSheet.updateMany({
            where: {
              id: { in: filteredBalanceSheets.map((bs) => bs.id) },
            },
            data: { companyId: newCompany.id },
          });
          stats.balanceSheets = filteredBalanceSheets.length;
        }

        // 2. Income Statements - Gap Analysis por endDate e period
        const existingIncomeStatements = await tx.incomeStatement.findMany({
          where: { companyId: newCompany.id },
          select: { endDate: true, period: true },
        });
        const existingIncomeStatementKeys = new Set(
          existingIncomeStatements.map(
            (is) => `${is.endDate.toISOString()}-${is.period}`
          )
        );

        const incomeStatementsToMigrate = await tx.incomeStatement.findMany({
          where: { companyId: oldCompany.id },
        });

        const filteredIncomeStatements = incomeStatementsToMigrate.filter(
          (is) =>
            !existingIncomeStatementKeys.has(
              `${is.endDate.toISOString()}-${is.period}`
            )
        );

        if (filteredIncomeStatements.length > 0) {
          await tx.incomeStatement.updateMany({
            where: {
              id: { in: filteredIncomeStatements.map((is) => is.id) },
            },
            data: { companyId: newCompany.id },
          });
          stats.incomeStatements = filteredIncomeStatements.length;
        }

        // 3. Cashflow Statements - Gap Analysis por endDate e period
        const existingCashflowStatements =
          await tx.cashflowStatement.findMany({
            where: { companyId: newCompany.id },
            select: { endDate: true, period: true },
          });
        const existingCashflowStatementKeys = new Set(
          existingCashflowStatements.map(
            (cf) => `${cf.endDate.toISOString()}-${cf.period}`
          )
        );

        const cashflowStatementsToMigrate =
          await tx.cashflowStatement.findMany({
            where: { companyId: oldCompany.id },
          });

        const filteredCashflowStatements = cashflowStatementsToMigrate.filter(
          (cf) =>
            !existingCashflowStatementKeys.has(
              `${cf.endDate.toISOString()}-${cf.period}`
            )
        );

        if (filteredCashflowStatements.length > 0) {
          await tx.cashflowStatement.updateMany({
            where: {
              id: { in: filteredCashflowStatements.map((cf) => cf.id) },
            },
            data: { companyId: newCompany.id },
          });
          stats.cashflowStatements = filteredCashflowStatements.length;
        }

        // 4. Dividend History - Gap Analysis por exDate e amount
        const existingDividends = await tx.dividendHistory.findMany({
          where: { companyId: newCompany.id },
          select: { exDate: true, amount: true },
        });
        const existingDividendKeys = new Set(
          existingDividends.map(
            (d) => `${d.exDate.toISOString()}-${d.amount.toString()}`
          )
        );

        const dividendsToMigrate = await tx.dividendHistory.findMany({
          where: { companyId: oldCompany.id },
        });

        const filteredDividends = dividendsToMigrate.filter(
          (d) =>
            !existingDividendKeys.has(
              `${d.exDate.toISOString()}-${d.amount.toString()}`
            )
        );

        if (filteredDividends.length > 0) {
          await tx.dividendHistory.updateMany({
            where: {
              id: { in: filteredDividends.map((d) => d.id) },
            },
            data: { companyId: newCompany.id },
          });
          stats.dividendHistory = filteredDividends.length;
        }

        // 5. Financial Data - Gap Analysis por year
        const existingFinancialData = await tx.financialData.findMany({
          where: { companyId: newCompany.id },
          select: { year: true },
        });
        const existingFinancialDataYears = new Set(
          existingFinancialData.map((fd) => fd.year)
        );

        const financialDataToMigrate = await tx.financialData.findMany({
          where: {
            companyId: oldCompany.id,
            year: { notIn: Array.from(existingFinancialDataYears) },
          },
        });

        if (financialDataToMigrate.length > 0) {
          await tx.financialData.updateMany({
            where: {
              id: { in: financialDataToMigrate.map((fd) => fd.id) },
            },
            data: { companyId: newCompany.id },
          });
          stats.financialData = financialDataToMigrate.length;
        }

        // 6. Key Statistics - Gap Analysis por endDate e period
        const existingKeyStatistics = await tx.keyStatistics.findMany({
          where: { companyId: newCompany.id },
          select: { endDate: true, period: true },
        });
        const existingKeyStatisticsKeys = new Set(
          existingKeyStatistics.map(
            (ks) => `${ks.endDate.toISOString()}-${ks.period}`
          )
        );

        const keyStatisticsToMigrate = await tx.keyStatistics.findMany({
          where: { companyId: oldCompany.id },
        });

        const filteredKeyStatistics = keyStatisticsToMigrate.filter(
          (ks) =>
            !existingKeyStatisticsKeys.has(
              `${ks.endDate.toISOString()}-${ks.period}`
            )
        );

        if (filteredKeyStatistics.length > 0) {
          await tx.keyStatistics.updateMany({
            where: {
              id: { in: filteredKeyStatistics.map((ks) => ks.id) },
            },
            data: { companyId: newCompany.id },
          });
          stats.keyStatistics = filteredKeyStatistics.length;
        }

        // 7. Daily Quotes - Gap Analysis por date
        const existingDailyQuotes = await tx.dailyQuote.findMany({
          where: { companyId: newCompany.id },
          select: { date: true },
        });
        const existingDailyQuoteDates = new Set(
          existingDailyQuotes.map((dq) => dq.date.toISOString())
        );

        const dailyQuotesToMigrate = await tx.dailyQuote.findMany({
          where: {
            companyId: oldCompany.id,
            date: {
              notIn: Array.from(existingDailyQuotes.map((dq) => dq.date)),
            },
          },
        });

        if (dailyQuotesToMigrate.length > 0) {
          await tx.dailyQuote.updateMany({
            where: {
              id: { in: dailyQuotesToMigrate.map((dq) => dq.id) },
            },
            data: { companyId: newCompany.id },
          });
          stats.dailyQuotes = dailyQuotesToMigrate.length;
        }

        // 8. Historical Prices - Gap Analysis por date e interval
        const existingHistoricalPrices = await tx.historicalPrice.findMany({
          where: { companyId: newCompany.id },
          select: { date: true, interval: true },
        });
        const existingHistoricalPriceKeys = new Set(
          existingHistoricalPrices.map(
            (hp) => `${hp.date.toISOString()}-${hp.interval}`
          )
        );

        const historicalPricesToMigrate = await tx.historicalPrice.findMany({
          where: { companyId: oldCompany.id },
        });

        const filteredHistoricalPrices = historicalPricesToMigrate.filter(
          (hp) =>
            !existingHistoricalPriceKeys.has(
              `${hp.date.toISOString()}-${hp.interval}`
            )
        );

        if (filteredHistoricalPrices.length > 0) {
          await tx.historicalPrice.updateMany({
            where: {
              id: { in: filteredHistoricalPrices.map((hp) => hp.id) },
            },
            data: { companyId: newCompany.id },
          });
          stats.historicalPrices = filteredHistoricalPrices.length;
        }

        // 9. Value Added Statements - Gap Analysis por endDate e period
        const existingValueAddedStatements =
          await tx.valueAddedStatement.findMany({
            where: { companyId: newCompany.id },
            select: { endDate: true, period: true },
          });
        const existingValueAddedStatementKeys = new Set(
          existingValueAddedStatements.map(
            (vas) => `${vas.endDate.toISOString()}-${vas.period}`
          )
        );

        const valueAddedStatementsToMigrate =
          await tx.valueAddedStatement.findMany({
            where: { companyId: oldCompany.id },
          });

        const filteredValueAddedStatements =
          valueAddedStatementsToMigrate.filter(
            (vas) =>
              !existingValueAddedStatementKeys.has(
                `${vas.endDate.toISOString()}-${vas.period}`
              )
          );

        if (filteredValueAddedStatements.length > 0) {
          await tx.valueAddedStatement.updateMany({
            where: {
              id: { in: filteredValueAddedStatements.map((vas) => vas.id) },
            },
            data: { companyId: newCompany.id },
          });
          stats.valueAddedStatements = filteredValueAddedStatements.length;
        }

        // 10. Quarterly Financials - Gap Analysis por extractionDate
        const existingQuarterlyFinancials =
          await tx.quarterlyFinancials.findMany({
            where: { companyId: newCompany.id },
            select: { extractionDate: true },
          });
        const existingQuarterlyFinancialDates = new Set(
          existingQuarterlyFinancials.map((qf) =>
            qf.extractionDate.toISOString()
          )
        );

        const quarterlyFinancialsToMigrate =
          await tx.quarterlyFinancials.findMany({
            where: {
              companyId: oldCompany.id,
              extractionDate: {
                notIn: Array.from(
                  existingQuarterlyFinancials.map((qf) => qf.extractionDate)
                ),
              },
            },
          });

        if (quarterlyFinancialsToMigrate.length > 0) {
          await tx.quarterlyFinancials.updateMany({
            where: {
              id: { in: quarterlyFinancialsToMigrate.map((qf) => qf.id) },
            },
            data: { companyId: newCompany.id },
          });
          stats.quarterlyFinancials = quarterlyFinancialsToMigrate.length;
        }

        // 11. Price Oscillations - Gap Analysis por extractionDate
        const existingPriceOscillations = await tx.priceOscillations.findMany({
          where: { companyId: newCompany.id },
          select: { extractionDate: true },
        });
        const existingPriceOscillationDates = new Set(
          existingPriceOscillations.map((po) =>
            po.extractionDate.toISOString()
          )
        );

        const priceOscillationsToMigrate = await tx.priceOscillations.findMany({
          where: {
            companyId: oldCompany.id,
            extractionDate: {
              notIn: Array.from(
                existingPriceOscillations.map((po) => po.extractionDate)
              ),
            },
          },
        });

        if (priceOscillationsToMigrate.length > 0) {
          await tx.priceOscillations.updateMany({
            where: {
              id: { in: priceOscillationsToMigrate.map((po) => po.id) },
            },
            data: { companyId: newCompany.id },
          });
          stats.priceOscillations = priceOscillationsToMigrate.length;
        }

        // Calcular total
        stats.totalRecords =
          stats.balanceSheets +
          stats.incomeStatements +
          stats.cashflowStatements +
          stats.dividendHistory +
          stats.financialData +
          stats.keyStatistics +
          stats.dailyQuotes +
          stats.historicalPrices +
          stats.valueAddedStatements +
          stats.quarterlyFinancials +
          stats.priceOscillations;

        // Atualizar logo da empresa nova se necessário
        // Se a logo da empresa nova não estiver preenchida ou for o placeholder da Brapi,
        // copiar a logo da empresa antiga
        const shouldUpdateLogo =
          !newCompany.logoUrl ||
          newCompany.logoUrl === 'https://icons.brapi.dev/icons/BRAPI.svg';

        if (shouldUpdateLogo && oldCompany.logoUrl) {
          await tx.company.update({
            where: { id: newCompany.id },
            data: {
              logoUrl: oldCompany.logoUrl,
            },
          });
        }

        // Copiar dados faltantes da empresa origem para a destino
        // Se o nome da empresa destino é igual ao ticker (empresa recém-criada sem dados),
        // ou se campos importantes estão faltando, copiar da empresa origem
        const isNewCompanyWithNoData =
          newCompany.name.toUpperCase() === normalizedNewTicker;
        
        const updateData: Record<string, any> = {};

        // Lista de campos que devem ser copiados se faltarem na empresa destino
        const fieldsToCopy: Array<keyof typeof oldCompany> = [
          'sector',
          'industry',
          'cnpj',
          'description',
          'address',
          'city',
          'state',
          'country',
          'fullTimeEmployees',
          'address2',
          'address3',
          'fax',
          'industryDisp',
          'industryKey',
          'phone',
          'sectorDisp',
          'sectorKey',
          'zip',
          'website',
        ];

        // Se é empresa nova sem dados OU se campos importantes estão faltando, copiar
        if (isNewCompanyWithNoData) {
          // Copiar o nome da empresa origem se o destino tem apenas o ticker como nome
          if (oldCompany.name && oldCompany.name !== normalizedOldTicker) {
            updateData.name = oldCompany.name;
          }

          // Copiar todos os campos disponíveis da origem
          for (const field of fieldsToCopy) {
            const oldValue = oldCompany[field];
            const newValue = newCompany[field];
            
            // Copiar se o valor da origem existe e o destino não tem ou está vazio
            if (
              oldValue !== null &&
              oldValue !== undefined &&
              (newValue === null || newValue === undefined || newValue === '')
            ) {
              updateData[field] = oldValue;
            }
          }
        } else {
          // Mesmo que não seja empresa nova, copiar campos específicos se faltarem
          const criticalFields: Array<keyof typeof oldCompany> = [
            'sector',
            'industry',
            'cnpj',
            'description',
            'address',
            'city',
            'state',
            'country',
          ];

          for (const field of criticalFields) {
            const oldValue = oldCompany[field];
            const newValue = newCompany[field];
            
            // Copiar se o valor da origem existe e o destino não tem ou está vazio
            if (
              oldValue !== null &&
              oldValue !== undefined &&
              (newValue === null || newValue === undefined || newValue === '')
            ) {
              updateData[field] = oldValue;
            }
          }
        }

        // Atualizar empresa destino com dados copiados
        if (Object.keys(updateData).length > 0) {
          console.log(
            `📋 Copiando ${Object.keys(updateData).length} campos da empresa origem para destino`
          );
          await tx.company.update({
            where: { id: newCompany.id },
            data: updateData,
          });
        }

        // Atualizar empresa antiga: marcar como inativa e vincular sucessor
        await tx.company.update({
          where: { id: oldCompany.id },
          data: {
            isActive: false,
            successorId: newCompany.id,
            name: `${oldCompany.name} (Migrado)`,
          },
        });

        // Invalidar cache
        await smartCache.invalidate([
          'companies',
          'balance_sheets',
          'income_statements',
          'cashflow_statements',
          'dividend_history',
          'financial_data',
          'key_statistics',
          'daily_quotes',
          'historical_prices',
          'value_added_statements',
          'quarterly_financials',
          'price_oscillations',
        ]);

        return {
          success: true,
          oldTicker: normalizedOldTicker,
          newTicker: normalizedNewTicker,
          oldCompanyId: oldCompany.id,
          newCompanyId: newCompany.id,
          stats,
          message: `Migração concluída: ${stats.totalRecords} registros migrados de ${normalizedOldTicker} para ${normalizedNewTicker}`,
        };
      },
      {
        timeout: 60000, // 60 segundos timeout
      }
    );
  }

  /**
   * Obtém lista de migrações já realizadas
   */
  static async getCompletedMigrations(): Promise<
    Array<{
      oldTicker: string;
      newTicker: string;
      oldCompanyName: string;
      newCompanyName: string;
      migratedAt: Date;
    }>
  > {
    const migratedCompanies = await prisma.company.findMany({
      where: {
        isActive: false,
        successorId: { not: null },
      },
      include: {
        successor: {
          select: {
            ticker: true,
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return migratedCompanies
      .filter((c) => c.successor)
      .map((c) => ({
        oldTicker: c.ticker,
        newTicker: c.successor!.ticker,
        oldCompanyName: c.name,
        newCompanyName: c.successor!.name,
        migratedAt: c.updatedAt || new Date(),
      }));
  }
}

