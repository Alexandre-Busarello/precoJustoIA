'use client';

import { useState, useEffect } from 'react';
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
  companyId: number;
  companyName?: string;
}

export function EmailCaptureModal({ ticker }: EmailCaptureModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { data: session } = useSession();

  // Não mostrar para usuários logados
  useEffect(() => {
    if (session?.user) {
      return;
    }

    // Verificar se já foi submetido (localStorage)
    const hasSubmitted = localStorage.getItem(`email-capture-submitted-${ticker}`);
    if (hasSubmitted === 'true') {
      return;
    }

    // Mostrar modal após 6 segundos
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 6000);

    return () => clearTimeout(timer);
  }, [session, ticker]);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Disparar pixel de conversão PRIMEIRO (antes de qualquer validação ou request)
    // Para não perder o pixel mesmo se o request falhar
    if (typeof window !== 'undefined') {
      try {
        if ((window as any).gtag) {
          (window as any).gtag('event', 'conversion', {
            'send_to': 'AW-17611977676/QWtnCODevdUbEMznhc5B',
            'value': 1.0,
            'currency': 'BRL'
          });
        } else if (Array.isArray((window as any).dataLayer)) {
          // Fallback para dataLayer se gtag não estiver disponível
          (window as any).dataLayer.push({
            event: 'conversion',
            send_to: 'AW-17611977676/QWtnCODevdUbEMznhc5B',
            value: 1.0,
            currency: 'BRL'
          });
        }
      } catch (pixelError) {
        console.error('Erro ao disparar pixel de conversão:', pixelError);
      }
    }

    if (!email.trim()) {
      setError('Por favor, insira seu email');
      return;
    }

    if (!validateEmail(email)) {
      setError('Por favor, insira um email válido');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/asset-subscriptions/by-ticker/${ticker}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao processar inscrição');
      }

      // Marcar como submetido no localStorage
      localStorage.setItem(`email-capture-submitted-${ticker}`, 'true');

      setIsSuccess(true);
      setIsLoading(false);

      toast({
        title: 'Inscrição confirmada!',
        description: 'Verifique seu email para confirmar sua inscrição.',
      });

      // Fechar modal após 3 segundos
      setTimeout(() => {
        setIsOpen(false);
      }, 3000);
    } catch (error: any) {
      console.error('Erro ao criar subscription:', error);
      setError(error.message || 'Erro ao processar inscrição. Tente novamente.');
      setIsLoading(false);
    }
  };


  // Não renderizar se usuário estiver logado
  if (session?.user) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">
            Avise-me quando {ticker} estiver barata
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-2">
            Receba notificações por email quando houver mudanças significativas nos fundamentos de{' '}
            <strong className="text-foreground">{ticker}</strong>.
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="py-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-sm font-medium text-foreground mb-2">
              Inscrição confirmada!
            </p>
            <p className="text-xs text-muted-foreground">
              Verifique seu email para confirmar sua inscrição.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Seu email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  className="pl-10"
                  required
                />
              </div>
              {error && (
                <p className="text-xs text-red-500">{error}</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading || !email.trim()}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Avise-me
                </>
              )}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Ao se inscrever, você concorda em receber emails sobre {ticker}.
              Você pode cancelar a qualquer momento.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

