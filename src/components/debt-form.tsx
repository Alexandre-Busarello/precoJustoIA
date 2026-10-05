'use client'

/**
 * Dados da dívida para a simulação de arbitragem (cadastro, edição ou uso avulso sem login).
 */

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { DecimalInput, NumericMoneyInput } from '@/app/calculadoras/_components/money-input'

export interface DebtFormData {
  name: string
  balance: number
  /** Taxa anual como fração (0,1 = 10% a.a.). */
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

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="text-sm text-negative">
      {message}
    </p>
  )
}

export function DebtForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading = false,
  onDataChange,
  externalErrors,
  isEditing = false,
}: DebtFormProps) {
  const { toast } = useToast()
  const [formData, setFormData] = useState<DebtFormData>({
    name: initialData?.name || '',
    balance: Number(initialData?.balance) || 0,
    interestRateAnnual: Number(initialData?.interestRateAnnual) || 0,
    termMonths: Number(initialData?.termMonths) || 0,
    monthlyPayment: Number(initialData?.monthlyPayment) || 0,
    amortizationSystem: initialData?.amortizationSystem || 'SAC',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const allErrors: Record<string, string | undefined> = { ...errors, ...(externalErrors || {}) }

  const updateFormData = (updates: Partial<DebtFormData>) => {
    const next = { ...formData, ...updates }
    setFormData(next)
    // Limpa o erro dos campos alterados.
    const cleared = Object.keys(updates).filter((key) => errors[key])
    if (cleared.length > 0) {
      setErrors((prev) => {
        const copy = { ...prev }
        cleared.forEach((key) => delete copy[key])
        return copy
      })
    }
    onDataChange?.(next)
  }

  const validate = (): boolean => {
    const next: Record<string, string> = {}
    if (!formData.name.trim()) next.name = 'Informe um nome para a dívida.'
    if (formData.balance <= 0) next.balance = 'O saldo devedor deve ser maior que zero.'
    if (formData.interestRateAnnual < 0 || formData.interestRateAnnual > 1) next.interestRateAnnual = 'Use uma taxa entre 0% e 100%.'
    if (formData.termMonths <= 0) next.termMonths = 'O prazo deve ser maior que zero.'
    if (formData.monthlyPayment <= 0) next.monthlyPayment = 'A prestação deve ser maior que zero.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) {
      toast({ title: 'Revise os dados da dívida', description: 'Alguns campos precisam de correção.', variant: 'destructive' })
      return
    }
    try {
      await onSubmit(formData)
    } catch (error) {
      toast({
        title: 'Não foi possível salvar a dívida',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      })
    }
  }

  const invalid = (key: string) => (allErrors[key] ? true : undefined)
  const describedBy = (key: string) => (allErrors[key] ? `${key}-error` : undefined)

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5" noValidate>
      <h2 className="text-sm font-medium text-foreground">{isEditing || initialData?.name ? 'Dados da dívida' : 'Nova dívida'}</h2>

      <div className="space-y-2">
        <Label htmlFor="name">Nome da dívida</Label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => updateFormData({ name: e.target.value })}
          placeholder="Ex.: financiamento do apartamento"
          aria-invalid={invalid('name')}
          aria-describedby={describedBy('name')}
          enterKeyHint="next"
        />
        <FieldError id="name-error" message={allErrors.name} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="balance">Saldo devedor</Label>
          <NumericMoneyInput
            id="balance"
            placeholder="300.000,00"
            value={formData.balance}
            onValueChange={(balance) => updateFormData({ balance })}
            aria-invalid={invalid('balance')}
            aria-describedby={describedBy('balance')}
            enterKeyHint="next"
          />
          <FieldError id="balance-error" message={allErrors.balance} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="interestRateAnnual">Juros ao ano</Label>
          <DecimalInput
            id="interestRateAnnual"
            placeholder="9,5"
            suffix="% a.a."
            value={formData.interestRateAnnual * 100}
            onValueChange={(rate) => updateFormData({ interestRateAnnual: rate / 100 })}
            aria-invalid={invalid('interestRateAnnual')}
            aria-describedby={describedBy('interestRateAnnual')}
            enterKeyHint="next"
          />
          <FieldError id="interestRateAnnual-error" message={allErrors.interestRateAnnual} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="termMonths">Prazo restante</Label>
          <DecimalInput
            id="termMonths"
            integer
            placeholder="360"
            suffix="meses"
            value={formData.termMonths}
            onValueChange={(termMonths) => updateFormData({ termMonths: Math.floor(termMonths) })}
            aria-invalid={invalid('termMonths')}
            aria-describedby={describedBy('termMonths')}
            enterKeyHint="next"
          />
          <FieldError id="termMonths-error" message={allErrors.termMonths} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="monthlyPayment">Prestação mensal</Label>
          <NumericMoneyInput
            id="monthlyPayment"
            placeholder="3.000,00"
            value={formData.monthlyPayment}
            onValueChange={(monthlyPayment) => updateFormData({ monthlyPayment })}
            aria-invalid={invalid('monthlyPayment')}
            aria-describedby={describedBy('monthlyPayment')}
            enterKeyHint="next"
          />
          <FieldError id="monthlyPayment-error" message={allErrors.monthlyPayment} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="amortizationSystem">Sistema de amortização</Label>
        <Select
          value={formData.amortizationSystem}
          onValueChange={(value: 'SAC' | 'PRICE') => updateFormData({ amortizationSystem: value })}
        >
          <SelectTrigger id="amortizationSystem" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SAC">SAC, amortização constante</SelectItem>
            <SelectItem value="PRICE">Price, prestação constante</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancelar
          </Button>
        )}
        <Button type="submit" variant={onCancel ? 'default' : 'outline'} disabled={isLoading}>
          {isLoading && <Loader2 className="size-4 animate-spin" strokeWidth={1.75} />}
          {isEditing ? 'Salvar alterações' : 'Salvar dívida'}
        </Button>
      </div>
    </form>
  )
}
