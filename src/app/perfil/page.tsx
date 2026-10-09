"use client"

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { ChevronRight, Loader2 } from "lucide-react"
import { PageHeader } from "@/components/page-header"
import { SectionHeader } from "@/components/ui/section-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ThemeToggle } from "@/components/theme-toggle"
import { useToast } from "@/hooks/use-toast"
import { usePremiumStatus } from "@/hooks/use-premium-status"
import { THEME_TOGGLE_ENABLED } from "@/lib/theme"
import { formatDate } from "@/lib/format"

interface ProfileData {
  id: string
  name: string | null
  email: string
  subscriptionTier: "FREE" | "PREMIUM" | "VIP"
  premiumExpiresAt: string | null
  stripeCurrentPeriodEnd: string | null
  hasActiveSubscription: boolean
  cancelAtPeriodEnd: boolean
  isPremium: boolean
}

/** Seção da página de conta: título + bloco com linhas separadas por borda fina. */
function AccountSection({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: ReactNode
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 space-y-3">
      <SectionHeader id={`${id}-title`} title={title} description={description} />
      <div className="divide-y divide-border rounded-lg border border-border bg-card">{children}</div>
    </section>
  )
}

/** Linha de configuração: rótulo e ajuda à esquerda, controle à direita (abaixo no mobile). */
function SettingRow({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: ReactNode
  hint?: ReactNode
  htmlFor?: string
  children?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-5">
      <div className="min-w-0 space-y-0.5">
        {htmlFor ? (
          <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
            {label}
          </Label>
        ) : (
          <p className="text-sm font-medium text-foreground">{label}</p>
        )}
        {hint && <div className="text-sm text-muted-foreground">{hint}</div>}
      </div>
      {children && <div className="flex shrink-0 flex-wrap items-center gap-2">{children}</div>}
    </div>
  )
}

function LinkRow({ href, title, description }: { href: string; title: string; description: string }) {
  return (
    <Link
      href={href}
      className="flex min-h-14 items-center gap-3 p-4 transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:outline-none sm:px-5"
    >
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-sm text-muted-foreground">{description}</span>
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
    </Link>
  )
}

function ProfileSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Carregando conta">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-40 w-full" />
        </div>
      ))}
    </div>
  )
}

