'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Briefcase, Settings, Receipt, Sparkles, LineChart } from 'lucide-react';

interface PortfolioTabsProps {
  portfolioId: string;
}

export function PortfolioTabs({ portfolioId }: PortfolioTabsProps) {
  const pathname = usePathname();

  const tabs = [
    {
      href: `/carteira/${portfolioId}`,
      label: 'Detalhe',
      icon: Briefcase,
    },
    {
      href: `/carteira/${portfolioId}/config`,
      label: 'Config',
      icon: Settings,
    },
    {
      href: `/carteira/${portfolioId}/transacoes`,
      label: 'Transações',
      icon: Receipt,
    },
    {
      href: `/carteira/${portfolioId}/sugestoes`,
      label: 'Sugestões',
      icon: Sparkles,
    },
    {
      href: `/carteira/${portfolioId}/analise`,
      label: 'Análise',
      icon: LineChart,
    },
  ];

  return (
    <nav
      aria-label="Navegação da carteira"
      className="mb-6 -mx-2 px-2 sm:mx-0 sm:px-0 overflow-x-auto"
    >
      <div className="flex items-center gap-1 rounded-lg bg-muted p-1 w-fit min-w-full sm:min-w-0 sm:w-fit">
        {tabs.map(({ href, label, icon: Icon }) => {
          // Only the "Detalhe" tab matches exactly; nested routes should not
          // make the "Detalhe" tab appear active.
          const isActive = pathname === href;

          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
