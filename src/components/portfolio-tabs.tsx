'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface PortfolioTabsProps {
  portfolioId: string;
}

type Fade = 'none' | 'start' | 'end' | 'both';

const FADE_CLASSES: Record<Fade, string> = {
  none: '',
  end: '[mask-image:linear-gradient(to_right,#000_calc(100%_-_2rem),transparent)]',
  start: '[mask-image:linear-gradient(to_left,#000_calc(100%_-_2rem),transparent)]',
  both: '[mask-image:linear-gradient(to_right,transparent,#000_2rem,#000_calc(100%_-_2rem),transparent)]',
};

/**
 * Navegação entre as páginas da carteira: abas sublinhadas (2 px na cor da marca),
 * roláveis na horizontal no mobile, com esmaecimento no lado que tem conteúdo oculto.
 */
export function PortfolioTabs({ portfolioId }: PortfolioTabsProps) {
  const pathname = usePathname();
  const listRef = useRef<HTMLDivElement>(null);
  const [fade, setFade] = useState<Fade>('none');

  const tabs = [
    { href: `/carteira/${portfolioId}`, label: 'Visão geral' },
    { href: `/carteira/${portfolioId}/transacoes`, label: 'Transações' },
    { href: `/carteira/${portfolioId}/sugestoes`, label: 'Sugestões' },
    { href: `/carteira/${portfolioId}/analise`, label: 'Análise' },
    { href: `/carteira/${portfolioId}/config`, label: 'Configurações' },
  ];

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>('[aria-current="page"]');
    if (active) el.scrollLeft = Math.max(0, active.offsetLeft - el.clientWidth / 2 + active.clientWidth / 2);

    const update = () => {
      const max = el.scrollWidth - el.clientWidth;
      if (max <= 1) return setFade('none');
      const atStart = el.scrollLeft <= 1;
      const atEnd = el.scrollLeft >= max - 1;
      setFade(atStart ? 'end' : atEnd ? 'start' : 'both');
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    observer?.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      observer?.disconnect();
    };
  }, [pathname]);

  return (
    <nav aria-label="Seções da carteira" className="min-w-0">
      <div
        ref={listRef}
        className={cn(
          'no-scrollbar flex w-full snap-x items-center gap-5 overflow-x-auto shadow-[inset_0_-1px_0_var(--border)]',
          FADE_CLASSES[fade]
        )}
      >
        {tabs.map(({ href, label }) => {
          // Só a visão geral compara exatamente; as subpáginas não a deixam ativa.
          const isActive = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative inline-flex min-h-11 shrink-0 snap-start items-center whitespace-nowrap px-0.5 text-sm font-medium outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring md:min-h-10',
                'after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full',
                isActive
                  ? 'text-foreground after:bg-brand'
                  : 'text-muted-foreground after:bg-transparent hover:text-foreground'
              )}
            >
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
