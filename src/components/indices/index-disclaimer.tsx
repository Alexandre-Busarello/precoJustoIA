/**
 * Aviso legal dos índices IPJ (obrigatório em todas as páginas de índices).
 * Nota discreta em texto pequeno, exibida abaixo do conteúdo principal.
 */

import { cn } from '@/lib/utils';

export function IndexDisclaimer({ className }: { className?: string }) {
  return (
    <p className={cn('max-w-[96ch] text-xs leading-5 text-muted-foreground', className)}>
      <span className="font-medium text-foreground">Aviso legal.</span> Os índices da família Preço Justo (IPJ) são
      carteiras teóricas automatizadas, geradas estritamente por algoritmos matemáticos baseados em dados públicos. A
      inclusão de um ativo no índice não é recomendação de investimento e não leva em consideração o perfil de risco
      do usuário. Rentabilidade passada não é garantia de resultados futuros.
    </p>
  );
}
