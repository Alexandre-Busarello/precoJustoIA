"use client"

import { signOut } from "next-auth/react"
import Link from "next/link"
import { ChevronDown, LogOut } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { ThemeToggle } from "@/components/theme-toggle"
import { getAccountLinks } from "@/lib/navigation"
import { THEME_TOGGLE_ENABLED } from "@/lib/theme"

interface UserProfileDropdownProps {
  userName?: string | null
  userEmail?: string | null
  isPremium: boolean
  isTrialActive?: boolean
  trialDaysRemaining?: number | null
  subscriptionTier?: 'FREE' | 'PREMIUM' | 'VIP'
}

/** Iniciais do nome (ou do e-mail) para o avatar. */
export function getUserInitials(userName?: string | null, userEmail?: string | null): string {
  if (userName) {
    return userName
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }
  if (userEmail) return userEmail.slice(0, 2).toUpperCase()
  return 'U'
}

/** Rótulo do plano atual em texto simples (sem badge colorido). */
export function getPlanLabel({
  isPremium,
  isTrialActive,
  subscriptionTier,
  trialDaysRemaining,
}: {
  isPremium: boolean
  isTrialActive: boolean
  subscriptionTier: 'FREE' | 'PREMIUM' | 'VIP'
  trialDaysRemaining: number | null
}): string {
  if (isTrialActive && subscriptionTier === 'FREE') {
    if (trialDaysRemaining !== null && trialDaysRemaining > 1) return `Premium em teste · ${trialDaysRemaining} dias restantes`
    return 'Premium em teste · termina hoje'
  }
  return isPremium ? 'Plano Premium' : 'Plano gratuito'
}

/** Menu do avatar: dados da conta, links de conta, tema e sair. */
export function UserProfileDropdown({
  userName,
  userEmail,
  isPremium,
  isTrialActive = false,
  trialDaysRemaining = null,
  subscriptionTier = 'FREE'
}: UserProfileDropdownProps) {
  const isPremiumViaTrial = isTrialActive && subscriptionTier === 'FREE'
  const displayName = userName || userEmail?.split('@')[0] || 'Usuário'
  const initials = getUserInitials(userName, userEmail)
  const planLabel = getPlanLabel({ isPremium, isTrialActive, subscriptionTier, trialDaysRemaining })
  const links = getAccountLinks(isPremium).flatMap((link) => (link.href ? [{ label: link.label, href: link.href }] : []))

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-11 gap-2 px-1.5 md:h-10" aria-label="Abrir menu da conta">
          <Avatar className="size-8">
            <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">{initials}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[140px] truncate text-sm font-medium xl:inline">{displayName}</span>
          <ChevronDown className="hidden size-4 text-muted-foreground xl:block" strokeWidth={1.75} aria-hidden="true" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
          {userEmail && <p className="truncate text-xs text-muted-foreground">{userEmail}</p>}
          <p className="mt-1 text-xs text-muted-foreground">{planLabel}</p>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        {links.map((link) => (
          <DropdownMenuItem key={link.label} asChild>
            <Link href={link.href} className="cursor-pointer">
              {link.label}
            </Link>
          </DropdownMenuItem>
        ))}

        {(!isPremium || isPremiumViaTrial) && (
          <DropdownMenuItem asChild>
            <Link href="/planos" className="cursor-pointer font-medium text-brand focus:text-brand">
              {isPremiumViaTrial ? 'Assinar o Premium' : 'Conhecer o Premium'}
            </Link>
          </DropdownMenuItem>
        )}

        {THEME_TOGGLE_ENABLED && (
          <>
            <DropdownMenuSeparator />
            <div className="px-2 py-1.5">
              <p className="mb-1.5 text-xs text-muted-foreground">Tema</p>
              <ThemeToggle variant="list" />
            </div>
          </>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem onClick={() => signOut()} className="cursor-pointer">
          <LogOut className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
