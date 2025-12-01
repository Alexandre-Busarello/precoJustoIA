import { Metadata } from 'next'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCurrentUser } from '@/lib/user-service'
import { DebtCalculator } from '@/components/debt-calculator'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Lock, TrendingUp, BarChart3, Sparkles, Wallet } from 'lucide-react'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Arbitragem Inteligente de Dívida | Preço Justo AI',
  description: 'Simule matematicamente a eficiência entre amortizar dívida imobiliária vs investir em ativos. Descubra qual estratégia é melhor para você.',
  keywords: ['arbitragem dívida', 'amortizar dívida', 'investir vs amortizar', 'simulador dívida', 'calculadora financeira'],
  openGraph: {
    title: 'Arbitragem Inteligente de Dívida | Preço Justo AI',
    description: 'Simule matematicamente a eficiência entre amortizar dívida imobiliária vs investir em ativos.',
    type: 'website'
  }
}

export default async function ArbitragemDividaPage() {
  // Verificar sessão do usuário
  const session = await getServerSession(authOptions)
  const isLoggedIn = !!session
  
  // Verificar se usuário é Premium
  let isPremium = false
  if (isLoggedIn) {
    const user = await getCurrentUser()
    isPremium = user?.isPremium || false
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">
            Arbitragem Inteligente de Dívida
          </h1>
          <p className="text-xl text-muted-foreground mb-2">
            Compare matematicamente: Amortizar Dívida vs. Investir em Ativos
          </p>
          <p className="text-muted-foreground">
            Descubra qual estratégia é mais eficiente para seu caso específico
          </p>
        </div>

        {/* Seção de Recursos Premium - Mostrar apenas se não for Premium */}
        {!isPremium && (
          <Card className="mb-6 border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3 mb-4">
                <Sparkles className="h-5 w-5 text-primary mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold mb-2">Recursos Premium Disponíveis</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Faça upgrade para desbloquear análises automáticas baseadas em dados reais
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-start gap-2 p-3 bg-background rounded-lg border">
                      <Lock className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Carteira</p>
                        <p className="text-xs text-muted-foreground">
                          Use sua carteira real para calcular rentabilidade automática baseada nos ativos que você já possui
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 bg-background rounded-lg border">
                      <Lock className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Rankings</p>
                        <p className="text-xs text-muted-foreground">
                          Selecione estratégias (Graham, Magic Formula, etc.) para calcular rentabilidade esperada dos melhores ativos
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 p-3 bg-background rounded-lg border">
                      <Lock className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium text-sm">Tickers Manuais</p>
                        <p className="text-xs text-muted-foreground">
                          Digite tickers específicos (ex: PETR4, VALE3) e calcule rentabilidade automática baseada em dados reais
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-center">
                    <Link href="/planos">
                      <Badge variant="default" className="cursor-pointer hover:bg-primary/90">
                        <TrendingUp className="h-3 w-3 mr-1" />
                        Ver Planos Premium
                      </Badge>
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <DebtCalculator isPublic={!isLoggedIn} />

        {/* Seção de Explicação das Estratégias */}
        <Card className="mt-8">
          <CardContent className="pt-6">
            <h3 className="font-semibold mb-4">Como Funciona?</h3>
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <h4 className="font-medium">Estratégia Sniper (100% Amortização)</h4>
                </div>
                <p className="text-sm text-muted-foreground ml-6">
                  Foca 100% da capacidade financeira livre em eliminar a dívida. Não investe nada enquanto houver saldo devedor.
                  Após quitar, todo o orçamento (prestação + sobra) vira investimento.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-4 w-4 text-primary" />
                  <h4 className="font-medium">Estratégia Híbrida (Split Fixo)</h4>
                </div>
                <p className="text-sm text-muted-foreground ml-6">
                  Mantém um valor fixo mensal para investir (Split), mantendo o hábito de investir mesmo enquanto paga a dívida.
                  O restante da sobra vai para amortização extra. Ideal para quem quer "skin in the game".
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <h4 className="font-medium">Break-even Point</h4>
                </div>
                <p className="text-sm text-muted-foreground ml-6">
                  É o mês exato em que seu patrimônio investido supera o saldo devedor. Neste ponto, você atingiu a "Liberdade Financeira Técnica":
                  poderia vender todos os investimentos e quitar a dívida à vista hoje.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

