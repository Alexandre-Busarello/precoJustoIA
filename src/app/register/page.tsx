"use client"

import { useState, Suspense, useEffect } from "react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { AlfaBanner } from "@/components/alfa-banner"
import { AlfaWaitlistForm } from "@/components/alfa-waitlist-form"
import { Badge } from "@/components/ui/badge"
import { Gift, Sparkles, CheckCircle } from "lucide-react"
import { useTrialAvailable } from "@/hooks/use-trial-available"

function RegisterForm() {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [canRegister, setCanRegister] = useState(true)
  const [isCheckingLimit, setIsCheckingLimit] = useState(true)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAvailable: isTrialAvailable } = useTrialAvailable()
  
  // Obter callbackUrl da URL ou usar dashboard como padrão
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  // Obter acquisition da URL para rastrear origem do cadastro
  const acquisition = searchParams.get('acquisition') || undefined
  // 🔒 SEGURANÇA: Removido isEarlyAdopter da URL - não deve ser controlado pelo cliente
  // Early Adopters são marcados apenas via webhooks após pagamento confirmado

  useEffect(() => {
    checkRegistrationLimit()
  }, [])

  const checkRegistrationLimit = async () => {
    try {
      // 🔒 SEGURANÇA: Sempre verificar como usuário normal (não early adopter)
      const response = await fetch(`/api/alfa/register-check?earlyAdopter=false`)
      if (response.ok) {
        const data = await response.json()
        setCanRegister(data.canRegister)
      }
    } catch (error) {
      console.error('Erro ao verificar limite de registro:', error)
    } finally {
      setIsCheckingLimit(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    if (password !== confirmPassword) {
      setError("As senhas não coincidem")
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres")
      setIsLoading(false)
      return
    }

    try {
      // 🔒 SEGURANÇA: Não enviar isEarlyAdopter - será definido apenas via webhooks
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
          acquisition, // Rastrear origem do cadastro
          // isEarlyAdopter removido - será definido apenas via webhooks após pagamento
        }),
      })

      if (response.ok) {
        // Login automático após registro
        const result = await signIn("credentials", {
          email,
          password,
          redirect: false,
        })

        if (result?.error) {
          setError("Erro ao fazer login após registro")
        } else {
          // Redirecionar para callbackUrl após registro bem-sucedido
          router.push(callbackUrl)
        }
      } else {
        const data = await response.json()
        setError(data.message || "Erro ao criar conta")
      }
    } catch {
      setError("Erro ao criar conta")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    await signIn("google", { callbackUrl })
  }

  if (isCheckingLimit) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Verificando disponibilidade...</p>
        </div>
      </div>
    )
  }

  if (!canRegister) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-full max-w-2xl px-4">
          <AlfaBanner variant="landing" className="mb-6 rounded-lg" />
          <AlfaWaitlistForm />
          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Já tem uma conta?{" "}
              <Link 
                href={`/login${callbackUrl !== '/dashboard' ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ''}`}
                className="underline underline-offset-4 hover:text-primary"
              >
                Faça login
              </Link>
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md px-4">
        <AlfaBanner variant="landing" className="mb-6 rounded-lg" />
        <Card className="w-full">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">
              Criar Conta
            </CardTitle>
            <CardDescription className="text-center">
              Crie sua conta para começar
            </CardDescription>
            {/* Trial Premium Banner - Só mostra se trial estiver disponível */}
            {isTrialAvailable && (
            <div className="mt-4 p-4 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20 border border-violet-200 dark:border-violet-800 rounded-lg">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-lg flex items-center justify-center shrink-0">
                  <Gift className="w-5 h-5 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="bg-gradient-to-r from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 border border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300 text-xs">
                      <Sparkles className="w-3 h-3 mr-1" />
                      Trial Premium
                    </Badge>
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                    <strong>7 dias grátis</strong> de acesso Premium completo! Experimente todos os recursos avançados sem compromisso.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-violet-600" />
                      <span>Ativação automática</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-violet-600" />
                      <span>Sem cartão de crédito</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-violet-600" />
                      <span>Cancele quando quiser</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            )}
          </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                type="text"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Confirme sua senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            {error && (
              <div className="text-sm text-red-600 text-center">{error}</div>
            )}
            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? "Criando conta..." : "Criar Conta"}
            </Button>
          </form>

          {/* <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Ou continue com
              </span>
            </div>
          </div>

          <Button
            variant="outline"
            type="button"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
          >
            Google
          </Button> */}
        </CardContent>
        <CardFooter>
          <p className="text-center text-sm text-muted-foreground w-full">
            Já tem uma conta?{" "}
            <Link 
              href={`/login${callbackUrl !== '/dashboard' ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ''}`}
              className="underline underline-offset-4 hover:text-primary"
            >
              Faça login
            </Link>
          </p>
        </CardFooter>
        </Card>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">Carregando...</div>}>
      <RegisterForm />
    </Suspense>
  )
}
