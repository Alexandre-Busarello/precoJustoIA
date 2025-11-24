'use client';

import { useRouter } from 'next/navigation';
import { PortfolioConfigForm } from '@/components/portfolio-config-form';

export function CreatePortfolioPage() {
  const router = useRouter();

  return (
    <div className="container mx-auto px-4 py-6 sm:py-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold">Criar Nova Carteira</h1>
          <p className="text-muted-foreground mt-2">
            Configure sua carteira de investimentos e defina sua estratégia de alocação
          </p>
        </div>

        <div className="sticky bottom-0 left-0 right-0 z-10 bg-background border-t p-4 -mx-4 sm:mx-0 sm:border-t-0 sm:p-0 sm:static">
          <PortfolioConfigForm
            mode="create"
            onSuccess={() => {
              router.push('/carteira');
            }}
            onCancel={() => {
              router.push('/carteira');
            }}
          />
        </div>
      </div>
    </div>
  );
}