export default function PerfilPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const { isTrialActive, trialEndsAt } = usePremiumStatus()

  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  const [name, setName] = useState("")
  const [updatingName, setUpdatingName] = useState(false)

  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [updatingPassword, setUpdatingPassword] = useState(false)

  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [cancellingSubscription, setCancellingSubscription] = useState(false)

  const [showAnonymizeDialog, setShowAnonymizeDialog] = useState(false)
  const [anonymizeConfirm, setAnonymizeConfirm] = useState(false)
  const [anonymizing, setAnonymizing] = useState(false)

  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true)
  const [updatingPreferences, setUpdatingPreferences] = useState(false)

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true)
      setLoadError(false)
      const response = await fetch("/api/profile")
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = (await response.json()) as ProfileData
      setProfileData(data)
      setName(data.name || "")
    } catch (error) {
      console.error("Erro ao buscar perfil:", error)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchNotificationPreferences = useCallback(async () => {
    try {
      const response = await fetch("/api/user/preferences/notifications")
      if (response.ok) {
        const data = await response.json()
        setEmailNotificationsEnabled(data.emailNotificationsEnabled ?? true)
      }
    } catch (error) {
      console.error("Erro ao buscar preferências de notificações:", error)
    }
  }, [])

  useEffect(() => {
    if (status === "loading") return
    if (!session) {
      router.replace("/login?callbackUrl=/perfil")
      return
    }
    fetchProfile()
    fetchNotificationPreferences()
  }, [session, status, router, fetchProfile, fetchNotificationPreferences])

  // O conteúdo chega depois do carregamento: rola até a âncora (ex.: /perfil#assinatura) quando ela existir
  useEffect(() => {
    if (!profileData) return
    const hash = window.location.hash.slice(1)
    if (!hash) return
    requestAnimationFrame(() => document.getElementById(hash)?.scrollIntoView({ block: "start" }))
  }, [profileData])

  const handleToggleEmailNotifications = async (enabled: boolean) => {
    setEmailNotificationsEnabled(enabled)
    setUpdatingPreferences(true)
    try {
      const response = await fetch("/api/user/preferences/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailNotificationsEnabled: enabled }),
      })
      if (!response.ok) throw new Error("Erro ao atualizar preferências")
      toast({ title: enabled ? "E-mails de notificação ativados" : "E-mails de notificação desativados" })
    } catch (error) {
      console.error("Erro ao atualizar preferências:", error)
      setEmailNotificationsEnabled(!enabled)
      toast({ title: "Não foi possível salvar", description: "Tente novamente em instantes.", variant: "destructive" })
    } finally {
      setUpdatingPreferences(false)
    }
  }

  const handleUpdateName = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      toast({ title: "Informe um nome", variant: "destructive" })
      return
    }
    try {
      setUpdatingName(true)
      const response = await fetch("/api/profile/update-name", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Erro ao atualizar nome")
      toast({ title: "Nome atualizado" })
      setProfileData((prev) => (prev ? { ...prev, name: data.name } : prev))
    } catch (error) {
      console.error("Erro ao atualizar nome:", error)
      toast({
        title: "Não foi possível atualizar o nome",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      })
    } finally {
      setUpdatingName(false)
    }
  }

  const resetPasswordForm = () => {
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    setPasswordError(null)
  }

  const handleUpdatePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (newPassword.length < 8) {
      setPasswordError("A nova senha precisa ter pelo menos 8 caracteres.")
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("A confirmação não confere com a nova senha.")
      return
    }
    try {
      setUpdatingPassword(true)
      setPasswordError(null)
      const response = await fetch("/api/profile/update-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await response.json()
      if (!response.ok) {
        setPasswordError(data.error || "Não foi possível atualizar a senha.")
        return
      }
      toast({ title: "Senha atualizada" })
      setShowPasswordDialog(false)
      resetPasswordForm()
    } catch (error) {
      console.error("Erro ao atualizar senha:", error)
      setPasswordError("Não foi possível atualizar a senha. Tente novamente.")
    } finally {
      setUpdatingPassword(false)
    }
  }

  const handleCancelSubscription = async () => {
    try {
      setCancellingSubscription(true)
      const response = await fetch("/api/profile/cancel-subscription", { method: "POST" })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Erro ao cancelar a renovação")
      toast({ title: "Renovação automática cancelada", description: data.message })
      setShowCancelDialog(false)
      fetchProfile()
    } catch (error) {
      console.error("Erro ao cancelar assinatura:", error)
      toast({
        title: "Não foi possível cancelar a renovação",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      })
    } finally {
      setCancellingSubscription(false)
    }
  }

  const handleAnonymize = async () => {
    if (!anonymizeConfirm) return
    try {
      setAnonymizing(true)
      const response = await fetch("/api/profile/anonymize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Erro ao anonimizar conta")
      toast({ title: "Conta anonimizada", description: data.message })
      await signOut({ callbackUrl: "/" })
    } catch (error) {
      console.error("Erro ao anonimizar conta:", error)
      toast({
        title: "Não foi possível anonimizar a conta",
        description: error instanceof Error ? error.message : undefined,
        variant: "destructive",
      })
    } finally {
      setAnonymizing(false)
    }
  }

  const header = <PageHeader title="Minha conta" description="Dados de acesso, assinatura e preferências." />

  if (status === "loading" || (loading && !profileData)) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:py-8">
        {header}
        <ProfileSkeleton />
      </div>
    )
  }

  if (!session) return null

  if (loadError || !profileData) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 sm:py-8">
        {header}
        <div role="alert" className="space-y-3 rounded-lg border border-border bg-card p-6">
          <p className="text-sm font-medium text-foreground">Não foi possível carregar os dados da conta.</p>
          <Button variant="outline" onClick={fetchProfile}>
            Tentar novamente
          </Button>
        </div>
      </div>
    )
  }

  const isPremiumActive = profileData.isPremium
  const renews = profileData.hasActiveSubscription && !profileData.cancelAtPeriodEnd
  const periodEnd = profileData.stripeCurrentPeriodEnd ?? profileData.premiumExpiresAt
  const planLabel = isTrialActive ? "Teste Premium" : isPremiumActive ? "Premium" : "Gratuito"

  let planDateLabel: string | null = null
  let planDate: string | null = null
  if (isTrialActive && trialEndsAt) {
    planDateLabel = "Teste termina em"
    planDate = formatDate(trialEndsAt, { style: "datetime" })
  } else if (isPremiumActive && renews && periodEnd) {
    planDateLabel = "Próxima renovação"
    planDate = formatDate(periodEnd)
  } else if (isPremiumActive && profileData.premiumExpiresAt) {
    planDateLabel = "Acesso Premium até"
    planDate = formatDate(profileData.premiumExpiresAt)
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-10 px-4 py-6 sm:py-8">
      {header}

      <AccountSection id="conta" title="Conta">
        <form onSubmit={handleUpdateName} className="grid gap-2 p-4 sm:px-5">
          <Label htmlFor="perfil-nome" className="text-sm font-medium text-foreground">
            Nome
          </Label>
          <div className="flex gap-2">
            <Input
              id="perfil-nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              autoComplete="name"
              className="min-w-0 flex-1"
            />
            <Button type="submit" variant="outline" disabled={updatingName || name.trim() === (profileData.name ?? "")}>
              {updatingName && <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />}
              Salvar
            </Button>
          </div>
        </form>
        <div className="grid gap-2 p-4 sm:px-5">
          <Label htmlFor="perfil-email" className="text-sm font-medium text-foreground">
            E-mail
          </Label>
          <Input id="perfil-email" value={profileData.email} readOnly disabled />
          <p className="text-sm text-muted-foreground">
            Para trocar o e-mail, abra um chamado no{" "}
            <Link href="/suporte" className="font-medium text-brand underline-offset-4 hover:underline">
              suporte
            </Link>
            .
          </p>
        </div>
        <SettingRow label="Senha" hint="Use pelo menos 8 caracteres.">
          <Button variant="outline" onClick={() => setShowPasswordDialog(true)}>
            Alterar senha
          </Button>
        </SettingRow>
        <LinkRow href="/conversas-ben" title="Conversas com o Ben" description="Histórico das suas conversas com o assistente." />
      </AccountSection>

      <AccountSection id="assinatura" title="Assinatura">
        <SettingRow
          label="Plano"
          hint={
            isPremiumActive
              ? renews
                ? "A assinatura renova automaticamente. Você pode cancelar a renovação e manter o acesso até o fim do período."
                : profileData.cancelAtPeriodEnd
                  ? "A renovação automática foi cancelada."
                  : undefined
              : "Rankings avançados, backtest, alertas de preço e análises com IA fazem parte do Premium."
          }
        >
          <Badge variant={isPremiumActive ? "brand" : "neutral"}>{planLabel}</Badge>
        </SettingRow>
        {planDateLabel && planDate && (
          <SettingRow label={planDateLabel}>
            <span className="text-sm font-medium text-foreground tabular-nums">{planDate}</span>
          </SettingRow>
        )}
        {profileData.cancelAtPeriodEnd && isPremiumActive && (
          <div role="status" className="bg-warning-subtle p-4 text-sm text-foreground sm:px-5">
            Sua assinatura não será renovada. O acesso Premium continua até{" "}
            <span className="font-medium tabular-nums">{formatDate(profileData.premiumExpiresAt)}</span>.
          </div>
        )}
        {(!isPremiumActive || isTrialActive || renews) && (
          <div className="flex flex-wrap gap-2 p-4 sm:px-5">
            {(!isPremiumActive || isTrialActive) && (
              <Button asChild>
                <Link href="/planos">Ver planos</Link>
              </Button>
            )}
            {renews && (
              <Button variant="outline" onClick={() => setShowCancelDialog(true)}>
                Cancelar renovação automática
              </Button>
            )}
          </div>
        )}
        <LinkRow
          href="/dashboard/subscriptions"
          title="Alertas de preço"
          description="Alertas simples por ticker: um e-mail quando o ativo mudar de forma relevante."
        />
        <LinkRow
          href="/dashboard/monitoramentos-customizados"
          title="Monitoramentos"
          description="Alertas avançados por preço ou indicador."
        />
      </AccountSection>

      <AccountSection id="preferencias" title="Preferências">
        <SettingRow
          label="Notificações por e-mail"
          htmlFor="perfil-email-notificacoes"
          hint="Desativado, você continua recebendo as notificações dentro da plataforma."
        >
          <Switch
            id="perfil-email-notificacoes"
            checked={emailNotificationsEnabled}
            onCheckedChange={handleToggleEmailNotifications}
            disabled={updatingPreferences}
          />
        </SettingRow>
        {THEME_TOGGLE_ENABLED && (
          <SettingRow label="Tema" hint="Claro, escuro ou igual ao sistema.">
            <ThemeToggle variant="list" className="w-full sm:w-72" />
          </SettingRow>
        )}
      </AccountSection>

      <AccountSection id="privacidade" title="Privacidade e dados" description="Direitos previstos na LGPD.">
        <SettingRow
          label="Anonimizar conta"
          hint="Seu nome e e-mail são anonimizados, a assinatura é cancelada e o acesso à conta é encerrado. Não pode ser desfeito."
        >
          <Button variant="outline" className="text-negative hover:text-negative" onClick={() => setShowAnonymizeDialog(true)}>
            Anonimizar conta
          </Button>
        </SettingRow>
      </AccountSection>

      <Dialog
        open={showPasswordDialog}
        onOpenChange={(open) => {
          setShowPasswordDialog(open)
          if (!open) resetPasswordForm()
        }}
      >
        <DialogContent>
          <form onSubmit={handleUpdatePassword} className="grid min-w-0 gap-4">
            <DialogHeader>
              <DialogTitle>Alterar senha</DialogTitle>
              <DialogDescription>Informe a senha atual e escolha uma nova.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-1.5">
              <Label htmlFor="senha-atual">Senha atual</Label>
              <Input
                id="senha-atual"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="senha-nova">Nova senha</Label>
              <Input
                id="senha-nova"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                required
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="senha-confirmacao">Confirmar nova senha</Label>
              <Input
                id="senha-confirmacao"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                aria-describedby={passwordError ? "senha-erro" : undefined}
                required
              />
            </div>
            {passwordError && (
              <p id="senha-erro" role="alert" className="text-sm text-negative">
                {passwordError}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setShowPasswordDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={updatingPassword}>
                {updatingPassword && <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />}
                Salvar senha
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar a renovação automática?</DialogTitle>
            <DialogDescription>
              O acesso Premium continua até{" "}
              {profileData.premiumExpiresAt ? formatDate(profileData.premiumExpiresAt) : "o fim do período atual"}. Depois, a
              conta volta ao plano gratuito. Você pode assinar de novo quando quiser.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCancelDialog(false)}>
              Manter assinatura
            </Button>
            <Button variant="destructive" onClick={handleCancelSubscription} disabled={cancellingSubscription}>
              {cancellingSubscription && <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />}
              Cancelar renovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showAnonymizeDialog}
        onOpenChange={(open) => {
          setShowAnonymizeDialog(open)
          if (!open) setAnonymizeConfirm(false)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Anonimizar conta</DialogTitle>
            <DialogDescription>Esta ação é irreversível.</DialogDescription>
          </DialogHeader>
          <ul className="list-disc space-y-1 pl-5 text-sm text-foreground marker:text-muted-foreground">
            <li>Seu nome e e-mail são anonimizados.</li>
            <li>Sua assinatura, se houver, é cancelada.</li>
            <li>Você perde o acesso à conta de forma permanente.</li>
          </ul>
          <div className="flex items-start gap-3">
            <Checkbox
              id="anonymize-confirm"
              checked={anonymizeConfirm}
              onCheckedChange={(checked) => setAnonymizeConfirm(checked === true)}
              className="mt-0.5"
            />
            <Label htmlFor="anonymize-confirm" className="text-sm leading-5 font-normal text-foreground">
              Entendo que esta ação é irreversível e que perderei o acesso à minha conta.
            </Label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAnonymizeDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleAnonymize} disabled={!anonymizeConfirm || anonymizing}>
              {anonymizing && <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />}
              Anonimizar conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
