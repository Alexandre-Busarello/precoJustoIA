import { prisma } from '@/lib/prisma';
import { safeQueryWithParams, safeWrite } from '@/lib/prisma-wrapper';

/**
 * Serviço de Monitoramento de Ativos
 * 
 * Gerencia a criação e atualização de snapshots dos ativos,
 * comparação de scores e listagem de inscritos.
 */
export class AssetMonitoringService {
  /**
   * Cria ou atualiza o snapshot de um ativo
   */
  static async createOrUpdateSnapshot(
    companyId: number,
    snapshotData: Record<string, any>,
    overallScore: number
  ): Promise<void> {
    await safeWrite(
      'asset-snapshot-upsert',
      () => prisma.assetSnapshot.upsert({
        where: { companyId },
        create: {
          companyId,
          snapshotData: snapshotData as any,
          overallScore,
        },
        update: {
          snapshotData: snapshotData as any,
          overallScore,
          updatedAt: new Date(),
        },
      }),
      ['asset_snapshots']
    );
  }

  /**
   * Busca o snapshot existente de um ativo
   */
  static async getSnapshot(companyId: number) {
    return await safeQueryWithParams(
      'asset_snapshots-by-company',
      () => prisma.assetSnapshot.findUnique({
        where: { companyId },
      }),
      { companyId }
    );
  }

  /**
   * Compara scores e determina se houve mudança significativa
   * @returns Objeto com info da mudança: { hasChange: boolean, direction: 'positive' | 'negative' | null, delta: number }
   */
  static compareScores(
    currentScore: number,
    previousScore: number,
    threshold: number = 5
  ): {
    hasChange: boolean;
    direction: 'positive' | 'negative' | null;
    delta: number;
  } {
    const delta = currentScore - previousScore;
    const hasChange = Math.abs(delta) >= threshold;

    return {
      hasChange,
      direction: hasChange ? (delta > 0 ? 'positive' : 'negative') : null,
      delta,
    };
  }

  /**
   * Lista emails dos usuários inscritos em um ativo
   */
  static async getSubscribersForCompany(companyId: number): Promise<
    Array<{
      userId: string;
      email: string;
      name: string | null;
    }>
  > {
    const subscriptions = await safeQueryWithParams(
      'user_asset_subscriptions-by-company',
      () => prisma.userAssetSubscription.findMany({
        where: { companyId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
            },
          },
        },
      }),
      { companyId }
    );

    return (subscriptions as any[]).map((sub) => ({
      userId: sub.user.id,
      email: sub.user.email,
      name: sub.user.name,
    }));
  }

  /**
   * Busca próximo lote de empresas para processar
   * Prioriza empresas nunca verificadas (null) e depois as mais antigas
   */
  static async getNextBatchToProcess(batchSize: number = 20) {
    // Primeiro busca empresas que nunca foram verificadas (lastCheckedAt null)
    const unprocessed = await prisma.company.findMany({
      where: { lastCheckedAt: null },
      take: batchSize,
      select: {
        id: true,
        ticker: true,
        name: true,
        sector: true,
        industry: true,
        logoUrl: true,
        lastCheckedAt: true,
      },
    });

    // Se já temos o batchSize completo, retorna
    if (unprocessed.length >= batchSize) {
      return unprocessed;
    }

    // Caso contrário, busca as mais antigas para completar o lote
    const remaining = batchSize - unprocessed.length;
    const oldest = await prisma.company.findMany({
      where: { lastCheckedAt: { not: null } },
      orderBy: { lastCheckedAt: 'asc' },
      take: remaining,
      select: {
        id: true,
        ticker: true,
        name: true,
        sector: true,
        industry: true,
        logoUrl: true,
        lastCheckedAt: true,
      },
    });

    return [...unprocessed, ...oldest];
  }

  /**
   * Atualiza o timestamp de última verificação de um ativo
   */
  static async updateLastChecked(companyId: number): Promise<void> {
    await safeWrite(
      'company-update-last-checked',
      () => prisma.company.update({
        where: { id: companyId },
        data: { lastCheckedAt: new Date() },
      }),
      ['companies']
    );
  }

  /**
   * Verifica se um ativo tem inscritos
   */
  static async hasSubscribers(companyId: number): Promise<boolean> {
    const count = await safeQueryWithParams(
      'asset-subscription-count',
      () => prisma.userAssetSubscription.count({
        where: { companyId },
      }),
      { companyId }
    );

    return (count as number) > 0;
  }

  /**
   * Conta total de empresas monitoradas (com inscritos)
   */
  static async countMonitoredCompanies(): Promise<number> {
    const result = await safeQueryWithParams(
      'monitored-companies-count',
      () => prisma.userAssetSubscription.groupBy({
        by: ['companyId'],
        _count: true,
      }),
      {}
    );

    return (result as any[]).length;
  }

  /**
   * Lista todas as empresas com inscritos
   */
  static async getCompaniesWithSubscribers() {
    const subscriptions = await safeQueryWithParams(
      'companies-with-subscribers',
      () => prisma.userAssetSubscription.findMany({
        distinct: ['companyId'],
        select: {
          companyId: true,
          company: {
            select: {
              id: true,
              ticker: true,
              name: true,
              sector: true,
              lastCheckedAt: true,
            },
          },
        },
      }),
      {}
    );

    return (subscriptions as any[]).map((sub) => sub.company);
  }
}

