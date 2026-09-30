"use client"

import { useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
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

const CATEGORIES = [
  { value: 'GENERAL', label: 'Dúvida geral', description: 'Como usar a plataforma' },
  { value: 'TECHNICAL', label: 'Problema técnico', description: 'Erros ou falhas no sistema' },
  { value: 'BILLING', label: 'Cobrança ou assinatura', description: 'Pagamento e plano' },
  { value: 'ACCOUNT', label: 'Conta', description: 'Login, senha ou dados cadastrais' },
  { value: 'BUG_REPORT', label: 'Reportar bug', description: 'Comportamento inesperado' },
  { value: 'FEATURE_REQUEST', label: 'Sugestão', description: 'Ideias para melhorar a plataforma' },
]

const MIN_TITLE = 5
const MAX_TITLE = 200
const MIN_DESCRIPTION = 10
const MAX_DESCRIPTION = 2000
const EMPTY_FORM = { title: '', description: '', category: 'GENERAL' }

export default function CreateTicketDialog({ open, onOpenChange, onTicketCreated }: CreateTicketDialogProps) {
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  // Sem DialogTrigger o Radix não sabe para onde devolver o foco: guarda o elemento que abriu o diálogo
  const returnFocusRef = useRef<HTMLElement | null>(null)
  useLayoutEffect(() => {
    if (open && document.activeElement instanceof HTMLElement && document.activeElement !== document.body) {
      returnFocusRef.current = document.activeElement
    }
  }, [open])
  const handleCloseAutoFocus = (event: Event) => {
    const target = returnFocusRef.current
    if (target?.isConnected) {
      event.preventDefault()
      target.focus()
    }
  }

  const update = (field: keyof typeof EMPTY_FORM, value: string) => setFormData((prev) => ({ ...prev, [field]: value }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const title = formData.title.trim()
    const description = formData.description.trim()
    if (title.length < MIN_TITLE || description.length < MIN_DESCRIPTION) {
      toast({
        title: 'Complete o chamado',
        description: `O título precisa de ao menos ${MIN_TITLE} caracteres e a descrição, de ${MIN_DESCRIPTION}.`,
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          category: formData.category,
        }),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao abrir chamado')
      }
      toast({ title: 'Chamado aberto', description: 'A equipe foi avisada e responde por aqui.' })
      setFormData(EMPTY_FORM)
      onTicketCreated()
    } catch (error) {
      toast({
        title: 'Não foi possível abrir o chamado',
        description: error instanceof Error ? error.message : 'Tente novamente em instantes.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" onCloseAutoFocus={handleCloseAutoFocus}>
        <form onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Novo chamado</DialogTitle>
            <DialogDescription>Descreva o problema ou a solicitação. A resposta chega por aqui e por e-mail.</DialogDescription>
          </DialogHeader>

          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="ticket-category">Categoria</Label>
            <Select value={formData.category} onValueChange={(value) => update('category', value)}>
              <SelectTrigger id="ticket-category" className="w-full">
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label}
                    <span className="text-muted-foreground"> · {category.description}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="ticket-title">Título</Label>
            <Input
              id="ticket-title"
              placeholder="Resumo do problema ou da solicitação"
              value={formData.title}
              onChange={(e) => update('title', e.target.value)}
              minLength={MIN_TITLE}
              maxLength={MAX_TITLE}
              required
              aria-describedby="ticket-title-count"
            />
            <p id="ticket-title-count" className="text-xs text-muted-foreground tabular-nums">
              Mínimo de {MIN_TITLE} caracteres · {formData.title.length}/{MAX_TITLE}
            </p>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="ticket-description">Descrição</Label>
            <Textarea
              id="ticket-description"
              placeholder="O que aconteceu, os passos para reproduzir, mensagens de erro, navegador e dispositivo."
              value={formData.description}
              onChange={(e) => update('description', e.target.value)}
              minLength={MIN_DESCRIPTION}
              maxLength={MAX_DESCRIPTION}
              rows={5}
              required
              className="resize-none"
              aria-describedby="ticket-description-count"
            />
            <p id="ticket-description-count" className="text-xs text-muted-foreground tabular-nums">
              Mínimo de {MIN_DESCRIPTION} caracteres · {formData.description.length}/{MAX_DESCRIPTION}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading || !formData.title.trim() || !formData.description.trim()}>
              {loading && <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />}
              Abrir chamado
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
