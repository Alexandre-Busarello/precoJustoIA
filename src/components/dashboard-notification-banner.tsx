"use client"

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, ArrowRight, Check, ExternalLink } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { NotificationMarkdown } from '@/components/notification-markdown'

interface DashboardNotification {
  id: string
  title: string
  message: string
  link: string | null
  linkType: 'INTERNAL' | 'EXTERNAL'
  ctaText?: string | null
  bannerTemplate?: 'GRADIENT' | 'SOLID' | 'MINIMAL' | 'ILLUSTRATED' | null
  illustrationUrl?: string | null
  bannerColors?: {
    primaryColor?: string
    secondaryColor?: string
    backgroundColor?: string
    textColor?: string
    buttonColor?: string
    buttonTextColor?: string
  } | null
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

    const template = notification.bannerTemplate || 'GRADIENT'
    const colors = notification.bannerColors

    // Helper para aplicar cores customizadas
    const getGradientBg = () => {
      if (colors?.backgroundColor) return colors.backgroundColor
      if (colors?.primaryColor && colors?.secondaryColor) {
        return `linear-gradient(to right, ${colors.primaryColor}, ${colors.secondaryColor})`
      }
      return undefined
    }

    const getSolidBg = () => colors?.backgroundColor || undefined
    const getTextColor = () => colors?.textColor || undefined
    const getButtonBg = () => colors?.buttonColor || undefined
    const getTextColorButton = () => colors?.buttonTextColor || '#ffffff'
    const getPrimaryColor = () => colors?.primaryColor || undefined
    const getSecondaryColor = () => colors?.secondaryColor || undefined
    
    // Helper para estilo de background com gradiente
    const getBackgroundStyle = (bg: string | undefined) => {
      if (!bg) return undefined
      if (bg.includes('gradient') || bg.includes('linear-gradient')) {
        return { backgroundImage: bg }
      }
      return { background: bg }
    }
    
    // Helper para estilo do botão
    const getButtonStyle = () => {
      const bg = getButtonBg()
      if (!bg) return undefined
      const style: React.CSSProperties = { color: getTextColorButton() }
      if (bg.includes('gradient') || bg.includes('linear-gradient')) {
        style.backgroundImage = bg
      } else {
        style.background = bg
      }
      return style
    }

