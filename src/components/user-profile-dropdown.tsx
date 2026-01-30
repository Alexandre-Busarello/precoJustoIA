"use client"

import { signOut } from "next-auth/react"
import Link from "next/link"
import { 
  LayoutDashboard, 
  Bell, 
  CreditCard, 
  LogOut, 
  User,
  Sparkles,
  ChevronDown,
  Clock,
  Gift,
  Settings,
  MessageSquare
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"

interface UserProfileDropdownProps {
  userName?: string | null
  userEmail?: string | null
  isPremium: boolean
  isTrialActive?: boolean
  trialDaysRemaining?: number | null
  subscriptionTier?: 'FREE' | 'PREMIUM' | 'VIP'
}

export function UserProfileDropdown({ 
  userName, 
  userEmail,
  isPremium,
  isTrialActive = false,
  trialDaysRemaining = null,
  subscriptionTier = 'FREE'
}: UserProfileDropdownProps) {
  // Determinar se é Premium via trial ou assinatura
  const isPremiumViaTrial = isTrialActive && subscriptionTier === 'FREE'
  // Extrair iniciais do nome ou email
  const getInitials = () => {
    if (userName) {
      return userName
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    if (userEmail) {
      return userEmail.slice(0, 2).toUpperCase()
    }
    return 'U'
  }

  const displayName = userName || userEmail?.split('@')[0] || 'Usuário'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          className="flex items-center gap-2 h-auto px-2 py-1.5 hover:bg-accent"
        >
          <Avatar className="h-8 w-8 border-2 border-primary/20">
            <AvatarFallback className={`text-xs font-semibold ${
              isPremium 
                ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white' 
                : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
            }`}>
              {getInitials()}
            </AvatarFallback>
          </Avatar>
          
          <div className="hidden xl:flex flex-col items-start min-w-0">
            <span className="text-sm font-medium leading-none truncate max-w-[120px]">
              {displayName}
            </span>
            {isPremiumViaTrial ? (
              <div className="flex items-center gap-1 mt-0.5">
                <Badge 
                  variant="secondary"
                  className="text-[10px] h-4 px-1.5 bg-gradient-to-r from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 border border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300"
                >
                  <Gift className="w-2.5 h-2.5 mr-0.5" />
                  Trial
                </Badge>
                <Badge 
                  variant="default"
                  className="text-[10px] h-4 px-1.5 bg-gradient-to-r from-violet-600 to-purple-600 border-0"
                >
                  <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                  Premium
                </Badge>
              </div>
            ) : (
              <Badge 
                variant={isPremium ? "default" : "secondary"} 
                className={`mt-0.5 text-[10px] h-4 px-1.5 ${
                  isPremium 
                    ? 'bg-gradient-to-r from-violet-600 to-purple-600 border-0' 
                    : ''
                }`}
              >
                {isPremium ? (
                  <>
                    <Sparkles className="w-2.5 h-2.5 mr-0.5" />
                    Premium
                  </>
                ) : (
                  'Gratuito'
                )}
              </Badge>
            )}
          </div>
          
          <ChevronDown className="h-4 w-4 text-muted-foreground hidden xl:block" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-64">
        {/* User Info Header */}
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10 border-2 border-primary/20">
              <AvatarFallback className={`text-sm font-semibold ${
                isPremium 
                  ? 'bg-gradient-to-br from-violet-500 to-purple-600 text-white' 
                  : 'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
              }`}>
                {getInitials()}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex flex-col space-y-1 flex-1 min-w-0">
              <p className="text-sm font-medium leading-none truncate">
                {displayName}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {userEmail}
              </p>
              {isPremiumViaTrial ? (
                <div className="flex flex-col gap-1.5 mt-1">
                  <div className="flex items-center gap-1.5">
                    <Badge 
                      variant="secondary"
                      className="text-xs bg-gradient-to-r from-violet-100 to-purple-100 dark:from-violet-900/30 dark:to-purple-900/30 border border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300"
                    >
                      <Gift className="w-3 h-3 mr-1" />
                      Trial Premium
                    </Badge>
                    <Badge 
                      variant="default"
                      className="text-xs bg-gradient-to-r from-violet-600 to-purple-600 border-0"
                    >
                      <Sparkles className="w-3 h-3 mr-1" />
                      Ativo
                    </Badge>
                  </div>
                  {trialDaysRemaining !== null && (
                    <div className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-400">
                      <Clock className="w-3 h-3" />
                      <span className="font-medium">
                        {trialDaysRemaining === 1 
                          ? 'Último dia!' 
                          : `${trialDaysRemaining} dias restantes`}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <Badge 
                  variant={isPremium ? "default" : "secondary"} 
                  className={`mt-1 text-xs w-fit ${
                    isPremium 
                      ? 'bg-gradient-to-r from-violet-600 to-purple-600 border-0' 
                      : ''
                  }`}
                >
                  {isPremium ? (
                    <>
                      <Sparkles className="w-3 h-3 mr-1" />
                      Premium
                    </>
                  ) : (
                    'Plano Gratuito'
                  )}
                </Badge>
              )}
            </div>
          </div>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        {/* Navigation Links */}
        <DropdownMenuItem asChild>
          <Link href="/dashboard" className="cursor-pointer">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <Link href="/dashboard/subscriptions" className="cursor-pointer">
            <Bell className="mr-2 h-4 w-4" />
            Minhas Inscrições
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <Link href="/dashboard/monitoramentos-customizados" className="cursor-pointer">
            <Settings className="mr-2 h-4 w-4" />
            Monitoramentos Customizados
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <Link href="/perfil" className="cursor-pointer">
            <User className="mr-2 h-4 w-4" />
            Perfil
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuItem asChild>
          <Link href="/conversas-ben" className="cursor-pointer">
            <MessageSquare className="mr-2 h-4 w-4" />
            Minhas Conversas com Ben
          </Link>
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        {/* Upgrade CTA */}
        {(!isPremium || isPremiumViaTrial) && (
          <>
            <DropdownMenuItem asChild>
              <Link 
                href="/checkout" 
                className={`cursor-pointer ${
                  isPremiumViaTrial
                    ? 'bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 hover:from-violet-100 hover:to-purple-100 dark:hover:from-violet-950/50 dark:hover:to-purple-950/50 border border-violet-200 dark:border-violet-800'
                    : 'bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/30 dark:to-purple-950/30 hover:from-violet-100 hover:to-purple-100 dark:hover:from-violet-950/50 dark:hover:to-purple-950/50'
                }`}
              >
                <CreditCard className={`mr-2 h-4 w-4 ${isPremiumViaTrial ? 'text-violet-600 dark:text-violet-400' : 'text-violet-600'}`} />
                <span className={`font-medium ${isPremiumViaTrial ? 'text-violet-600 dark:text-violet-400' : 'text-violet-600 dark:text-violet-400'}`}>
                  {isPremiumViaTrial ? 'Converter para Premium' : 'Fazer Upgrade'}
                </span>
              </Link>
            </DropdownMenuItem>
            {isPremiumViaTrial && trialDaysRemaining !== null && (
              <div className="px-2 py-1.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>
                    {trialDaysRemaining === 1 
                      ? 'Seu trial termina hoje!' 
                      : `Trial expira em ${trialDaysRemaining} dias`}
                  </span>
                </div>
              </div>
            )}
            <DropdownMenuSeparator />
          </>
        )}
        
        {/* Logout */}
        <DropdownMenuItem 
          onClick={() => signOut()}
          className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

