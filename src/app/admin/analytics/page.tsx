/**
 * Dashboard Admin de Analytics
 * Visualização de métricas de uso da aplicação
 */

import { Metadata } from 'next';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requireAdminUser } from '@/lib/user-service';
import { redirect } from 'next/navigation';
import { AnalyticsDashboardClient } from '@/components/admin/analytics-dashboard-client';

export const metadata: Metadata = {
  title: 'Analytics Dashboard | Admin | Preço Justo AI',
  description: 'Dashboard de analytics e métricas de uso da aplicação',
};

export default async function AdminAnalyticsPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login?callbackUrl=/admin/analytics');
  }

  // Verificar se o usuário é admin
  const user = await requireAdminUser();

  if (!user) {
    redirect('/?error=access-denied');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-4 sm:py-8">
      <div className="container mx-auto px-4">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 sm:mb-8">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">
              Dashboard de Analytics
            </h1>
            <p className="text-base sm:text-lg text-gray-600">
              Métricas e estatísticas de uso da aplicação
            </p>
          </div>

          <AnalyticsDashboardClient />
        </div>
      </div>
    </div>
  );
}

