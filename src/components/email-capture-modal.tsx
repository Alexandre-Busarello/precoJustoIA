'use client';

import { useState } from 'react';
import { Mail, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { useSession } from 'next-auth/react';

interface EmailCaptureModalProps {
  ticker: string;
  companyId?: number;
  companyName?: string;
  /** Controlado: o modal só abre quando o pai passa `open` (em resposta a uma ação do usuário). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const CONVERSION_SEND_TO = 'AW-17611977676/QWtnCODevdUbEMznhc5B';

type GtagWindow = Window & {
  gtag?: (...args: unknown[]) => void;
  dataLayer?: unknown[];
};

function fireConversionPixel() {
  if (typeof window === 'undefined') return;
  const w = window as GtagWindow;
  try {
    if (w.gtag) {
      w.gtag('event', 'conversion', { send_to: CONVERSION_SEND_TO, value: 1.0, currency: 'BRL' });
    } else if (Array.isArray(w.dataLayer)) {
      w.dataLayer.push({ event: 'conversion', send_to: CONVERSION_SEND_TO, value: 1.0, currency: 'BRL' });
    }
  } catch (pixelError) {
    console.error('Erro ao disparar pixel de conversão:', pixelError);
  }
}

/**
 * "Acompanhar {ticker}" por e-mail para visitantes anônimos.
 * Nunca abre sozinho: sem `open`, não renderiza nada visível. Logados não veem o modal.
 */
export function EmailCaptureModal({ ticker, open, onOpenChange }: EmailCaptureModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { data: session } = useSession();

  const isOpen = open ?? internalOpen;
  const setOpen = (value: boolean) => {
    if (onOpenChange) onOpenChange(value);
    else setInternalOpen(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Pixel antes de qualquer validação ou request, para não perder a conversão se o request falhar
    fireConversionPixel();

    const trimmed = email.trim();
    if (!trimmed) {
      setError('Informe seu e-mail');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Informe um e-mail válido');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/asset-subscriptions/by-ticker/${ticker}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar inscrição');
      }

      try {
        localStorage.setItem(`email-capture-submitted-${ticker}`, 'true');
      } catch {
        // localStorage indisponível: a inscrição já foi feita no servidor
      }

      setIsSuccess(true);
      toast({
        title: 'Inscrição recebida',
        description: 'Confirme pelo link que enviamos para o seu e-mail.',
      });
      setTimeout(() => setOpen(false), 3000);
    } catch (err) {
      console.error('Erro ao criar subscription:', err);
      setError(err instanceof Error ? err.message : 'Erro ao processar inscrição. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  if (session?.user) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Acompanhar {ticker}</DialogTitle>
          <DialogDescription>
            Receba um e-mail quando houver mudanças relevantes nos fundamentos ou no preço de {ticker}.
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="py-6 text-center">
            <CheckCircle className="mx-auto mb-3 size-8 text-positive" strokeWidth={1.75} />
            <p className="text-sm font-medium text-foreground">Inscrição recebida</p>
            <p className="mt-1 text-xs text-muted-foreground">Confirme pelo link que enviamos para o seu e-mail.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email-capture">Seu e-mail</Label>
              <div className="relative">
                <Mail
                  className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
                <Input
                  id="email-capture"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="pl-9"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'email-capture-error' : undefined}
                  required
                />
              </div>
              {error && (
                <p id="email-capture-error" className="text-xs text-negative">
                  {error}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isLoading || !email.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Enviando
                </>
              ) : (
                'Acompanhar'
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Você recebe e-mails apenas sobre {ticker} e pode cancelar quando quiser.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default EmailCaptureModal;
