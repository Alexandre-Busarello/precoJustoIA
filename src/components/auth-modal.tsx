'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  User, 
  Mail, 
  CheckCircle, 
  Crown, 
  Zap,
  TrendingUp,
  Eye
} from 'lucide-react'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  type: 'register' | 'upgrade'
  strategy: string
}

export function AuthModal({ isOpen, onClose, type, strategy }: AuthModalProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleRegister = async () => {
    setIsLoading(true)
    // Redirect para página de registro
    window.location.href = '/register?redirect=' + encodeURIComponent(window.location.pathname)
  }

  const handleUpgrade = async () => {
    setIsLoading(true)
    // Redirect para página de checkout
    window.location.href = '/checkout?redirect=' + encodeURIComponent(window.location.pathname)
  }

  if (type === 'register') {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full mx-auto mb-4">
              <User className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
            <DialogTitle className="text-center text-xl">
              Análise {strategy} Bloqueada
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              Crie sua conta gratuita para acessar análises avançadas de investimento e evitar armadilhas do mercado.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-6">
            <div className="flex items-center space-x-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm text-green-800 dark:text-green-200">
                Análise Benjamin Graham
              </span>
            </div>
            
            <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Crown className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Anti-Dividend Trap (Premium)
              </span>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Crown className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Value Investing (Premium)
              </span>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <Crown className="w-5 h-5 text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Fórmula Mágica (Premium)
              </span>
            </div>
          </div>

          <div className="flex flex-col space-y-3">
            <Button 
              onClick={handleRegister} 
              disabled={isLoading}
              className="w-full flex items-center justify-center space-x-2"
            >
              <Mail className="w-4 h-4" />
              <span>{isLoading ? 'Redirecionando...' : 'Criar Conta Gratuita'}</span>
            </Button>
            
            <Button 
              variant="ghost" 
              onClick={onClose}
              className="w-full text-sm"
            >
              Continuar sem conta
            </Button>
          </div>

          <div className="text-center mt-4">
            <p className="text-xs text-muted-foreground">
              100% gratuito • Sem cartão de crédito
            </p>
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  // Modal de Upgrade Premium
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mx-auto mb-4">
            <Crown className="w-8 h-8 text-white" />
          </div>
          <DialogTitle className="text-center text-xl">
            Upgrade para Premium
          </DialogTitle>
          <DialogDescription className="text-center text-base">
            Acesse a estratégia completa {strategy} e outras funcionalidades exclusivas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-6">
          <div className="flex items-center justify-between p-3 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center space-x-3">
              <Zap className="w-5 h-5 text-orange-600" />
              <span className="text-sm font-medium">Fórmula Mágica</span>
            </div>
            <Badge className="bg-gradient-to-r from-yellow-600 to-orange-600 text-white border-0">
              Novo!
            </Badge>
          </div>

          <div className="flex items-center space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <CheckCircle className="w-5 h-5 text-blue-600" />
            <span className="text-sm text-blue-800 dark:text-blue-200">
              Todas as estratégias desbloqueadas
            </span>
          </div>

          <div className="flex items-center space-x-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <Eye className="w-5 h-5 text-green-600" />
            <span className="text-sm text-green-800 dark:text-green-200">
              Análises detalhadas com IA
            </span>
          </div>

          <div className="flex items-center space-x-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <TrendingUp className="w-5 h-5 text-purple-600" />
            <span className="text-sm text-purple-800 dark:text-purple-200">
              Backtests de carteira
            </span>
          </div>
        </div>

        <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/10 dark:to-orange-900/10 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800 mb-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-yellow-600 to-orange-600">
              R$ 21,90
            </div>
            <div className="text-sm text-muted-foreground">por mês • PIX ou Cartão</div>
          </div>
        </div>

        <div className="flex flex-col space-y-3">
          <Button 
            onClick={handleUpgrade}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white border-0 flex items-center justify-center space-x-2"
          >
            <Crown className="w-4 h-4" />
            <span>{isLoading ? 'Redirecionando...' : 'Upgrade Premium'}</span>
          </Button>
          
          <Button 
            variant="ghost" 
            onClick={onClose}
            className="w-full text-sm"
          >
            Continuar com plano atual
          </Button>
        </div>

        <div className="text-center mt-4">
          <p className="text-xs text-muted-foreground">
            Cancele a qualquer momento • Suporte prioritário
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
