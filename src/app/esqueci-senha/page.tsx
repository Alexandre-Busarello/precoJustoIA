'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthShell } from '../login/auth-ui'

const backToLogin = (
  <Link href="/login" className="inline-flex min-h-11 items-center font-medium text-brand underline-offset-4 hover:underline sm:min-h-0">
    Voltar para o login
  </Link>
)

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!email.trim()) {
      toast.error('Digite seu e-mail')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      const data = await response.json()

      if (data.success) {
        setIsSuccess(true)
      } else {
        toast.error(data.message || 'Não foi possível enviar o e-mail')
      }
    } catch (error) {
      console.error('Erro ao solicitar reset:', error)
      toast.error('Erro interno. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  if (isSuccess) {
    return (
      <AuthShell title="Confira seu e-mail" description="Enviamos as instruções, se o endereço estiver cadastrado." footer={backToLogin}>
        <p className="text-sm text-foreground">
          Se <span className="font-medium">{email}</span> tiver uma conta, você vai receber um link para criar uma nova senha. O
          link vale por 1 hora.
        </p>
        <p className="text-sm text-muted-foreground">Não chegou? Veja a pasta de spam e aguarde alguns minutos.</p>
        <Button
          onClick={() => {
            setIsSuccess(false)
            setEmail('')
          }}
          variant="outline"
          className="w-full"
        >
          Usar outro e-mail
        </Button>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Redefinir senha"
      description="Informe seu e-mail e enviaremos um link válido por 1 hora."
      footer={backToLogin}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            inputMode="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            autoComplete="email"
            autoFocus
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading && <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />}
          {isLoading ? 'Enviando…' : 'Enviar link'}
        </Button>
      </form>
    </AuthShell>
  )
}
