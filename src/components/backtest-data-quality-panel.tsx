'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDate, formatPct } from '@/lib/format';
import { dateFromApi, monthsBetween, relevantAssetWarnings } from '@/app/backtest/backtest-utils';

interface DataAvailability {
  ticker: string;
  availableFrom: Date | string;
  availableTo: Date | string;
  totalMonths: number;
  missingMonths: number;
  dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
  warnings: string[];
}

interface BacktestDataValidation {
  isValid: boolean;
  adjustedStartDate: Date | string;
  adjustedEndDate: Date | string;
  assetsAvailability: DataAvailability[];
  globalWarnings: string[];
  recommendations: string[];
}

interface BacktestDataQualityPanelProps {
  validation: BacktestDataValidation;
  /** Período pedido no formulário (datas locais), usado para filtrar avisos de cobertura que não são lacunas. */
  requested: { startDate: Date; endDate: Date };
  onAccept: () => void;
  onCancel: () => void;
}

const QUALITY: Record<DataAvailability['dataQuality'], { label: string; variant: 'neutral' | 'warning' | 'negative' }> = {
  excellent: { label: 'Excelente', variant: 'neutral' },
  good: { label: 'Boa', variant: 'neutral' },
  fair: { label: 'Regular', variant: 'warning' },
  poor: { label: 'Ruim', variant: 'negative' },
};

// As datas vêm de colunas DATE (meia-noite UTC): formatadas em hora local cairiam no dia anterior
const toDate = (value: Date | string) => dateFromApi(value);

// O texto do backend traz a data em hora local (um dia antes); refeito com a mesma data exibida na tabela
function describeWarning(asset: DataAvailability, warning: string) {
  if (warning.startsWith('Dados disponíveis apenas a partir de')) {
    return `Dados disponíveis apenas a partir de ${formatDate(toDate(asset.availableFrom))}`;
  }
  if (warning.startsWith('Dados disponíveis apenas até')) {
    return `Dados disponíveis apenas até ${formatDate(toDate(asset.availableTo))}`;
  }
  return warning;
}

/** Revisão dos dados históricos antes de executar (aberta só quando há avisos ou dados insuficientes). */
export function BacktestDataQualityPanel({ validation, requested, onAccept, onCancel }: BacktestDataQualityPanelProps) {
  const adjustedStartDate = toDate(validation.adjustedStartDate);
  const adjustedEndDate = toDate(validation.adjustedEndDate);
  const periodMonths = monthsBetween(adjustedStartDate, adjustedEndDate);
  const assetsWithData = validation.assetsAvailability.filter(a => a.totalMonths > 0).length;
  const assetWarnings = validation.assetsAvailability.flatMap(asset => relevantAssetWarnings(asset, requested).map(warning => `${asset.ticker}: ${describeWarning(asset, warning)}`));
  const warnings = [...validation.globalWarnings, ...assetWarnings];

  const columns: DataTableColumn<DataAvailability>[] = [
    { key: 'ticker', header: 'Ativo', sticky: true, cell: row => <span className="font-medium text-foreground">{row.ticker}</span> },
    {
      key: 'period',
      header: 'Dados de',
      cell: row => (
        <span className="whitespace-nowrap tabular-nums">
          {formatDate(toDate(row.availableFrom))} – {formatDate(toDate(row.availableTo))}
        </span>
      ),
    },
    { key: 'totalMonths', header: 'Meses', align: 'right' },
    { key: 'missingMonths', header: 'Faltantes', align: 'right' },
    {
      key: 'completeness',
      header: 'Completude',
      align: 'right',
      cell: row => formatPct(row.totalMonths > 0 ? row.totalMonths / (row.totalMonths + row.missingMonths) : 0, { digits: 0 }),
    },
    {
      key: 'dataQuality',
      header: 'Qualidade',
      cell: row => <Badge variant={QUALITY[row.dataQuality].variant}>{QUALITY[row.dataQuality].label}</Badge>,
    },
  ];

  return (
    <Dialog open onOpenChange={open => !open && onCancel()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{validation.isValid ? 'Revise os dados antes de executar' : 'Dados insuficientes para o backtest'}</DialogTitle>
          <DialogDescription>
            {validation.isValid
              ? 'Encontramos avisos sobre o histórico dos ativos. Você pode continuar ou ajustar a carteira.'
              : 'Ajuste o período ou troque os ativos sem histórico suficiente.'}
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-surface p-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Período com dados</dt>
            <dd className="tabular-nums text-foreground">
              {formatDate(adjustedStartDate)} – {formatDate(adjustedEndDate)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Duração</dt>
            <dd className="tabular-nums text-foreground">{periodMonths} meses</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Ativos com dados</dt>
            <dd className="tabular-nums text-foreground">
              {assetsWithData} de {validation.assetsAvailability.length}
            </dd>
          </div>
        </dl>

        {warnings.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <AlertTriangle className="size-4 text-warning" strokeWidth={1.75} aria-hidden="true" />
              Avisos
            </p>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {warnings.map(warning => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        <DataTable
          columns={columns}
          rows={validation.assetsAvailability}
          getRowId={row => row.ticker}
          dense
          caption="Qualidade dos dados por ativo"
        />

        {validation.recommendations.length > 0 && (
          <ul className="space-y-1 text-sm text-muted-foreground">
            {validation.recommendations.map(recommendation => (
              <li key={recommendation}>{recommendation}</li>
            ))}
          </ul>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Ajustar carteira
          </Button>
          <Button onClick={onAccept} disabled={!validation.isValid}>
            Continuar simulação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
