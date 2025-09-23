"use client"

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

interface CreateTicketDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onTicketCreated: () => void
}

const categories = [
  { value: 'GENERAL', label: 'Dúvida Geral', description: 'Perguntas sobre como usar a plataforma' },
  { value: 'TECHNICAL', label: 'Problema Técnico', description: 'Erros, bugs ou falhas no sistema' },
  { value: 'BILLING', label: 'Cobrança/Assinatura', description: 'Questões sobre pagamento ou plano' },
  { value: 'ACCOUNT', label: 'Problema na Conta', description: 'Login, senha ou dados da conta' },
  { value: 'BUG_REPORT', label: 'Reportar Bug', description: 'Comportamento inesperado do sistema' },
  { value: 'FEATURE_REQUEST', label: 'Sugestão', description: 'Ideias para melhorar a plataforma' }
]

export default function CreateTicketDialog({ open, onOpenChange, onTicketCreated }: CreateTicketDialogProps) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'GENERAL'
    // Removido priority - será inferido automaticamente
  })
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.title.trim() || !formData.description.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Por favor, preencha o título e a descrição.',
        variant: 'destructive'
      })
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          category: formData.category
          // Removido priority - será inferido automaticamente
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao criar ticket')
      }

      toast({
        title: 'Ticket criado com sucesso!',
        description: 'Seu ticket foi criado e nossa equipe será notificada.',
      })

      // Reset form
      setFormData({
        title: '',
        description: '',
        category: 'GENERAL'
      })

      onTicketCreated()

    } catch (error) {
      toast({
        title: 'Erro ao criar ticket',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-[600px] max-h-[90vh] p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-lg sm:text-xl">Criar Novo Ticket</DialogTitle>
          <DialogDescription className="text-sm sm:text-base">
            Descreva seu problema ou solicitação. Nossa equipe responderá o mais breve possível.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="category" className="text-sm sm:text-base">Categoria</Label>
              <Select value={formData.category} onValueChange={(value) => handleInputChange('category', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{category.label}</span>
                        <span className="text-xs text-gray-500">{category.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title" className="text-sm sm:text-base">Título *</Label>
            <Input
              id="title"
              placeholder="Resumo do seu problema ou solicitação"
              value={formData.title}
              onChange={(e) => handleInputChange('title', e.target.value)}
              maxLength={200}
              required
              className="text-sm sm:text-base"
            />
            <p className="text-xs text-gray-500">
              {formData.title.length}/200 caracteres
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm sm:text-base">Descrição *</Label>
            <Textarea
              id="description"
              placeholder="Descreva detalhadamente seu problema, incluindo passos para reproduzir (se aplicável), mensagens de erro, ou qualquer informação relevante..."
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              maxLength={2000}
              rows={4}
              required
              className="text-sm sm:text-base resize-none"
            />
            <p className="text-xs text-gray-500">
              {formData.description.length}/2000 caracteres
            </p>
          </div>

          <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2 text-sm sm:text-base">Dicas para um suporte mais eficiente:</h4>
            <ul className="text-xs sm:text-sm text-blue-800 space-y-1">
              <li>• Seja específico sobre o problema</li>
              <li>• Inclua passos para reproduzir o erro</li>
              <li>• Mencione qual navegador/dispositivo está usando</li>
              <li>• Anexe capturas de tela se relevante</li>
            </ul>
          </div>

          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="w-full sm:w-auto">
              {loading ? 'Criando...' : 'Criar Ticket'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
