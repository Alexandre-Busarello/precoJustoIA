/**
 * Disclaimer Legal para Índices IPJ
 * 
 * Componente obrigatório que deve aparecer em todas as páginas de índices
 */

import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

export function IndexDisclaimer() {
  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-800">
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-amber-900 dark:text-amber-100">
            <p className="font-semibold mb-1">Aviso Legal</p>
            <p className="text-xs leading-relaxed">
              Os índices da família Preço Justo (IPJ) são carteiras teóricas automatizadas, geradas estritamente por algoritmos matemáticos baseados em dados públicos. A inclusão de um ativo no índice não configura recomendação de investimento, compra ou venda, nem leva em consideração o perfil de risco do usuário. Rentabilidade passada não é garantia de resultados futuros.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

