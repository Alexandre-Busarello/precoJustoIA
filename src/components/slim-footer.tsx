import Link from 'next/link';
import { LEGAL_NOTICE } from '@/lib/site-constants';

/** Rodapé enxuto das landing pages de oferta: links legais, aviso e copyright. */
export function SlimFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-surface py-8 pb-[calc(2rem+env(safe-area-inset-bottom))]">
      <div className="container mx-auto space-y-4 px-4 text-center">
        <nav aria-label="Links legais" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-sm">
          <Link href="/termos-de-uso" className="inline-flex min-h-11 items-center text-muted-foreground hover:text-foreground">
            Termos de uso
          </Link>
          <Link href="/lgpd" className="inline-flex min-h-11 items-center text-muted-foreground hover:text-foreground">
            Privacidade e LGPD
          </Link>
          <Link href="/contato" className="inline-flex min-h-11 items-center text-muted-foreground hover:text-foreground">
            Contato
          </Link>
        </nav>
        <p className="mx-auto max-w-3xl text-xs leading-5 text-muted-foreground">{LEGAL_NOTICE}</p>
        <p className="text-xs text-muted-foreground">© {year} Preço Justo AI. Todos os direitos reservados.</p>
      </div>
    </footer>
  );
}
