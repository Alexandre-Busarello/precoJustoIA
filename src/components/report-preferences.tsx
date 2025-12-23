'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, FileText, TrendingUp, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ReportPreferences {
  MONTHLY_OVERVIEW?: boolean;
  FUNDAMENTAL_CHANGE?: boolean;
  PRICE_VARIATION?: boolean;
}

interface ReportPreferencesProps {
  initialPreferences?: ReportPreferences | null;
}

export default function ReportPreferences({ initialPreferences }: ReportPreferencesProps) {
  const [preferences, setPreferences] = useState<ReportPreferences>({
    MONTHLY_OVERVIEW: true,
    FUNDAMENTAL_CHANGE: true,
    PRICE_VARIATION: true,
    ...initialPreferences,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { toast } = useToast();

  // Verificar se há mudanças
  useEffect(() => {
    const currentPrefs = {
      MONTHLY_OVERVIEW: true,
      FUNDAMENTAL_CHANGE: true,
      PRICE_VARIATION: true,
      ...initialPreferences,
    };
    
    const changed = JSON.stringify(preferences) !== JSON.stringify(currentPrefs);
    setHasChanges(changed);
  }, [preferences, initialPreferences]);

  const handleToggle = async (reportType: keyof ReportPreferences) => {
    const newPreferences = {
      ...preferences,
      [reportType]: !preferences[reportType],
    };
    setPreferences(newPreferences);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/user/report-preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(preferences),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Erro ao salvar preferências');
      }

      toast({
        title: 'Preferências salvas',
        description: 'Suas preferências de relatórios foram atualizadas com sucesso.',
      });
      setHasChanges(false);
    } catch (error) {
      console.error('Erro ao salvar preferências:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao salvar preferências. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const reportTypes = [
    {
      key: 'MONTHLY_OVERVIEW' as const,
      label: 'Relatório Mensal',
      description: 'Receba um relatório mensal com análise completa dos fundamentos da empresa.',
      icon: FileText,
    },
    {
      key: 'FUNDAMENTAL_CHANGE' as const,
      label: 'Mudança de Score/Fundamentos',
      description: 'Receba alertas quando houver mudanças significativas no score ou nos fundamentos da empresa.',
      icon: TrendingUp,
    },
    {
      key: 'PRICE_VARIATION' as const,
      label: 'Variação de Preço',
      description: 'Receba alertas quando houver quedas significativas de preço com análise da causa.',
      icon: AlertTriangle,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Preferências de Relatórios</CardTitle>
        <CardDescription>
          Escolha quais tipos de relatórios você deseja receber por email
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {reportTypes.map((reportType) => {
          const Icon = reportType.icon;
          const isEnabled = preferences[reportType.key] ?? true;

          return (
            <div
              key={reportType.key}
              className="flex items-start justify-between gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="p-2 rounded-md bg-primary/10 shrink-0">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <Label
                    htmlFor={reportType.key}
                    className="text-base font-semibold cursor-pointer"
                  >
                    {reportType.label}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    {reportType.description}
                  </p>
                </div>
              </div>
              <Switch
                id={reportType.key}
                checked={isEnabled}
                onCheckedChange={() => handleToggle(reportType.key)}
                disabled={isLoading}
              />
            </div>
          );
        })}

        {hasChanges && (
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => {
                setPreferences({
                  MONTHLY_OVERVIEW: true,
                  FUNDAMENTAL_CHANGE: true,
                  PRICE_VARIATION: true,
                  ...initialPreferences,
                });
                setHasChanges(false);
              }}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar Preferências'
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

