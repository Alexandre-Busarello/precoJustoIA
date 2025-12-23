/**
 * Serviço para gerenciar preferências de relatórios do usuário
 */

import { prisma } from '@/lib/prisma';
import { AIReportType } from '@prisma/client';

interface ReportPreferences {
  MONTHLY_OVERVIEW?: boolean;
  FUNDAMENTAL_CHANGE?: boolean;
  PRICE_VARIATION?: boolean;
}

/**
 * Verifica se o usuário quer receber um tipo específico de relatório
 * Por padrão, retorna true se não houver preferências configuradas
 */
export async function shouldSendReportType(
  userId: string,
  reportType: AIReportType
): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { reportPreferences: true },
    });

    if (!user?.reportPreferences) {
      // Se não há preferências, retornar true (padrão: enviar todos)
      return true;
    }

    const preferences = user.reportPreferences as ReportPreferences;

    // Mapear tipos de relatório para chaves de preferências
    const preferenceKey: keyof ReportPreferences | null = 
      reportType === 'MONTHLY_OVERVIEW' ? 'MONTHLY_OVERVIEW' :
      reportType === 'FUNDAMENTAL_CHANGE' ? 'FUNDAMENTAL_CHANGE' :
      reportType === 'PRICE_VARIATION' ? 'PRICE_VARIATION' :
      null;

    if (!preferenceKey) {
      // Para tipos não mapeados (ex: CUSTOM_TRIGGER), sempre enviar
      return true;
    }

    // Retornar preferência do usuário, ou true se não estiver definida
    return preferences[preferenceKey] ?? true;
  } catch (error) {
    console.error('Erro ao verificar preferências de relatórios:', error);
    // Em caso de erro, retornar true (padrão: enviar)
    return true;
  }
}

/**
 * Busca as preferências de relatórios do usuário
 */
export async function getUserReportPreferences(
  userId: string
): Promise<ReportPreferences> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { reportPreferences: true },
    });

    if (!user?.reportPreferences) {
      // Retornar padrão: todos ativados
      return {
        MONTHLY_OVERVIEW: true,
        FUNDAMENTAL_CHANGE: true,
        PRICE_VARIATION: true,
      };
    }

    return user.reportPreferences as ReportPreferences;
  } catch (error) {
    console.error('Erro ao buscar preferências de relatórios:', error);
    // Retornar padrão em caso de erro
    return {
      MONTHLY_OVERVIEW: true,
      FUNDAMENTAL_CHANGE: true,
      PRICE_VARIATION: true,
    };
  }
}

