'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, CheckCircle2 } from 'lucide-react';
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
          title: 'Informe um ticker',
          description: 'Digite pelo menos um ticker, como PETR4.',
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
            title: 'E-mail inválido',
            description: 'Confira o e-mail informado.',
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
        title: 'Monitoramento criado',
        description: `${data.success} ${data.success === 1 ? 'ativo adicionado' : 'ativos adicionados'} ao monitoramento.`,
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
        title: 'Não foi possível salvar',
        description: error instanceof Error ? error.message : 'Erro ao criar monitoramentos. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="tickers">Tickers</Label>
        <Textarea
          id="tickers"
          placeholder={'PETR4, VALE3, ITUB4\nou um por linha'}
          value={tickers}
          onChange={(e) => setTickers(e.target.value)}
          className="min-h-[96px] resize-none font-mono uppercase placeholder:normal-case placeholder:font-sans"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          disabled={isLoading}
          required
          aria-describedby="tickers-hint"
        />
        <p id="tickers-hint" className="text-xs text-muted-foreground">
          Separe por vírgula ou use uma linha para cada ticker.
        </p>
      </div>

      {!isLoggedIn && (
        <div className="space-y-1.5">
          <Label htmlFor="monitor-email">E-mail</Label>
          <Input
            id="monitor-email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            required
            aria-describedby="monitor-email-hint"
          />
          <p id="monitor-email-hint" className="text-xs text-muted-foreground">
            Os alertas chegam neste e-mail. Dá para cancelar com um clique em qualquer mensagem. Não compartilhamos seu e-mail.
          </p>
        </div>
      )}

      {success && results && (
        <div className="rounded-lg border border-border bg-positive-subtle p-4 text-sm" role="status">
          <p className="flex items-center gap-2 font-medium text-foreground">
            <CheckCircle2 className="size-4 text-positive" strokeWidth={1.75} aria-hidden="true" />
            <span className="tabular-nums">
              {results.success} {results.success === 1 ? 'empresa monitorada' : 'empresas monitoradas'}
            </span>
          </p>
          {results.failed > 0 && (
            <p className="mt-1 text-warning tabular-nums">
              {results.failed} {results.failed === 1 ? 'empresa não pôde' : 'empresas não puderam'} ser monitorada{results.failed === 1 ? '' : 's'}.
            </p>
          )}
          {results.invalid.length > 0 && (
            <p className="mt-1 text-muted-foreground">
              Tickers não encontrados: <span className="font-mono text-foreground">{results.invalid.join(', ')}</span>
            </p>
          )}
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isLoading || tickers.trim().length === 0}>
        {isLoading && <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />}
        {isLoading ? 'Salvando…' : isLoggedIn ? 'Monitorar estes ativos' : 'Começar a monitorar'}
      </Button>

      {!isLoggedIn && (
        <p className="text-center text-sm text-muted-foreground">
          Já tem conta?{' '}
          <Link href="/login?callbackUrl=/acompanhar-acoes-bolsa-de-valores" className="font-medium text-brand underline-offset-4 hover:underline">
            Entrar
          </Link>
        </p>
      )}
    </form>
  );
}
