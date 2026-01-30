"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import {
  User,
  Shield,
  Calendar,
  Lock,
  Mail,
  AlertTriangle,
  X,
  Check,
  Loader2,
  CreditCard,
  Bell,
  BarChart3,
  MessageSquare,
} from "lucide-react"
import Link from "next/link"
import { signOut } from "next-auth/react"

interface ProfileData {
  id: string
  name: string | null
  email: string
  subscriptionTier: 'FREE' | 'PREMIUM'
  premiumExpiresAt: string | null
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  hasActiveSubscription: boolean
  cancelAtPeriodEnd: boolean
  createdAt: string
  isPremium: boolean
}

export default function PerfilPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [profileData, setProfileData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  
  // Estados para formulários
  const [name, setName] = useState("")
  const [updatingName, setUpdatingName] = useState(false)
  
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [updatingPassword, setUpdatingPassword] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  
  const [cancellingSubscription, setCancellingSubscription] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  
  const [anonymizing, setAnonymizing] = useState(false)
  const [showAnonymizeDialog, setShowAnonymizeDialog] = useState(false)
  const [anonymizeConfirm, setAnonymizeConfirm] = useState(false)
  
  // Estados para preferências de notificações
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] = useState(true)
  const [updatingPreferences, setUpdatingPreferences] = useState(false)
  
  // Estado para banner de índices
  const [marketTickerHidden, setMarketTickerHidden] = useState(false)

  useEffect(() => {
    if (status === "loading") return
    if (!session) {
      router.push("/login")
      return
    }
    fetchProfile()
    fetchNotificationPreferences()
    checkMarketTickerStatus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, status, router])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/profile")
      if (response.ok) {
        const data = await response.json()
        setProfileData(data)
        setName(data.name || "")
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível carregar os dados do perfil",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Erro ao buscar perfil:", error)
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do perfil",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchNotificationPreferences = async () => {
    try {
      const response = await fetch("/api/user/preferences/notifications")
      if (response.ok) {
        const data = await response.json()
        setEmailNotificationsEnabled(data.emailNotificationsEnabled ?? true)
      }
    } catch (error) {
      console.error("Erro ao buscar preferências de notificações:", error)
    }
  }

  const checkMarketTickerStatus = () => {
    if (typeof window !== 'undefined') {
      const hidden = localStorage.getItem('market-ticker-banner-hidden-v2') === 'true'
      setMarketTickerHidden(hidden)
    }
  }

  const handleReenableMarketTicker = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('market-ticker-banner-hidden-v2')
      setMarketTickerHidden(false)
      // Disparar evento customizado para notificar outros componentes
      window.dispatchEvent(new Event('marketTickerVisibilityChange'))
      toast({
        title: "Sucesso",
        description: "Banner de índices reativado.",
      })
    }
  }

  const handleUpdateNotificationPreferences = async () => {
    try {
      setUpdatingPreferences(true)
      const response = await fetch("/api/user/preferences/notifications", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailNotificationsEnabled,
        }),
      })

      if (response.ok) {
        toast({
          title: "Sucesso",
          description: "Preferências de notificações atualizadas",
        })
      } else {
        throw new Error("Erro ao atualizar preferências")
      }
    } catch (error) {
      console.error("Erro ao atualizar preferências:", error)
      toast({
        title: "Erro",
        description: "Não foi possível atualizar as preferências",
        variant: "destructive",
      })
    } finally {
      setUpdatingPreferences(false)
    }
  }

  const handleUpdateName = async () => {
    if (!name.trim()) {
      toast({
        title: "Erro",
        description: "Nome não pode estar vazio",
        variant: "destructive",
      })
      return
    }

    try {
      setUpdatingName(true)
      const response = await fetch("/api/profile/update-name", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Sucesso",
          description: "Nome atualizado com sucesso",
        })
        setProfileData((prev) => prev ? { ...prev, name: data.name } : null)
      } else {
        toast({
          title: "Erro",
          description: data.error || "Erro ao atualizar nome",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Erro ao atualizar nome:", error)
      toast({
        title: "Erro",
        description: "Erro ao atualizar nome",
        variant: "destructive",
      })
    } finally {
      setUpdatingName(false)
    }
  }

  const handleUpdatePassword = async () => {
    if (newPassword.length < 8) {
      toast({
        title: "Erro",
        description: "A nova senha deve ter pelo menos 8 caracteres",
        variant: "destructive",
      })
      return
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem",
        variant: "destructive",
      })
      return
    }

    try {
      setUpdatingPassword(true)
      const response = await fetch("/api/profile/update-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Sucesso",
          description: "Senha atualizada com sucesso",
        })
        setShowPasswordDialog(false)
        setCurrentPassword("")
        setNewPassword("")
        setConfirmPassword("")
      } else {
        toast({
          title: "Erro",
          description: data.error || "Erro ao atualizar senha",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Erro ao atualizar senha:", error)
      toast({
        title: "Erro",
        description: "Erro ao atualizar senha",
        variant: "destructive",
      })
    } finally {
      setUpdatingPassword(false)
    }
  }

  const handleCancelSubscription = async () => {
    try {
      setCancellingSubscription(true)
      const response = await fetch("/api/profile/cancel-subscription", {
        method: "POST",
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Assinatura cancelada",
          description: data.message,
        })
        setShowCancelDialog(false)
        fetchProfile() // Atualizar dados
      } else {
        toast({
          title: "Erro",
          description: data.error || "Erro ao cancelar assinatura",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Erro ao cancelar assinatura:", error)
      toast({
        title: "Erro",
        description: "Erro ao cancelar assinatura",
        variant: "destructive",
      })
    } finally {
      setCancellingSubscription(false)
    }
  }

  const handleAnonymize = async () => {
    if (!anonymizeConfirm) {
      toast({
        title: "Confirmação necessária",
        description: "Você deve confirmar a anonimização",
        variant: "destructive",
      })
      return
    }

    try {
      setAnonymizing(true)
      const response = await fetch("/api/profile/anonymize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Conta anonimizada",
          description: data.message,
        })
        // Fazer logout e redirecionar
        await signOut({ callbackUrl: "/" })
      } else {
        toast({
          title: "Erro",
          description: data.error || "Erro ao anonimizar conta",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Erro ao anonimizar conta:", error)
      toast({
        title: "Erro",
        description: "Erro ao anonimizar conta",
        variant: "destructive",
      })
    } finally {
      setAnonymizing(false)
    }
  }

  if (status === "loading" || loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </div>
    )
  }

  if (!session || !profileData) {
    return null
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A"
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  // Usar isPremium diretamente do user-service (já considera fase Alfa e outros casos)
  const isPremiumActive = profileData.isPremium

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Meu Perfil
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          Gerencie suas informações pessoais e configurações da conta
        </p>
      </div>

      {/* Informações do Usuário */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Informações Pessoais
          </CardTitle>
          <CardDescription>
            Seus dados de cadastro e informações da conta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">
              Nome
            </label>
            <div className="flex gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome"
                className="flex-1"
              />
              <Button
                onClick={handleUpdateName}
                disabled={updatingName || name === profileData.name}
                size="sm"
              >
                {updatingName ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "Salvar"
                )}
              </Button>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">
              Email
            </label>
            <Input
              value={profileData.email}
              disabled
              className="bg-slate-50 dark:bg-slate-900"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Para alterar seu email, entre em contato com o{" "}
              <Link href="/suporte" className="text-blue-600 hover:underline">
                suporte
              </Link>
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 block">
              Senha
            </label>
            <Button
              variant="outline"
              onClick={() => setShowPasswordDialog(true)}
              className="w-full"
            >
              <Lock className="w-4 h-4 mr-2" />
              Alterar Senha
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Conversas com Ben */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Conversas com Ben
          </CardTitle>
          <CardDescription>
            Gerencie suas conversas com o assistente de IA
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href="/conversas-ben" className="flex items-center justify-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Ver Minhas Conversas com Ben
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* Status Premium */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Status Premium
          </CardTitle>
          <CardDescription>
            Informações sobre sua assinatura Premium
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
            <div className="flex items-center gap-3">
              {isPremiumActive ? (
                <Badge className="bg-green-600 text-white">
                  <Shield className="w-3 h-3 mr-1" />
                  Premium Ativo
                </Badge>
              ) : (
                <Badge variant="outline">
                  <X className="w-3 h-3 mr-1" />
                  Plano Gratuito
                </Badge>
              )}
            </div>
            {!isPremiumActive && (
              <Button asChild size="sm">
                <Link href="/planos">Assinar Premium</Link>
              </Button>
            )}
          </div>

          {isPremiumActive && (
            <>
              {profileData.premiumExpiresAt && (
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Premium válido até
                    </p>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {formatDate(profileData.premiumExpiresAt)}
                    </p>
                  </div>
                  <Calendar className="w-5 h-5 text-slate-400" />
                </div>
              )}

              {profileData.hasActiveSubscription && !profileData.cancelAtPeriodEnd && (
                <div className="p-4 border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                  <div className="flex items-start gap-3">
                    <CreditCard className="w-5 h-5 text-blue-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                        Assinatura Recorrente Ativa
                      </p>
                      <p className="text-xs text-blue-700 dark:text-blue-300 mb-3">
                        Sua assinatura será renovada automaticamente. Você pode cancelar a
                        recorrência mantendo o acesso até o fim do período atual.
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowCancelDialog(true)}
                        className="border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900"
                      >
                        Cancelar Recorrência
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {profileData.cancelAtPeriodEnd && (
                <div className="p-4 border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/20 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-orange-900 dark:text-orange-100 mb-1">
                        Recorrência Cancelada
                      </p>
                      <p className="text-xs text-orange-700 dark:text-orange-300">
                        Sua assinatura não será renovada. Você manterá acesso Premium até{" "}
                        {formatDate(profileData.premiumExpiresAt)}.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Preferências de Notificações */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Preferências de Notificações
          </CardTitle>
          <CardDescription>
            Configure como você deseja receber notificações
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Mail className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <label className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Receber notificações por email
                </label>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 ml-6">
                Quando desabilitado, você ainda receberá notificações na plataforma, mas não por email
              </p>
            </div>
            <Switch
              checked={emailNotificationsEnabled}
              onCheckedChange={setEmailNotificationsEnabled}
            />
          </div>
          <Button
            onClick={handleUpdateNotificationPreferences}
            disabled={updatingPreferences}
            className="w-full"
          >
            {updatingPreferences ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Salvando...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Salvar Preferências
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Preferências de Interface */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Preferências de Interface
          </CardTitle>
          <CardDescription>
            Configure como você deseja visualizar elementos da interface
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <BarChart3 className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                <label className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Banner de Índices do Mercado
                </label>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400 ml-6">
                {marketTickerHidden 
                  ? "O banner está oculto. Você pode reativá-lo clicando no botão abaixo."
                  : "Exibe índices internacionais e próprios no topo da página"}
              </p>
            </div>
            {marketTickerHidden && (
              <Button
                onClick={handleReenableMarketTicker}
                variant="outline"
                size="sm"
              >
                <Check className="w-4 h-4 mr-2" />
                Reativar Banner
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* LGPD - Anonimização */}
      <Card className="mb-6 border-red-200 dark:border-red-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertTriangle className="w-5 h-5" />
            Privacidade e Dados (LGPD)
          </CardTitle>
          <CardDescription>
            Anonimização de conta conforme Lei Geral de Proteção de Dados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 rounded-lg">
            <p className="text-sm text-red-900 dark:text-red-100 mb-3">
              <strong>Atenção:</strong> A anonimização é uma ação irreversível. Ao anonimizar sua conta:
            </p>
            <ul className="text-sm text-red-800 dark:text-red-200 space-y-2 mb-4 list-disc list-inside">
              <li>Seu nome e email serão anonimizados na base de dados</li>
              <li>Sua assinatura será cancelada (se houver)</li>
              <li>Você perderá acesso à sua conta permanentemente</li>
              <li>Esta ação não pode ser desfeita</li>
            </ul>
            <Button
              variant="destructive"
              onClick={() => setShowAnonymizeDialog(true)}
              className="w-full"
            >
              Anonimizar Minha Conta
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Disclaimer sobre troca de email */}
      <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-1">
                Precisa trocar seu email?
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Para alterar seu endereço de email, entre em contato com nosso{" "}
                <Link href="/suporte" className="underline font-medium">
                  suporte
                </Link>
                {" "}abrindo um ticket. Nossa equipe irá ajudá-lo com a alteração.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dialog de Alterar Senha */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar Senha</DialogTitle>
            <DialogDescription>
              Digite sua senha atual e a nova senha
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium mb-1 block">
                Senha Atual
              </label>
              <Input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Digite sua senha atual"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Nova Senha
              </label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Confirmar Nova Senha
              </label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Digite a nova senha novamente"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordDialog(false)
                setCurrentPassword("")
                setNewPassword("")
                setConfirmPassword("")
              }}
            >
              Cancelar
            </Button>
            <Button onClick={handleUpdatePassword} disabled={updatingPassword}>
              {updatingPassword ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Check className="w-4 h-4 mr-2" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Cancelar Assinatura */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancelar Recorrência da Assinatura</DialogTitle>
            <DialogDescription>
              Você tem certeza que deseja cancelar a recorrência da sua assinatura?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Ao cancelar a recorrência:
            </p>
            <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-2 list-disc list-inside mb-4">
              <li>Sua assinatura não será renovada automaticamente</li>
              <li>Você manterá acesso Premium até{" "}
                {profileData.premiumExpiresAt
                  ? formatDate(profileData.premiumExpiresAt)
                  : "o fim do período atual"}
              </li>
              <li>Após a expiração, você voltará ao plano gratuito</li>
            </ul>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
              Você pode assinar novamente a qualquer momento.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCancelDialog(false)}
            >
              Manter Assinatura
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancelSubscription}
              disabled={cancellingSubscription}
            >
              {cancellingSubscription ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <X className="w-4 h-4 mr-2" />
              )}
              Cancelar Recorrência
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Anonimização */}
      <Dialog open={showAnonymizeDialog} onOpenChange={setShowAnonymizeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-red-600 dark:text-red-400">
              Anonimizar Conta
            </DialogTitle>
            <DialogDescription>
              Esta ação é irreversível e você perderá acesso permanente à sua conta.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="p-4 border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 rounded-lg mb-4">
              <p className="text-sm font-medium text-red-900 dark:text-red-100 mb-2">
                O que acontecerá:
              </p>
              <ul className="text-xs text-red-800 dark:text-red-200 space-y-1 list-disc list-inside">
                <li>Seu nome e email serão anonimizados</li>
                <li>Sua assinatura será cancelada</li>
                <li>Você perderá acesso à conta</li>
                <li>Esta ação não pode ser desfeita</li>
              </ul>
            </div>
            <div className="flex items-start gap-2">
              <input
                type="checkbox"
                id="anonymize-confirm"
                checked={anonymizeConfirm}
                onChange={(e) => setAnonymizeConfirm(e.target.checked)}
                className="mt-1"
              />
              <label
                htmlFor="anonymize-confirm"
                className="text-sm text-slate-700 dark:text-slate-300 cursor-pointer"
              >
                Entendo que esta ação é irreversível e que perderei acesso permanente à minha conta.
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowAnonymizeDialog(false)
                setAnonymizeConfirm(false)
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleAnonymize}
              disabled={!anonymizeConfirm || anonymizing}
            >
              {anonymizing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <AlertTriangle className="w-4 h-4 mr-2" />
              )}
              Anonimizar Conta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

