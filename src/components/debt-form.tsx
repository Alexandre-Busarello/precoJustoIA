'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

export interface DebtFormData {
  name: string
  balance: number
  interestRateAnnual: number
  termMonths: number
  monthlyPayment: number
  amortizationSystem: 'SAC' | 'PRICE'
}

interface DebtFormProps {
  initialData?: Partial<DebtFormData>
  onSubmit: (data: DebtFormData) => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
  onDataChange?: (data: DebtFormData) => void
  externalErrors?: Record<string, string>
  isEditing?: boolean
}

export function DebtForm({ initialData, onSubmit, onCancel, isLoading = false, onDataChange, externalErrors, isEditing = false }: DebtFormProps) {
  const { toast } = useToast()
  const [formData, setFormData] = useState<DebtFormData>({
    name: initialData?.name || '',
    balance: initialData?.balance || 0,
    interestRateAnnual: initialData?.interestRateAnnual || 0,
    termMonths: initialData?.termMonths || 0,
    monthlyPayment: initialData?.monthlyPayment || 0,
    amortizationSystem: initialData?.amortizationSystem || 'SAC'
  })

  const [errors, setErrors] = useState<Record<string, string>>({})
  
  // Mesclar erros externos com erros internos
  const allErrors = { ...errors, ...(externalErrors || {}) }

  // Função helper para atualizar formData e notificar mudanças
  const updateFormData = (updates: Partial<DebtFormData>) => {
    const newData = { ...formData, ...updates }
    setFormData(newData)
    // Notificar mudanças apenas quando necessário (não em useEffect)
    if (onDataChange) {
      onDataChange(newData)
    }
  }

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = 'Nome é obrigatório'
    }

    if (formData.balance <= 0) {
      newErrors.balance = 'Saldo devedor deve ser maior que zero'
    }

    if (formData.interestRateAnnual < 0 || formData.interestRateAnnual > 1) {
      newErrors.interestRateAnnual = 'Taxa deve estar entre 0% e 100%'
    }

    if (formData.termMonths <= 0) {
      newErrors.termMonths = 'Prazo deve ser maior que zero'
    }

    if (formData.monthlyPayment <= 0) {
      newErrors.monthlyPayment = 'Prestação deve ser maior que zero'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validate()) {
      toast({
        title: 'Erro de validação',
        description: 'Por favor, corrija os erros no formulário',
        variant: 'destructive'
      })
      return
    }

    try {
      await onSubmit(formData)
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao salvar dívida',
        variant: 'destructive'
      })
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardHeader>
          <CardTitle>{isEditing || initialData?.name ? 'Editar Dívida' : 'Nova Dívida'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Dívida</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => updateFormData({ name: e.target.value })}
                placeholder="Ex: Minha Casa, Loteamento"
                className={allErrors.name ? 'border-red-500' : ''}
              />
            {allErrors.name && <p className="text-sm text-red-500">{allErrors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="balance">Saldo Devedor (R$)</Label>
              <Input
                id="balance"
                type="number"
                step="0.01"
                value={formData.balance || ''}
                onChange={(e) => {
                  updateFormData({ balance: parseFloat(e.target.value) || 0 })
                  if (errors.balance) {
                    setErrors({ ...errors, balance: '' })
                  }
                }}
                className={allErrors.balance ? 'border-red-500' : ''}
              />
              {allErrors.balance && <p className="text-sm text-red-500">{allErrors.balance}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="interestRateAnnual">Taxa de Juros Anual (%)</Label>
              <Input
                id="interestRateAnnual"
                type="number"
                step="0.01"
                value={(formData.interestRateAnnual * 100) || ''}
                onChange={(e) => {
                  updateFormData({ interestRateAnnual: (parseFloat(e.target.value) || 0) / 100 })
                  if (errors.interestRateAnnual) {
                    setErrors({ ...errors, interestRateAnnual: '' })
                  }
                }}
                className={allErrors.interestRateAnnual ? 'border-red-500' : ''}
              />
              {allErrors.interestRateAnnual && <p className="text-sm text-red-500">{allErrors.interestRateAnnual}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="termMonths">Prazo (meses)</Label>
              <Input
                id="termMonths"
                type="number"
                value={formData.termMonths || ''}
                onChange={(e) => updateFormData({ termMonths: parseInt(e.target.value) || 0 })}
                className={allErrors.termMonths ? 'border-red-500' : ''}
              />
              {allErrors.termMonths && <p className="text-sm text-red-500">{allErrors.termMonths}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="monthlyPayment">Prestação Mensal (R$)</Label>
              <Input
                id="monthlyPayment"
                type="number"
                step="0.01"
                value={formData.monthlyPayment || ''}
                onChange={(e) => {
                  updateFormData({ monthlyPayment: parseFloat(e.target.value) || 0 })
                  if (errors.monthlyPayment) {
                    setErrors({ ...errors, monthlyPayment: '' })
                  }
                }}
                className={allErrors.monthlyPayment ? 'border-red-500' : ''}
              />
              {allErrors.monthlyPayment && <p className="text-sm text-red-500">{allErrors.monthlyPayment}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amortizationSystem">Sistema de Amortização</Label>
            <Select
              value={formData.amortizationSystem}
              onValueChange={(value: 'SAC' | 'PRICE') => updateFormData({ amortizationSystem: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="SAC">SAC - Sistema de Amortização Constante</SelectItem>
                <SelectItem value="PRICE">PRICE - Tabela Price</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex gap-2 justify-end">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                Cancelar
              </Button>
            )}
            <Button type="submit" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {initialData ? 'Atualizar' : 'Criar'} Dívida
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}

