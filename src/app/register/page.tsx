"use client"

import { useState, Suspense } from "react"
import { signIn } from "next-auth/react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Gift, Sparkles, CheckCircle, Eye, EyeOff } from "lucide-react"
import { useTrialAvailable } from "@/hooks/use-trial-available"

function RegisterForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [website, setWebsite] = useState("") // 🍯 HONEYPOT: Campo para detectar bots
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAvailable: isTrialAvailable } = useTrialAvailable()
  
  // Obter callbackUrl da URL ou usar dashboard como padrão
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'
  // Obter acquisition da URL para rastrear origem do cadastro
  const acquisition = searchParams.get('acquisition') || undefined
  // 🔒 SEGURANÇA: Removido isEarlyAdopter da URL - não deve ser controlado pelo cliente
  // Early Adopters são marcados apenas via webhooks após pagamento confirmado

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    // 🍯 HONEYPOT: Verificação frontend (opcional, mas economiza requisição)
    if (website) {
      setIsLoading(false)
      return // Simplesmente para a execução sem alertar o bot
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
          email,
          password,
          website, // 🍯 HONEYPOT: Campo para detectar bots no backend
          acquisition, // Rastrear origem do cadastro
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
          setError("Erro ao fazer login após registro")
        } else {
          // Redirecionar para página de verificação de email (usuário já está logado)
          // Adicionar ?new_user=true para disparar pixel de conversão imediatamente
          // (antes da validação do email para evitar quebra de sessão)
          router.push('/verificar-email?new_user=true')
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="w-full max-w-md px-4">
        <Card className="w-full">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">
              Crie sua conta grátis
            </CardTitle>
            <CardDescription className="text-center">
              Comece a investir com inteligência
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
                    <strong>1 dia grátis</strong> de acesso Premium completo! Experimente todos os recursos avançados sem compromisso.
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
          {/* Botão Google Primeiro - Gigante */}
          <Button
            variant="outline"
            type="button"
            size="lg"
            className="w-full h-12 text-base font-medium"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
          >
            <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continuar com Google
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                ou use seu e-mail
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 relative">
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
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-12"
                  required
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isLoading}
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>
            
            {/* 🍯 HONEYPOT: Campo invisível para detectar bots */}
            {/* Usa classe CSS sr-field (screen reader field) que parece legítima */}
            <div className="sr-field">
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

            {error && (
              <div className="text-sm text-red-600 text-center">{error}</div>
            )}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isLoading}
            >
              {isLoading ? "Criando conta..." : "Cadastrar"}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Ao criar sua conta, você concorda com nossos{" "}
              <Link href="/termos-de-uso" target="_blank" className="underline hover:text-primary">
                Termos de Uso
              </Link>{" "}
              e{" "}
              <Link href="/lgpd" target="_blank" className="underline hover:text-primary">
                Política de Privacidade
              </Link>
              .
            </p>
          </form>
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
