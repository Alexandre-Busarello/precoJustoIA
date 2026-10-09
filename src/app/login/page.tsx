"use client"

import { useState, Suspense, useEffect } from "react"
import { signIn, useSession } from "next-auth/react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AuthFallback, AuthShell, GoogleButton, OrDivider, PasswordInput } from "./auth-ui"

/**
 * Destino depois do login, sempre neste site: caminhos internos passam; URLs absolutas (o NextAuth manda a URL
 * completa) viram só o caminho, o que impede redirecionar para outro domínio.
 */
function safeCallbackUrl(value: string | null): string {
  if (!value) return "/dashboard"
  if (value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")) return value
  try {
    const url = new URL(value)
    if (url.protocol === "http:" || url.protocol === "https:") return `${url.pathname}${url.search}${url.hash}`
  } catch {
    // valor inválido: usa o padrão
  }
  return "/dashboard"
}

function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const { status } = useSession()

  const callbackUrl = safeCallbackUrl(searchParams.get("callbackUrl"))
  const oauthError = searchParams.get("error")
  const registerHref = `/register${callbackUrl !== "/dashboard" ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`

  useEffect(() => {
    if (oauthError === "OAuthAccountNotLinked") {
      toast.error("Esta conta Google já está vinculada a outra conta. Entre com e-mail e senha primeiro para vincular o Google.")
    }
  }, [oauthError])

  // Já está logado: segue para o destino pedido (ou o dashboard) em vez de mostrar o formulário
  useEffect(() => {
    if (status === "authenticated") router.replace(callbackUrl)
  }, [status, callbackUrl, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        toast.error("E-mail ou senha incorretos")
      } else {
        router.push(callbackUrl)
      }
    } catch {
      toast.error("Não foi possível entrar. Tente novamente.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    await signIn("google", { callbackUrl })
  }

  if (status === "authenticated") return <AuthFallback />

  return (
    <AuthShell
      title="Entrar"
      description="Acesse sua conta do Preço Justo AI."
      footer={
        <>
          Não tem conta?{" "}
          <Link href={registerHref} className="inline-flex min-h-11 items-center font-medium text-brand underline-offset-4 hover:underline sm:min-h-0">
            Criar conta
          </Link>
        </>
      }
    >
      <GoogleButton onClick={handleGoogleSignIn} disabled={isLoading} />
      <OrDivider label="ou com e-mail" />
      <form onSubmit={handleSubmit} className="space-y-4">
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
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Senha</Label>
            <Link href="/esqueci-senha" className="text-sm text-brand underline-offset-4 hover:underline">
              Esqueceu a senha?
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </AuthShell>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthFallback />}>
      <LoginForm />
    </Suspense>
  )
}
