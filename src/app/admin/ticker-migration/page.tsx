import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { requireAdminUser } from '@/lib/user-service';
import { TickerMigrationClient } from '@/components/admin/ticker-migration-client';

export const metadata: Metadata = {
  title: 'Migração de Tickers | Admin | Preço Justo AI',
  description: 'Unifique histórico financeiro quando empresas mudam código de negociação',
};

export default async function TickerMigrationPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login?callbackUrl=/admin/ticker-migration');
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
          <TickerMigrationClient />
        </div>
      </div>
    </div>
  );
}








