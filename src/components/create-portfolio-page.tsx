'use client';

import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/page-header';
import { PortfolioConfigForm } from '@/components/portfolio-config-form';

export function CreatePortfolioPage() {
  const router = useRouter();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-8">
      <PageHeader
        breadcrumb={[{ label: 'Carteiras', href: '/carteira' }, { label: 'Nova carteira' }]}
        title="Nova carteira"
        description="Defina o nome, o aporte mensal e, se quiser, os ativos com a alocação-alvo."
      />

      <div className="mt-6">
        <PortfolioConfigForm
          mode="create"
          onSuccess={() => router.push('/carteira')}
          onCancel={() => router.push('/carteira')}
        />
      </div>
    </div>
  );
}
