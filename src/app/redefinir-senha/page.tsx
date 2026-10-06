'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Check, Loader2, Minus } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { AuthFallback, AuthShell, PasswordInput } from '../login/auth-ui'

function ResetPasswordForm() {
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isValidating, setIsValidating] = useState(true)
  const [isValidToken, setIsValidToken] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [maskedEmail, setMaskedEmail] = useState('')
  const [error, setError] = useState('')

  const searchParams = useSearchParams()

  useEffect(() => {
    const tokenParam = searchParams.get('token')
    if (!tokenParam) {
      setError('Link sem o código de redefinição.')
      setIsValidating(false)
      return
    }

    setToken(tokenParam)
    validateToken(tokenParam)
  }, [searchParams])

  const validateToken = async (tokenToValidate: string) => {
    try {
      const response = await fetch(`/api/auth/reset-password?token=${tokenToValidate}`)
      const data = await response.json()

      if (data.success) {
        setIsValidToken(true)
        setMaskedEmail(data.email || '')
      } else {
        setError(data.message || 'Token inválido')
      }
    } catch (error) {
      console.error('Erro ao validar token:', error)
      setError('Erro ao validar token')
    } finally {
      setIsValidating(false)
    }
  }

  const validatePassword = (pwd: string) => {
    if (pwd.length < 8) {
      return 'A senha deve ter pelo menos 8 caracteres'
    }
    if (!/(?=.*[a-z])/.test(pwd)) {
      return 'A senha deve conter pelo menos uma letra minúscula'
    }
    if (!/(?=.*[A-Z])/.test(pwd)) {
      return 'A senha deve conter pelo menos uma letra maiúscula'
    }
    if (!/(?=.*\d)/.test(pwd)) {
      return 'A senha deve conter pelo menos um número'
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validações
    const passwordError = validatePassword(password)
    if (passwordError) {
      toast.error(passwordError)
      return
    }

    if (password !== confirmPassword) {
      toast.error('As senhas não coincidem')
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      })

      const data = await response.json()

      if (data.success) {
        setIsSuccess(true)
        toast.success('Senha alterada')
      } else {
        toast.error(data.message || 'Erro ao redefinir senha')
        if (data.message?.includes('inválido') || data.message?.includes('expirado')) {
          setError(data.message)
          setIsValidToken(false)
        }
      }
    } catch (error) {
      console.error('Erro ao redefinir senha:', error)
      toast.error('Erro interno. Tente novamente.')
    } finally {
      setIsLoading(false)
    }
  }

  const backToLogin = (
    <Link href="/login" className="inline-flex min-h-11 items-center font-medium text-brand underline-offset-4 hover:underline sm:min-h-0">
      Voltar para o login
    </Link>
  )

  if (isValidating) {
    return (
      <AuthShell title="Nova senha" description="Validando o link…">
        <div className="flex justify-center py-6">
          <Loader2 className="size-5 animate-spin text-muted-foreground" strokeWidth={1.75} aria-label="Carregando" />
        </div>
      </AuthShell>
    )
  }

  if (isSuccess) {
    return (
      <AuthShell title="Senha alterada" description="Agora você já pode entrar com a nova senha.">
        <Button asChild className="w-full">
          <Link href="/login">Entrar</Link>
        </Button>
      </AuthShell>
    )
  }

  if (!isValidToken || error) {
    return (
      <AuthShell title="Link inválido" description={error || 'Este link de redefinição não é válido.'} footer={backToLogin}>
        <p className="text-sm text-muted-foreground">O link pode ter expirado ou já ter sido usado.</p>
        <Button asChild className="w-full">
          <Link href="/esqueci-senha">Pedir novo link</Link>
        </Button>
      </AuthShell>
    )
  }

  const requirements = [
    { label: '8 caracteres ou mais', ok: password.length >= 8 },
    { label: 'Uma letra minúscula', ok: /[a-z]/.test(password) },
    { label: 'Uma letra maiúscula', ok: /[A-Z]/.test(password) },
    { label: 'Um número', ok: /\d/.test(password) },
  ]

  return (
    <AuthShell title="Nova senha" description={maskedEmail ? `Para a conta ${maskedEmail}` : undefined} footer={backToLogin}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="password">Nova senha</Label>
          <PasswordInput
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            autoComplete="new-password"
            aria-describedby="password-requirements"
            required
          />
          <ul id="password-requirements" className="grid grid-cols-2 gap-x-3 gap-y-1 pt-1 text-xs">
            {requirements.map((item) => (
              <li key={item.label} className={cn('flex items-center gap-1.5', item.ok ? 'text-foreground' : 'text-muted-foreground')}>
                {item.ok ? (
                  <Check className="size-3.5 text-positive" strokeWidth={1.75} aria-hidden="true" />
                ) : (
                  <Minus className="size-3.5" strokeWidth={1.75} aria-hidden="true" />
                )}
                {item.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
          <PasswordInput
            id="confirmPassword"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={isLoading}
            autoComplete="new-password"
            required
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading || !password || !confirmPassword}>
          {isLoading && <Loader2 className="size-4 animate-spin" strokeWidth={1.75} aria-hidden="true" />}
          {isLoading ? 'Salvando…' : 'Salvar nova senha'}
        </Button>
      </form>
    </AuthShell>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <ResetPasswordForm />
    </Suspense>
  )
}
