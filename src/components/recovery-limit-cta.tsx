"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { User, Mail, Crown, CreditCard } from "lucide-react"

interface RecoveryLimitCTAProps {
  tier: "ANONYMOUS" | "FREE"
  remaining?: number
  limit?: number
}

/**
 * CTA exibido quando usuário atinge o limite da Calculadora de Recuperação.
 * Anônimo: 2 usos. Gratuito: 3 usos/mês. Premium: ilimitado.
 */
export function RecoveryLimitCTA({ tier, remaining = 0, limit = 0 }: RecoveryLimitCTAProps) {
  const isAnon = tier === "ANONYMOUS"

  return (
    <div className="flex flex-col items-center justify-center min-h-[320px] p-6 sm:p-8 text-center bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 rounded-lg border-2 border-amber-200 dark:border-amber-800">
      <div className="mb-6">
        <Crown className="w-16 h-16 text-amber-600 dark:text-amber-500 mx-auto mb-4" />
        <h3 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
          {isAnon
            ? "Você atingiu o limite de 2 usos gratuitos"
            : "Você atingiu o limite de 3 usos este mês"}
        </h3>
        <p className="text-muted-foreground mb-4">
          {isAnon ? (
            <>
              Crie sua conta gratuita e ganhe <strong>3 usos por mês</strong> da Calculadora de Recuperação
            </>
          ) : (
            <>
              Assine o Premium e tenha <strong>acesso ilimitado</strong> à Calculadora de Recuperação
            </>
          )}
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 p-4 sm:p-6 rounded-lg shadow-lg mb-6 max-w-md">
        <h4 className="font-semibold mb-3">
          {isAnon ? "Com sua conta você terá:" : "Com o Premium você terá:"}
        </h4>
        <div className="space-y-2 text-left text-sm">
          <div className="flex items-center space-x-3 p-2 rounded-lg bg-green-50 dark:bg-green-900/20">
            <span className="text-green-600 dark:text-green-400">✓</span>
            <span>
              {isAnon
                ? "3 usos por mês da Calculadora de Recuperação"
                : "Calculadora de Recuperação ilimitada"}
            </span>
          </div>
          <div className="flex items-center space-x-3 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
            <span className="text-blue-600 dark:text-blue-400">✓</span>
            <span>
              {isAnon
                ? "Acesso a outras ferramentas gratuitas"
                : "Carteiras com acompanhamento em tempo real"}
            </span>
          </div>
          <div className="flex items-center space-x-3 p-2 rounded-lg bg-purple-50 dark:bg-purple-900/20">
            <span className="text-purple-600 dark:text-purple-400">✓</span>
            <span>
              {isAnon
                ? "Assine o Premium para uso ilimitado"
                : "Todas as ferramentas premium"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        {isAnon ? (
          <>
            <Button asChild size="lg" className="bg-amber-600 hover:bg-amber-700 text-white">
              <Link href="/register">
                <Mail className="w-4 h-4 mr-2" />
                Criar conta gratuita
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/login">
                <User className="w-4 h-4 mr-2" />
                Já tenho conta
              </Link>
            </Button>
          </>
        ) : (
          <Button asChild size="lg" className="bg-amber-600 hover:bg-amber-700 text-white">
            <Link href="/checkout">
              <CreditCard className="w-4 h-4 mr-2" />
              Assinar Premium
            </Link>
          </Button>
        )}
      </div>
    </div>
  )
}
