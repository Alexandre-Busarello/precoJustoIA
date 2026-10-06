"use client"

import { useState, Suspense } from "react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useTrialAvailable } from "@/hooks/use-trial-available"
import { toast } from "sonner"
import { AuthFallback, AuthShell, GoogleButton, OrDivider, PasswordInput } from "../login/auth-ui"

function RegisterForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [website, setWebsite] = useState("") // Honeypot: campo para detectar bots
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAvailable: isTrialAvailable, isLoading: isTrialLoading } = useTrialAvailable()
  
  // Obter callbackUrl da URL ou usar dashboard como padrão
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  const loginHref = `/login${callbackUrl !== '/dashboard' ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ''}`
  // Obter returnUrl da URL (para redirecionar após cadastro/verificação)
  const returnUrl = searchParams.get('returnUrl') || null
  // Obter acquisition da URL para rastrear origem do cadastro
  const acquisition = searchParams.get('acquisition') || undefined
  // Segurança: Removido isEarlyAdopter da URL - não deve ser controlado pelo cliente
  // Early Adopters são marcados apenas via webhooks após pagamento confirmado

  function readPartnerIdFromStorage(): string | null {
    try {
      return localStorage.getItem('partner_id')
    } catch {
      return null
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    // Armazenar returnUrl em cookie para uso após verificação de email
    if (returnUrl) {
      document.cookie = `returnUrl=${encodeURIComponent(returnUrl)}; path=/; max-age=3600; SameSite=Lax`
    }

    // Honeypot: Verificação frontend (opcional, mas economiza requisição)
    if (website) {
      setIsLoading(false)
      return // Simplesmente para a execução sem alertar o bot
    }

    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres")
      setIsLoading(false)
      return
    }

    try {
      // Segurança: Não enviar isEarlyAdopter - será definido apenas via webhooks
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
          website, // Honeypot: Campo para detectar bots no backend
          acquisition, // Rastrear origem do cadastro
          partnerId: readPartnerIdFromStorage(), // Atribuição de parceiro (imutável após salvo)
          // name removido - será coletado no onboarding ou perfil
          // isEarlyAdopter removido - será definido apenas via webhooks após pagamento
        }),
      })

      if (response.ok) {
        await response.json()
        
        // Fazer login automático após registro (mesmo sem verificar email)
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        })

        if (result?.error) {
          toast.error("Conta criada, mas houve um erro ao fazer login. Tente entrar manualmente.")
        } else {
          // Redirecionar para página de verificação de email (usuário já está logado)
          // Adicionar ?new_user=true para disparar pixel de conversão imediatamente
          // (antes da validação do email para evitar quebra de sessão)
          // Preservar returnUrl se fornecido
          const verifyEmailUrl = returnUrl 
            ? `/verificar-email?new_user=true&returnUrl=${encodeURIComponent(returnUrl)}`
            : '/verificar-email?new_user=true'
          router.push(verifyEmailUrl)
        }
      } else {
        const data = await response.json()
        toast.error(data.message || "Erro ao criar conta")
      }
    } catch {
      toast.error("Erro ao criar conta. Tente novamente.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    // Armazenar returnUrl em cookie para uso após OAuth
    if (returnUrl) {
      document.cookie = `returnUrl=${encodeURIComponent(returnUrl)}; path=/; max-age=3600; SameSite=Lax`
    }
    // Para OAuth, usar returnUrl se fornecido, senão usar callbackUrl padrão
    const oauthCallbackUrl = returnUrl || callbackUrl
    await signIn("google", { callbackUrl: oauthCallbackUrl })
  }

  return (
    <AuthShell
      title="Criar conta"
      description={isTrialLoading ? "\u00a0" : isTrialAvailable ? "Inclui 1 dia de Premium grátis. Sem cartão." : "Grátis para começar."}
      footer={
        <>
          Já tem conta?{" "}
          <Link href={loginHref} className="inline-flex min-h-11 items-center font-medium text-brand underline-offset-4 hover:underline sm:min-h-0">
            Entrar
          </Link>
        </>
      }
    >
      <GoogleButton onClick={handleGoogleSignIn} disabled={isLoading} />
      <OrDivider label="ou com e-mail" />
      <form onSubmit={handleSubmit} className="relative space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="seu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Senha</Label>
          <PasswordInput
            id="password"
            autoComplete="new-password"
            placeholder="Mínimo de 6 caracteres"
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {/* Honeypot: campo fora da tela para detectar bots (classe sr-field em globals.css). */}
        <div className="sr-field" aria-hidden="true">
          <Label htmlFor="website">Website</Label>
          <Input
            type="text"
            name="website"
            id="website"
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </div>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Criando conta…" : "Criar conta"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Ao criar a conta, você concorda com os{" "}
          <Link href="/termos-de-uso" target="_blank" className="underline underline-offset-4 hover:text-foreground">
            Termos de uso
          </Link>{" "}
          e a{" "}
          <Link href="/lgpd" target="_blank" className="underline underline-offset-4 hover:text-foreground">
            Política de privacidade
          </Link>
          .
        </p>
      </form>
    </AuthShell>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <RegisterForm />
    </Suspense>
  )
}
