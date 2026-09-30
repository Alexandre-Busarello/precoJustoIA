'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

interface ReportPreferences {
  MONTHLY_OVERVIEW?: boolean;
  FUNDAMENTAL_CHANGE?: boolean;
  PRICE_VARIATION?: boolean;
}

interface ReportPreferencesProps {
  initialPreferences?: ReportPreferences | null;
}

type ReportKey = keyof ReportPreferences;

const REPORT_TYPES: Array<{ key: ReportKey; label: string; description: string }> = [
  {
    key: 'PRICE_VARIATION',
    label: 'Queda relevante de preço',
    description: 'Aviso quando a cotação cai de forma significativa, com um resumo das possíveis causas.',
  },
  {
    key: 'FUNDAMENTAL_CHANGE',
    label: 'Mudança de score ou fundamentos',
    description: 'Aviso quando o score geral ou os fundamentos da empresa mudam de forma relevante.',
  },
  {
    key: 'MONTHLY_OVERVIEW',
    label: 'Relatório mensal',
    description: 'Um resumo por mês dos fundamentos de cada ativo acompanhado.',
  },
];

function withDefaults(prefs?: ReportPreferences | null): Required<ReportPreferences> {
  return { MONTHLY_OVERVIEW: true, FUNDAMENTAL_CHANGE: true, PRICE_VARIATION: true, ...prefs };
}

export default function ReportPreferences({ initialPreferences }: ReportPreferencesProps) {
  const { toast } = useToast();
  const [saved, setSaved] = useState(() => withDefaults(initialPreferences));
  const [preferences, setPreferences] = useState(saved);
  const [isSaving, setIsSaving] = useState(false);
  const hasChanges = REPORT_TYPES.some(({ key }) => preferences[key] !== saved[key]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/user/report-preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao salvar preferências');
      }
      setSaved(preferences);
      toast({ title: 'Preferências salvas', description: 'Os próximos e-mails seguirão estas escolhas.' });
    } catch (error) {
      console.error('Erro ao salvar preferências:', error);
      toast({
        title: 'Não foi possível salvar',
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section aria-labelledby="report-preferences" className="space-y-3">
      <div className="space-y-1">
        <h2 id="report-preferences" className="text-lg font-semibold tracking-tight text-foreground">
          O que você recebe por e-mail
        </h2>
        <p className="text-sm text-muted-foreground">Vale para todos os ativos da lista acima.</p>
      </div>
      <ul className="divide-y divide-border rounded-lg border border-border bg-card">
        {REPORT_TYPES.map((type) => (
          <li key={type.key} className="flex items-start justify-between gap-4 px-4 py-3">
            <div className="min-w-0 space-y-0.5">
              <Label htmlFor={`report-${type.key}`} className="cursor-pointer text-sm font-medium text-foreground">
                {type.label}
              </Label>
              <p className="text-sm text-muted-foreground">{type.description}</p>
            </div>
            <Switch
              id={`report-${type.key}`}
              checked={preferences[type.key]}
              onCheckedChange={(checked) => setPreferences((prev) => ({ ...prev, [type.key]: checked }))}
              disabled={isSaving}
              className="mt-0.5"
            />
          </li>
        ))}
      </ul>
      {hasChanges && (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setPreferences(saved)} disabled={isSaving}>
            Descartar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {isSaving ? 'Salvando' : 'Salvar preferências'}
          </Button>
        </div>
      )}
    </section>
  );
}
