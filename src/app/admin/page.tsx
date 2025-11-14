import { Metadata } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { requireAdminUser } from '@/lib/user-service';
import { AdminHubClient } from '@/components/admin/admin-hub-client';

export const metadata: Metadata = {
  title: 'Painel Administrativo | Preço Justo AI',
  description: 'Hub central para todas as ferramentas administrativas',
};

export default async function AdminHubPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login?callbackUrl=/admin');
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
          <AdminHubClient userEmail={user.email} userName={user.name || 'Admin'} />
        </div>
      </div>
    </div>
  );
}

