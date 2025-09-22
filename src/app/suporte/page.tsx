import { Metadata } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/user-service'
import SupportCenter from '@/components/support-center'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { 
  Headphones, 
  Shield, 
  MessageSquare, 
  Clock, 
  Users, 
  FileText, 
  BookOpen, 
  Zap, 
  Star, 
  Crown 
} from 'lucide-react'

export const metadata: Metadata = {
  title: 'Central de Suporte Premium | Preço Justo AI',
  description: 'Central de suporte exclusiva para usuários Premium. Abra tickets, acompanhe o status e receba suporte personalizado.',
}

export default async function SupportPage() {
  const session = await getServerSession(authOptions)

  if (!session) {
    redirect('/login?callbackUrl=/suporte')
  }

  // Verificar se é Premium - ÚNICA FONTE DA VERDADE
  const user = await getCurrentUser()
  
  if (!user) {
    redirect('/login?callbackUrl=/suporte')
  }

  const isPremium = user.isPremium

  if (isPremium) {
    // Usuário Premium - mostrar Central de Suporte
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                Central de Suporte Premium
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-6">
                Suporte personalizado e prioritário para usuários Premium. 
                Tire dúvidas, reporte problemas e receba ajuda especializada da nossa equipe.
              </p>
              
              {/* Informações sobre tempo de resposta */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 max-w-2xl mx-auto">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <h3 className="font-semibold text-blue-900">Tempo de Resposta</h3>
                </div>
                <p className="text-blue-800 text-sm">
                  <strong>Resposta em até 5 dias úteis</strong> • Em média respondemos em até 2 dias úteis
                </p>
                <p className="text-blue-700 text-xs mt-1">
                  Tickets com mais de 48h sem resposta são priorizados automaticamente
                </p>
              </div>
            </div>

            <SupportCenter />
          </div>
        </div>
      </div>
    )
  }

  // Usuário gratuito - mostrar página de conversão
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100">
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 py-2 rounded-full text-sm font-medium mb-6">
              <Headphones className="w-4 h-4" />
              Central de Suporte Premium
            </div>
            
            <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
              Suporte Exclusivo e
              <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"> Personalizado</span>
            </h1>
            
            <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
              Tenha acesso direto à nossa equipe de suporte especializada. 
              Tire dúvidas sobre a plataforma, reporte problemas técnicos e receba ajuda prioritária.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button asChild size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-lg px-8 py-6">
                <Link href="/checkout" className="flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Fazer Upgrade Premium
                </Link>
              </Button>
              
              <Button variant="outline" size="lg" asChild className="text-lg px-8 py-6">
                <Link href="/planos">
                  Ver Todos os Planos
                </Link>
              </Button>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-blue-100">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mb-6">
                <MessageSquare className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Sistema de Tickets</h3>
              <p className="text-gray-600">
                Abra tickets organizados por categoria e acompanhe o status em tempo real. 
                Histórico completo de todas as suas solicitações.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg border border-purple-100">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mb-6">
                <Clock className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Resposta Prioritária</h3>
              <p className="text-gray-600">
                Receba respostas em até 24 horas úteis. Suporte prioritário para 
                questões técnicas e dúvidas sobre análises.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg border border-indigo-100">
              <div className="w-12 h-12 bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center mb-6">
                <Users className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Equipe Especializada</h3>
              <p className="text-gray-600">
                Nossa equipe de analistas e desenvolvedores está pronta para 
                ajudar com análises personalizadas e suporte técnico.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg border border-green-100">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-green-600 rounded-xl flex items-center justify-center mb-6">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Resolução de Problemas</h3>
              <p className="text-gray-600">
                Reporte bugs, problemas técnicos ou dificuldades com a plataforma. 
                Nossa equipe investigará e resolverá rapidamente.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg border border-orange-100">
              <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mb-6">
                <BookOpen className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Orientação de Uso</h3>
              <p className="text-gray-600">
                Aprenda a usar melhor nossa plataforma, entenda as funcionalidades 
                e tire dúvidas sobre como navegar e aproveitar todos os recursos.
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg border border-red-100">
              <div className="w-12 h-12 bg-gradient-to-r from-red-500 to-red-600 rounded-xl flex items-center justify-center mb-6">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-4">Suporte Técnico</h3>
              <p className="text-gray-600">
                Problemas técnicos? Nossa equipe de desenvolvimento está pronta 
                para resolver qualquer issue rapidamente.
              </p>
            </div>
          </div>

          {/* Testimonial */}
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 mb-12">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>
              <blockquote className="text-lg text-gray-700 mb-4 italic">
                &ldquo;O suporte Premium do Preço Justo AI é excepcional. Consegui resolver rapidamente problemas técnicos 
                e esclarecer dúvidas sobre como usar melhor a plataforma. A equipe é muito atenciosa e eficiente!&rdquo;
              </blockquote>
              <cite className="text-sm text-gray-500">— Investidor Premium verificado</cite>
            </div>
          </div>

          {/* CTA Final */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-8 text-center text-white">
            <h2 className="text-3xl font-bold mb-4">
              Pronto para ter suporte exclusivo?
            </h2>
            <p className="text-xl mb-6 opacity-90">
              Faça upgrade para Premium e tenha acesso imediato à Central de Suporte
            </p>
            <Button size="lg" variant="secondary" asChild className="bg-white text-blue-600 hover:bg-gray-100 text-lg px-8 py-6">
              <Link href="/checkout" className="flex items-center gap-2">
                <Crown className="w-5 h-5" />
                Começar Agora - Premium
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
