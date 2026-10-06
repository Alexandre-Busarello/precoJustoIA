'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BrandLogo } from '@/components/ui/brand-logo';
import { FOOTER_SECTIONS, isFooterHidden } from '@/lib/navigation';
import { COVERED_ASSETS_LABEL, DATA_SOURCES_LABEL, LEGAL_NOTICE } from '@/lib/site-constants';

/**
 * Rodapé global, renderizado uma única vez pelo layout raiz.
 * Some em login/cadastro, checkout, landing de oferta/parceiros e admin.
 */
export function SiteFooter() {
  const pathname = usePathname();
  if (isFooterHidden(pathname)) return null;

  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface">
      <div className="container mx-auto px-4 py-10 md:py-12">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-6">
          <div className="col-span-2 space-y-3">
            <BrandLogo className="h-7" />
            <p className="max-w-xs text-sm text-muted-foreground">
              Valuation e indicadores fundamentalistas de {COVERED_ASSETS_LABEL} da B3: ações, BDRs e FIIs.
            </p>
          </div>
          {FOOTER_SECTIONS.map((section) => (
            <nav key={section.label} aria-label={section.label} className="min-w-0">
              <h2 className="text-sm font-medium text-foreground">{section.label}</h2>
              <ul className="mt-2 md:mt-3 md:space-y-2">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="inline-flex min-h-11 items-center text-sm text-muted-foreground transition-colors hover:text-foreground md:min-h-0"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 space-y-2 border-t border-border pt-6">
          <p className="max-w-4xl text-xs leading-5 text-muted-foreground">{LEGAL_NOTICE}</p>
          <p className="text-xs text-muted-foreground">
            © {year} Preço Justo AI · {DATA_SOURCES_LABEL}
          </p>
        </div>
      </div>
    </footer>
  );
}

/**
 * @deprecated O rodapé agora é renderizado uma vez pelo layout raiz (`SiteFooter`).
 * Usos antigos em páginas não renderizam nada e são removidos conforme cada página é migrada.
 */
export function Footer() {
  return null;
}
