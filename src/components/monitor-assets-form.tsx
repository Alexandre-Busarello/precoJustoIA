'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, Mail, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useEngagementPixel } from '@/hooks/use-engagement-pixel';

interface MonitorAssetsFormProps {
  isLoggedIn: boolean;
}

export default function MonitorAssetsForm({ isLoggedIn }: MonitorAssetsFormProps) {
  const [tickers, setTickers] = useState('');
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [results, setResults] = useState<{
    success: number;
    failed: number;
    invalid: string[];
  } | null>(null);
  const { toast } = useToast();
  const router = useRouter();
  const { trackEngagement } = useEngagementPixel();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setSuccess(false);
    setResults(null);

    try {
      // Parse tickers (separados por vírgula ou linha)
      const tickerList = tickers
        .split(/[,\n]/)
        .map(t => t.trim().toUpperCase())
        .filter(t => t.length > 0);

      if (tickerList.length === 0) {
        toast({
          title: 'Erro',
          description: 'Por favor, informe pelo menos um ticker.',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      // Validar email se não estiver logado
      if (!isLoggedIn) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
          toast({
            title: 'Erro',
            description: 'Por favor, informe um email válido.',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }
      }

      // Chamar API bulk
      const response = await fetch('/api/monitor-assets/bulk', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tickers: tickerList,
          email: isLoggedIn ? undefined : email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao criar monitoramentos');
      }

      setSuccess(true);
      setResults(data);

      // Disparar pixel de conversão para usuários deslogados
      if (!isLoggedIn && data.success > 0) {
        trackEngagement();
      }

      // Limpar formulário
      setTickers('');
      if (!isLoggedIn) {
        setEmail('');
      }

      toast({
        title: 'Sucesso!',
        description: `${data.success} monitoramento(s) criado(s) com sucesso.`,
      });

      // Se usuário logado, redirecionar para página de subscriptions após 2 segundos
      if (isLoggedIn && data.success > 0) {
        setTimeout(() => {
          router.push('/dashboard/subscriptions');
        }, 2000);
      }
    } catch (error) {
      console.error('Erro ao criar monitoramentos:', error);
      toast({
        title: 'Erro',
        description: error instanceof Error ? error.message : 'Erro ao criar monitoramentos. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Campo de Tickers */}
      <div className="space-y-2">
        <Label htmlFor="tickers" className="text-base font-semibold">
          Tickers das Empresas
        </Label>
        <Textarea
          id="tickers"
          placeholder="Ex: PETR4, VALE3, ITUB4&#10;Ou um por linha"
          value={tickers}
          onChange={(e) => setTickers(e.target.value)}
          className="min-h-[100px] resize-none"
          disabled={isLoading}
          required
        />
        <p className="text-sm text-muted-foreground">
          Informe os tickers separados por vírgula ou um por linha. Exemplo: PETR4, VALE3, ITUB4
        </p>
      </div>

      {/* Campo de Email (apenas se não estiver logado) */}
      {!isLoggedIn && (
        <div className="space-y-2">
          <Label htmlFor="email" className="text-base font-semibold">
            Seu Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10"
              disabled={isLoading}
              required
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Você receberá alertas por email quando houver mudanças nas empresas monitoradas.
            Pode cancelar a qualquer momento.
          </p>
        </div>
      )}

      {/* Resultados */}
      {success && results && (
        <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h4 className="font-semibold text-green-900 dark:text-green-100 mb-2">
                Monitoramentos Criados com Sucesso!
              </h4>
              <div className="space-y-1 text-sm text-green-800 dark:text-green-200">
                <p>✅ {results.success} empresa(s) monitorada(s) com sucesso</p>
                {results.failed > 0 && (
                  <p className="text-orange-700 dark:text-orange-300">
                    ⚠️ {results.failed} empresa(s) não puderam ser monitoradas
                  </p>
                )}
                {results.invalid.length > 0 && (
                  <div>
                    <p className="font-semibold mb-1">Tickers inválidos:</p>
                    <p className="font-mono">{results.invalid.join(', ')}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Botão de Submit */}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={isLoading || tickers.trim().length === 0}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Criando Monitoramentos...
          </>
        ) : (
          <>
            <TrendingUp className="h-4 w-4 mr-2" />
            {isLoggedIn ? 'Criar Monitoramentos' : 'Começar a Monitorar'}
          </>
        )}
      </Button>

      {/* Informações adicionais */}
      <div className="text-center text-sm text-muted-foreground space-y-1">
        <p>🔒 Seus dados estão seguros. Não compartilhamos seu email.</p>
        {!isLoggedIn && (
          <p>
            Já tem uma conta?{' '}
            <Button
              variant="link"
              className="p-0 h-auto font-semibold"
              onClick={() => router.push('/login')}
            >
              Faça login
            </Button>
          </p>
        )}
      </div>
    </form>
  );
}

