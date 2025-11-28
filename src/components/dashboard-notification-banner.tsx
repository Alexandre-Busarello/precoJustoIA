"use client"

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, ArrowRight, Check } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface DashboardNotification {
  id: string
  title: string
  message: string
  link: string | null
  linkType: 'INTERNAL' | 'EXTERNAL'
  ctaText?: string | null
}

export function DashboardNotificationBanner() {
  const { data, isLoading } = useQuery({
    queryKey: ['notifications', 'dashboard'],
    queryFn: async () => {
      const res = await fetch('/api/notifications/dashboard')
      if (!res.ok) return { notification: null }
      return res.json()
    },
  })

  const notification: DashboardNotification | null = data?.notification || null

  // Banner padrão P/L Histórico
  const defaultBanner = (
    <Link href="/pl-bolsa">
      <Card className="group cursor-pointer bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/30 dark:via-purple-950/30 dark:to-pink-950/30 border-2 border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-xl transition-all duration-300 mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-200/30 to-purple-200/30 rounded-full -translate-y-32 translate-x-32 group-hover:scale-150 transition-transform duration-700"></div>
        
        <CardContent className="p-6 relative z-10">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg flex-shrink-0">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-bold text-xl text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  📊 A bolsa está cara ou barata?
                </h3>
                <Badge variant="secondary" className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0">
                  Novo
                </Badge>
              </div>
              <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed mb-4 font-medium">
                Descubra o P/L histórico da Bovespa desde 2010 com dados de mais de 300 empresas. 
                Compare com a média histórica e identifique se o mercado está caro ou barato.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium shadow-md"
                >
                  Ver P/L Histórico
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
                <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400">
                  <span className="flex items-center gap-1">
                    <Check className="w-3 h-3 text-indigo-600" />
                    Grátis
                  </span>
                  <span className="flex items-center gap-1">
                    <Check className="w-3 h-3 text-indigo-600" />
                    Dados desde 2010
                  </span>
                  <span className="flex items-center gap-1">
                    <Check className="w-3 h-3 text-indigo-600" />
                    +300 empresas
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )

  if (isLoading) {
    return (
      <Card className="group cursor-pointer bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/30 dark:via-purple-950/30 dark:to-pink-950/30 border-2 border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-xl transition-all duration-300 mb-6 relative overflow-hidden">
        <CardContent className="p-6 relative z-10">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <Skeleton className="w-16 h-16 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Se houver notificação destacada, exibir ela
  if (notification) {
    const handleClick = () => {
      if (notification.link) {
        if (notification.linkType === 'INTERNAL') {
          window.location.href = notification.link
        } else {
          window.open(notification.link, '_blank', 'noopener,noreferrer')
        }
      }
    }

    return (
      <Card
        className="group cursor-pointer bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/30 dark:via-purple-950/30 dark:to-pink-950/30 border-2 border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 dark:hover:border-indigo-600 hover:shadow-xl transition-all duration-300 mb-6 relative overflow-hidden"
        onClick={handleClick}
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-200/30 to-purple-200/30 rounded-full -translate-y-32 translate-x-32 group-hover:scale-150 transition-transform duration-700"></div>
        
        <CardContent className="p-6 relative z-10">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg flex-shrink-0">
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 className="font-bold text-xl text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {notification.title}
                </h3>
                <Badge variant="secondary" className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0">
                  Novo
                </Badge>
              </div>
              <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed mb-4 font-medium">
                {notification.message}
              </p>
              {notification.link && (
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-medium shadow-md"
                  >
                    {notification.ctaText || (notification.linkType === 'INTERNAL' ? 'Ver detalhes' : 'Abrir link')}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Se não houver notificação destacada, exibir banner padrão
  return defaultBanner
}

