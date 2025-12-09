import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { requireAdminUser } from '@/lib/user-service';
import { YahooDebugClient } from '@/components/admin/yahoo-debug-client';

export const metadata: Metadata = {
  title: 'Yahoo Finance Debug - Admin',
  description: 'Ferramenta de debug para testar requisições ao Yahoo Finance',
};

export default async function YahooDebugPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/login?callbackUrl=/admin/yahoo-debug');
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
              Yahoo Finance Debug Tool
            </h1>
            <p className="text-base sm:text-lg text-gray-600">
              Teste requisições ao Yahoo Finance via API direta e biblioteca yahoo-finance2
            </p>
          </div>

          <YahooDebugClient />
        </div>
      </div>
    </div>
  );
}

