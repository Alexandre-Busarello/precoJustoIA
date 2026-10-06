"use client"

/** Cadastro rápido para abrir o relatório de dividend yield. Abre só quando o usuário pede o relatório. */

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"

interface DividendYieldRegisterModalProps {
  isOpen: boolean
  onClose: () => void
  ticker: string
  investmentAmount: string
}

export function DividendYieldRegisterModal({
  isOpen,
  onClose,
  ticker,
  investmentAmount,
}: DividendYieldRegisterModalProps) {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [website, setWebsite] = useState("") // Honeypot: campo invisível para detectar bots
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    // Honeypot preenchido: provavelmente um bot. Para sem avisar.
    if (website) {
      setIsLoading(false)
      return
    }

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
      // Registrar com acquisition tracking
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
          website,
          acquisition: "Calculadora de Dividend Yield",
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || "Erro ao criar conta")
      }

      // Login automático após registro
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        throw new Error("Erro ao fazer login após registro")
      }

      setSuccess(true)

      // Redirecionar para relatório completo após 1 segundo
      setTimeout(() => {
        router.push(
          `/calculadoras/dividend-yield/${ticker}/report?investmentAmount=${investmentAmount}`
        )
      }, 1000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar conta")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Crie uma conta para ver o relatório</DialogTitle>
          <DialogDescription>
            Conta gratuita, sem cartão de crédito. O relatório traz sustentabilidade dos proventos, histórico completo,
            comparação com o setor e cenários de renda.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div role="status" className="space-y-1 py-6 text-center">
            <p className="text-base font-medium text-foreground">Conta criada</p>
            <p className="text-sm text-muted-foreground">Abrindo o relatório completo.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 relative">
            <div className="space-y-2">
              <Label htmlFor="name">Nome</Label>
              <Input
                id="name"
                type="text"
                autoComplete="name"
                placeholder="Seu nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Confirme sua senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            {/* Honeypot: campo invisível (classe sr-field) para detectar bots */}
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
              <p role="alert" className="text-sm text-negative">
                {error}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />}
              {isLoading ? "Criando conta" : "Criar conta e ver relatório"}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

