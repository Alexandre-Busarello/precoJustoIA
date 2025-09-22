'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Shield, 
  Calendar, 
  CreditCard,
  ExternalLink,
  Loader2,
  CheckCircle,
  AlertCircle,
  Crown
} from "lucide-react"

interface SubscriptionStatus {
  isActive: boolean
  tier: 'FREE' | 'PREMIUM'
  expiresAt: string | null
  stripeStatus?: string
  cancelAtPeriodEnd?: boolean
}

export function SubscriptionManager() {
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSubscriptionStatus()
  }, [])

  const fetchSubscriptionStatus = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/subscription/status')
      
      if (!response.ok) {
        throw new Error('Erro ao carregar status da assinatura')
      }

      const data = await response.json()
      setSubscription(data.subscription)
    } catch (err) {
      console.error('Erro ao carregar assinatura:', err)
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  const openCustomerPortal = async () => {
    try {
      setPortalLoading(true)
      
      const response = await fetch('/api/subscription/portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          returnUrl: window.location.href,
        }),
      })

      if (!response.ok) {
        throw new Error('Erro ao abrir portal de gerenciamento')
      }

      const data = await response.json()
      window.open(data.url, '_blank')
    } catch (err) {
      console.error('Erro ao abrir portal:', err)
      setError(err instanceof Error ? err.message : 'Erro ao abrir portal')
    } finally {
      setPortalLoading(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span>Carregando informações da assinatura...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-600" />
            <div>
              <h3 className="font-semibold text-red-900 dark:text-red-100">
                Erro ao carregar assinatura
              </h3>
              <p className="text-sm text-red-700 dark:text-red-200">
                {error}
              </p>
            </div>
          </div>
          <Button 
            onClick={fetchSubscriptionStatus}
            variant="outline" 
            size="sm" 
            className="mt-4"
          >
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    )
  }

  if (!subscription) {
    return null
  }

  const isPremium = subscription.tier === 'PREMIUM'
  const expiresAt = subscription.expiresAt ? new Date(subscription.expiresAt) : null

  return (
    <Card className={`border-2 ${isPremium ? 'border-violet-200 bg-gradient-to-br from-violet-50 to-pink-50 dark:from-violet-950/20 dark:to-pink-950/20' : 'border-gray-200'}`}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center ${
              isPremium 
                ? 'bg-gradient-to-br from-violet-500 to-pink-500' 
                : 'bg-gray-100 dark:bg-gray-800'
            }`}>
              {isPremium ? (
                <Crown className="w-8 h-8 text-white" />
              ) : (
                <Shield className="w-8 h-8 text-gray-600" />
              )}
            </div>
            
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h3 className="text-xl font-bold">
                  {isPremium ? 'Premium' : 'Gratuito'}
                </h3>
                <Badge 
                  variant={isPremium ? 'default' : 'secondary'}
                  className={isPremium ? 'bg-gradient-to-r from-violet-600 to-pink-600' : ''}
                >
                  {subscription.tier}
                </Badge>
              </div>
              
              {isPremium && expiresAt && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="w-4 h-4" />
                  <span>
                    {subscription.cancelAtPeriodEnd 
                      ? `Cancela em ${expiresAt.toLocaleDateString('pt-BR')}`
                      : `Renova em ${expiresAt.toLocaleDateString('pt-BR')}`
                    }
                  </span>
                </div>
              )}
            </div>
          </div>

          {subscription.isActive && (
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-green-700 dark:text-green-400">
                Ativo
              </span>
            </div>
          )}
        </div>

        {isPremium ? (
          <div className="space-y-4">
            <div className="bg-white/50 dark:bg-background/50 rounded-lg p-4">
              <h4 className="font-semibold mb-2">Recursos Premium Ativos</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>8 Modelos de Valuation</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Análise com IA</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Rankings Ilimitados</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Suporte Prioritário</span>
                </div>
              </div>
            </div>

            {subscription.cancelAtPeriodEnd && (
              <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600" />
                  <span className="font-semibold text-yellow-800 dark:text-yellow-200">
                    Assinatura Cancelada
                  </span>
                </div>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Sua assinatura foi cancelada e não será renovada. Você ainda tem acesso 
                  aos recursos Premium até {expiresAt?.toLocaleDateString('pt-BR')}.
                </p>
              </div>
            )}

            <Button 
              onClick={openCustomerPortal}
              disabled={portalLoading}
              className="w-full"
              variant="outline"
            >
              {portalLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Abrindo...
                </>
              ) : (
                <>
                  <CreditCard className="w-4 h-4 mr-2" />
                  Gerenciar Assinatura
                  <ExternalLink className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-4">
              <h4 className="font-semibold mb-2">Recursos Gratuitos</h4>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Fórmula de Graham</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>350+ Empresas da B3</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span>Rankings Básicos</span>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-violet-50 to-pink-50 dark:from-violet-950/20 dark:to-pink-950/20 rounded-lg p-4">
              <h4 className="font-semibold mb-2">🚀 Upgrade para Premium</h4>
              <p className="text-sm text-muted-foreground mb-3">
                Desbloqueie 8 modelos de valuation, análise com IA e muito mais!
              </p>
              <Button className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-700 hover:to-pink-700" asChild>
                <a href="/planos">
                  Ver Planos Premium
                </a>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
