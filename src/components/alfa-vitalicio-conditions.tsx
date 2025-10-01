'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, MessageCircle, AlertCircle, Users, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import { useAlfa } from '@/contexts/alfa-context'

export function AlfaVitalicioConditions() {
  const { stats, isLoading } = useAlfa()

  // Só mostrar se estiver na fase Alfa
  if (isLoading || !stats || stats.phase !== 'ALFA') {
    return null
  }

  return (
    <section className="py-16 bg-gradient-to-b from-white to-purple-50 dark:from-background dark:to-purple-950/10">
      <div className="container mx-auto px-4">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 mb-4 px-4 py-2 text-sm">
              🎯 FASE ALFA - {stats.spotsAvailable}/{stats.userLimit} Vagas Disponíveis
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Como Garantir{" "}
              <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                3 Anos de Acesso Premium GRATUITO
              </span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Não é apenas se cadastrar. Queremos construir uma comunidade engajada de{" "}
              <strong>investidores que contribuem ativamente</strong> com feedbacks.
            </p>
          </div>

          {/* Condições */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
            {/* Card 1: Cadastro */}
            <Card className="border-2 border-purple-200 dark:border-purple-800 hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                    <Users className="w-6 h-6 text-purple-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-purple-600">1.</span>
                      <h3 className="font-bold text-lg">Garanta sua vaga</h3>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 ml-15">
                  <div className="flex items-start gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Cadastre-se na plataforma enquanto há vagas</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Ganhe acesso Premium imediato e gratuito</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Explore todas as funcionalidades da plataforma</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 2: Grupo WhatsApp */}
            <Card className="border-2 border-blue-200 dark:border-blue-800 hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
                    <MessageCircle className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-blue-600">2.</span>
                      <h3 className="font-bold text-lg">Entre no grupo</h3>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 ml-15">
                  <div className="flex items-start gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Junte-se ao <strong>grupo exclusivo WhatsApp</strong></span>
                  </div>
                  <div className="flex items-start gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Link disponível no seu Dashboard após login</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Interaja diretamente com o CEO e outros usuários</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 3: Feedback Ativo */}
            <Card className="border-2 border-green-200 dark:border-green-800 hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-green-600">3.</span>
                      <h3 className="font-bold text-lg">Seja ativo</h3>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 ml-15">
                  <div className="flex items-start gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span><strong>Compartilhe feedbacks</strong> sobre funcionalidades</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Sugira melhorias e novas features</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Reporte bugs e participe da evolução</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Card 4: Recompensa */}
            <Card className="border-2 border-yellow-200 dark:border-yellow-800 bg-gradient-to-br from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20 hover:shadow-xl transition-all duration-300">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-xl flex items-center justify-center">
                    <CheckCircle className="w-6 h-6 text-yellow-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl font-bold text-yellow-600">✨</span>
                      <h3 className="font-bold text-lg">Recompensa</h3>
                    </div>
                  </div>
                </div>
                <div className="space-y-3 ml-15">
                  <div className="flex items-start gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span><strong className="text-yellow-700 dark:text-yellow-500">3 Anos de Acesso Premium</strong> gratuito</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Todas as features presentes e futuras</span>
                  </div>
                  <div className="flex items-start gap-3 text-sm">
                    <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span>Sem mensalidade por 3 anos completos</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Aviso Importante */}
          <Card className="border-2 border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20">
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-orange-600 flex-shrink-0 mt-1" />
                <div>
                  <h4 className="font-bold text-lg mb-2 text-orange-900 dark:text-orange-100">
                    ⚠️ Importante: Participação ativa é obrigatória
                  </h4>
                  <p className="text-sm text-orange-800 dark:text-orange-200 leading-relaxed">
                    Os 3 anos de acesso gratuito <strong>não são automáticos</strong> para quem apenas se cadastra. 
                    Este benefício é reservado para usuários que <strong>contribuem ativamente</strong> com feedbacks 
                    no grupo WhatsApp durante a Fase Alfa. Queremos construir junto com você!
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* CTA */}
          <div className="text-center mt-12">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold text-lg px-10 py-6 shadow-xl"
              asChild
            >
              <Link href="/register">
                Garantir Minha Vaga Alfa Agora →
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground mt-4">
              Apenas {stats.spotsAvailable} de {stats.userLimit} vagas restantes • Acesso Premium imediato
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