    // Template GRADIENT (padrão)
    const gradientBanner = (
      <Card
        className={cn(
          "group cursor-pointer border-2 hover:shadow-xl transition-all duration-300 mb-6 relative overflow-hidden",
          !getGradientBg() && "bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/30 dark:via-purple-950/30 dark:to-pink-950/30 border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 dark:hover:border-indigo-600"
        )}
        style={{
          ...getBackgroundStyle(getGradientBg()),
          borderColor: getPrimaryColor() ? `${getPrimaryColor()}80` : undefined
        }}
        onClick={handleClick}
      >
        {!getGradientBg() && (
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-200/30 to-purple-200/30 rounded-full -translate-y-32 translate-x-32 group-hover:scale-150 transition-transform duration-700"></div>
        )}
        <CardContent className="p-6 relative z-10">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div 
              className={cn(
                "w-16 h-16 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg flex-shrink-0",
                !getPrimaryColor() && "bg-gradient-to-br from-indigo-500 to-purple-600"
              )}
              style={{
                background: getPrimaryColor() && getSecondaryColor() 
                  ? `linear-gradient(to bottom right, ${getPrimaryColor()}, ${getSecondaryColor()})`
                  : getPrimaryColor()
                  ? getPrimaryColor()
                  : undefined
              }}
            >
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 
                  className={cn(
                    "font-bold text-xl transition-colors",
                    !getTextColor() && "text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                  )}
                  style={{ color: getTextColor() }}
                >
                  {notification.title}
                </h3>
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "border-0",
                    !getPrimaryColor() && "bg-gradient-to-r from-indigo-500 to-purple-500 text-white"
                  )}
                  style={{
                    background: getPrimaryColor() && getSecondaryColor()
                      ? `linear-gradient(to right, ${getPrimaryColor()}, ${getSecondaryColor()})`
                      : getPrimaryColor()
                      ? getPrimaryColor()
                      : undefined,
                    color: '#ffffff'
                  }}
                >
                  Novo
                </Badge>
              </div>
              <p 
                className={cn(
                  "text-sm sm:text-base leading-relaxed mb-4 font-medium",
                  !getTextColor() && "text-slate-700 dark:text-slate-300"
                )}
                style={{ color: getTextColor() || undefined }}
              >
                {notification.message}
              </p>
              {notification.link && (
                <Button
                  className={cn(
                    "font-medium shadow-md",
                    !getButtonBg() && "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                  )}
                  style={getButtonStyle()}
                >
                  {notification.ctaText || (notification.linkType === 'INTERNAL' ? 'Ver detalhes' : 'Abrir link')}
                  {notification.linkType === 'EXTERNAL' ? (
                    <ExternalLink className="w-4 h-4 ml-2" />
                  ) : (
                    <ArrowRight className="w-4 h-4 ml-2" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )

    // Template SOLID
    const solidBanner = (
      <Card
        className={cn(
          "group cursor-pointer border-2 hover:shadow-xl transition-all duration-300 mb-6",
          !getSolidBg() && "bg-slate-900 dark:bg-slate-800 border-slate-700 dark:border-slate-600 hover:border-slate-600 dark:hover:border-slate-500"
        )}
        style={{
          backgroundColor: getSolidBg(),
          borderColor: getPrimaryColor() ? `${getPrimaryColor()}80` : undefined
        }}
        onClick={handleClick}
      >
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            <div 
              className={cn(
                "w-16 h-16 rounded-xl flex items-center justify-center group-hover:scale-110 transition-all duration-300 flex-shrink-0",
                !getPrimaryColor() && "bg-slate-700 dark:bg-slate-600"
              )}
              style={{ backgroundColor: getPrimaryColor() || undefined }}
            >
              <TrendingUp className="w-8 h-8 text-white" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 
                  className={cn(
                    "font-bold text-xl",
                    !getTextColor() && "text-white"
                  )}
                  style={{ color: getTextColor() || '#ffffff' }}
                >
                  {notification.title}
                </h3>
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "border-0",
                    !getButtonBg() && "bg-white text-slate-900"
                  )}
                  style={{
                    backgroundColor: getButtonBg() || '#ffffff',
                    color: getTextColorButton() || '#1e293b'
                  }}
                >
                  Novo
                </Badge>
              </div>
              <div 
                className={cn(
                  "text-sm sm:text-base leading-relaxed mb-4 font-medium",
                  !getTextColor() && "text-slate-300"
                )}
                style={{ color: getTextColor() || '#cbd5e1' }}
              >
                <NotificationMarkdown content={notification.message} />
              </div>
              {notification.link && (
                <Button
                  className={cn(
                    "font-medium shadow-md",
                    !getButtonBg() && "bg-white text-slate-900 hover:bg-slate-100"
                  )}
                  style={{
                    backgroundColor: getButtonBg() || '#ffffff',
                    color: getTextColorButton() || '#1e293b'
                  }}
                >
                  {notification.ctaText || (notification.linkType === 'INTERNAL' ? 'Ver detalhes' : 'Abrir link')}
                  {notification.linkType === 'EXTERNAL' ? (
                    <ExternalLink className="w-4 h-4 ml-2" />
                  ) : (
                    <ArrowRight className="w-4 h-4 ml-2" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )

    // Template MINIMAL - Aplica todas as cores customizadas
    const minimalBanner = (
      <Card
        className={cn(
          "group cursor-pointer border hover:shadow-lg transition-all duration-300 mb-6",
          !getSolidBg() && "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
        )}
        style={{
          backgroundColor: getSolidBg() || undefined,
          borderColor: getPrimaryColor() ? `${getPrimaryColor()}40` : (getSecondaryColor() ? `${getSecondaryColor()}40` : undefined)
        }}
        onClick={handleClick}
      >
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            {/* Ícone com cor primária */}
            <div 
              className={cn(
                "w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors",
                !getPrimaryColor() && "bg-slate-100 dark:bg-slate-800"
              )}
              style={{ 
                backgroundColor: getPrimaryColor() ? `${getPrimaryColor()}20` : (getSecondaryColor() ? `${getSecondaryColor()}20` : undefined)
              }}
            >
              <TrendingUp 
                className={cn(
                  "w-6 h-6",
                  !getPrimaryColor() && !getSecondaryColor() && "text-slate-600 dark:text-slate-400"
                )}
                style={{ 
                  color: getPrimaryColor() || getSecondaryColor() || getTextColor() || undefined 
                }}
              />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                {/* Título com cor do texto */}
                <h3 
                  className={cn(
                    "font-semibold text-lg",
                    !getTextColor() && "text-slate-900 dark:text-slate-100"
                  )}
                  style={{ color: getTextColor() || undefined }}
                >
                  {notification.title}
                </h3>
                {/* Badge com cor primária ou secundária */}
                <Badge 
                  variant="outline" 
                  className="text-xs"
                  style={{
                    borderColor: getPrimaryColor() || getSecondaryColor() || undefined,
                    color: getPrimaryColor() || getSecondaryColor() || getTextColor() || undefined,
                    backgroundColor: getPrimaryColor() ? `${getPrimaryColor()}10` : (getSecondaryColor() ? `${getSecondaryColor()}10` : undefined)
                  }}
                >
                  Novo
                </Badge>
              </div>
              {/* Mensagem com cor do texto */}
              <div 
                className={cn(
                  "text-sm leading-relaxed mb-4",
                  !getTextColor() && "text-slate-600 dark:text-slate-400"
                )}
                style={{ color: getTextColor() || undefined }}
              >
                <NotificationMarkdown content={notification.message} />
              </div>
              {/* Botão com cor do botão ou cor primária/secundária */}
              {notification.link && (
                <Button
                  variant="outline"
                  className="font-medium"
                  style={{
                    borderColor: getButtonBg() || getPrimaryColor() || getSecondaryColor() || undefined,
                    backgroundColor: getButtonBg() && !getButtonBg()?.includes('gradient') && !getButtonBg()?.includes('linear') ? getButtonBg() : undefined,
                    backgroundImage: getButtonBg()?.includes('gradient') || getButtonBg()?.includes('linear') ? getButtonBg() : undefined,
                    color: getButtonBg() ? getTextColorButton() : (getPrimaryColor() || getSecondaryColor() || getTextColor() || undefined)
                  }}
                >
                  {notification.ctaText || (notification.linkType === 'INTERNAL' ? 'Ver detalhes' : 'Abrir link')}
                  {notification.linkType === 'EXTERNAL' ? (
                    <ExternalLink className="w-4 h-4 ml-2" />
                  ) : (
                    <ArrowRight className="w-4 h-4 ml-2" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )

    // Template ILLUSTRATED
    const illustratedBanner = (
      <Card
        className={cn(
          "group cursor-pointer border-2 hover:shadow-xl transition-all duration-300 mb-6 relative overflow-hidden",
          !getGradientBg() && "bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/30 dark:via-purple-950/30 dark:to-pink-950/30 border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 dark:hover:border-indigo-600"
        )}
        style={{
          ...getBackgroundStyle(getGradientBg()),
          borderColor: getPrimaryColor() ? `${getPrimaryColor()}80` : undefined
        }}
        onClick={handleClick}
      >
        {notification.illustrationUrl && (
          <div className="absolute top-0 right-0 w-64 h-64 opacity-20">
            <Image
              src={notification.illustrationUrl}
              alt=""
              width={256}
              height={256}
              className="object-cover"
            />
          </div>
        )}
        <CardContent className="p-6 relative z-10">
          <div className="flex flex-col sm:flex-row items-start gap-4">
            {notification.illustrationUrl ? (
              <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 border-white dark:border-slate-800">
                <Image
                  src={notification.illustrationUrl}
                  alt=""
                  width={64}
                  height={64}
                  className="object-cover w-full h-full"
                />
              </div>
            ) : (
              <div 
                className={cn(
                  "w-16 h-16 rounded-xl flex items-center justify-center group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg flex-shrink-0",
                  !getPrimaryColor() && "bg-gradient-to-br from-indigo-500 to-purple-600"
                )}
                style={{
                  background: getPrimaryColor() && getSecondaryColor() 
                    ? `linear-gradient(to bottom right, ${getPrimaryColor()}, ${getSecondaryColor()})`
                    : getPrimaryColor()
                    ? getPrimaryColor()
                    : undefined
                }}
              >
                <TrendingUp className="w-8 h-8 text-white" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h3 
                  className={cn(
                    "font-bold text-xl transition-colors",
                    !getTextColor() && "text-slate-900 dark:text-slate-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400"
                  )}
                  style={{ color: getTextColor() || undefined }}
                >
                  {notification.title}
                </h3>
                <Badge 
                  variant="secondary" 
                  className={cn(
                    "border-0",
                    !getPrimaryColor() && "bg-gradient-to-r from-indigo-500 to-purple-500 text-white"
                  )}
                  style={{
                    background: getPrimaryColor() && getSecondaryColor()
                      ? `linear-gradient(to right, ${getPrimaryColor()}, ${getSecondaryColor()})`
                      : getPrimaryColor()
                      ? getPrimaryColor()
                      : undefined,
                    color: '#ffffff'
                  }}
                >
                  Novo
                </Badge>
              </div>
              <p 
                className={cn(
                  "text-sm sm:text-base leading-relaxed mb-4 font-medium",
                  !getTextColor() && "text-slate-700 dark:text-slate-300"
                )}
                style={{ color: getTextColor() || undefined }}
              >
                {notification.message}
              </p>
              {notification.link && (
                <Button
                  className={cn(
                    "font-medium shadow-md",
                    !getButtonBg() && "bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white"
                  )}
                  style={getButtonStyle()}
                >
                  {notification.ctaText || (notification.linkType === 'INTERNAL' ? 'Ver detalhes' : 'Abrir link')}
                  {notification.linkType === 'EXTERNAL' ? (
                    <ExternalLink className="w-4 h-4 ml-2" />
                  ) : (
                    <ArrowRight className="w-4 h-4 ml-2" />
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    )

    // Renderizar baseado no template
    switch (template) {
      case 'SOLID':
        return solidBanner
      case 'MINIMAL':
        return minimalBanner
      case 'ILLUSTRATED':
        return illustratedBanner
      case 'GRADIENT':
      default:
        return gradientBanner
    }
  }

  // Se não houver notificação destacada, exibir banner padrão
  return defaultBanner
}

