"use client"

import Link from "next/link"
import { Lock } from "lucide-react"
import { Button } from "@/components/ui/button"

interface RecoveryLimitCTAProps {
  tier: "ANONYMOUS" | "FREE"
  remaining?: number
  limit?: number
}

/**
 * Exibido quando o usuário atinge o limite da calculadora de recuperação.
 * Anônimo: 2 usos. Gratuito: 3 usos por mês. Premium: ilimitado.
 */
export function RecoveryLimitCTA({ tier, limit = 0 }: RecoveryLimitCTAProps) {
  const isAnon = tier === "ANONYMOUS"
  const used = limit > 0 ? limit : isAnon ? 2 : 3

  return (
    <section className="mx-auto max-w-lg space-y-4 rounded-lg border border-border bg-card p-6 text-center">
      <Lock className="mx-auto size-5 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {isAnon ? `Você usou os ${used} cálculos gratuitos` : `Você usou os ${used} cálculos deste mês`}
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">
          {isAnon
            ? "Com uma conta gratuita, você tem 3 cálculos por mês. No Premium, o uso é ilimitado."
            : "No Premium, a calculadora de recuperação é ilimitada, junto com as demais ferramentas da plataforma."}
        </p>
      </div>
      <div className="flex flex-col justify-center gap-2 sm:flex-row">
        {isAnon ? (
          <>
            <Button asChild>
              <Link href="/register?callbackUrl=/calculadoras/recuperacao">Criar conta grátis</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/login?callbackUrl=/calculadoras/recuperacao">Entrar</Link>
            </Button>
          </>
        ) : (
          <Button asChild>
            <Link href="/planos">Conhecer o Premium</Link>
          </Button>
        )}
      </div>
    </section>
  )
}
