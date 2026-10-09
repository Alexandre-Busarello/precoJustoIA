'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useMutation } from '@tanstack/react-query'
import { ChevronDown, Copy, RefreshCw, SlidersHorizontal } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { PortfolioMoneyInput } from '@/components/portfolio-money-input'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { formatBRL, formatNumber } from '@/lib/format'
import {
  ALLOCATION_MODEL_LABEL,
  ALLOCATION_PRESETS,
  ALL_MODELS,
  DEFAULT_ALLOCATION_OPTIONS,
  DEFAULT_MARKET_OPTIONS,
  FREE_MAX_TICKERS,
  FREE_MODELS,
  MARKET_ASSET_TYPES,
  MIN_AMOUNT,
  PREMIUM_MAX_TICKERS,
} from '@/lib/allocation/constants'
import type { SimulateRequestInput } from '@/lib/allocation/schema'
import type { SimulateResponse } from '@/lib/allocation/service'
import type { AllocationAssetType, AllocationPresetId, FairValueModelId } from '@/lib/allocation/types'
import { AllocationLocked } from './allocation-locked'
import { AllocationResults, allocationText } from './allocation-results'
import { MarketTransparency } from './market-transparency'
import { Segmented } from './segmented'
import { TickerChipsInput } from './ticker-chips-input'

export type UniverseKind = 'portfolio' | 'radar' | 'tickers' | 'market'

export interface PortfolioOption {
  id: string
  name: string
  hasTargets: boolean
}

export interface OndeAportarInitial {
  amount?: number
  universe?: UniverseKind
  portfolioId?: string
  tickers?: string[]
  /** Critério já escolhido pelo usuário (link salvo com `?criterio=`). */
  preset?: AllocationPresetId
  /**
   * Calcula assim que a página abre (vindo do dashboard ou de um link salvo). No modo "Todo o mercado", só quando o
   * link traz o critério escolhido pelo usuário: a plataforma nunca escolhe o critério por ele.
   */
  autoRun?: boolean
}

interface OndeAportarClientProps {
  isLoggedIn: boolean
  isPremium: boolean
  portfolios: PortfolioOption[]
  radarCount: number
  initial: OndeAportarInitial
}

const selectClass =
  'h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground outline-none focus-visible:border-brand focus-visible:ring-[3px] focus-visible:ring-ring md:h-9 md:text-sm'

function StepTitle({ step, id, children }: { step: string; id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="flex items-baseline gap-2 text-base font-semibold text-foreground">
      <span className="text-sm tabular-nums text-muted-foreground">{step}</span>
      {children}
    </h2>
  )
}

function CheckRow({ id, label, checked, onChange, disabled, hint }: { id: string; label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; hint?: string }) {
  return (
    <label htmlFor={id} className={cn('flex min-h-11 items-center gap-3 text-sm text-foreground md:min-h-8', disabled && 'cursor-not-allowed opacity-60')}>
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} disabled={disabled} />
      <span>
        {label}
        {hint && <span className="ml-1.5 text-xs text-muted-foreground">{hint}</span>}
      </span>
    </label>
  )
}

function SwitchRow({ id, label, description, checked, onChange }: { id: string; label: string; description?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4">
      <Label htmlFor={id} className="flex flex-col items-start gap-0.5 text-sm font-normal text-foreground">
        {label}
        {description && <span className="text-xs text-muted-foreground">{description}</span>}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  )
}

async function postSimulation(path: string, body: SimulateRequestInput) {
  const response = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Não foi possível calcular a distribuição agora.')
  return data
}

/** "Onde aportar": três passos visíveis ao mesmo tempo (valor, universo, critério) e o resultado logo abaixo. */
export function OndeAportarClient({ isLoggedIn, isPremium, portfolios, radarCount, initial }: OndeAportarClientProps) {
  const { toast } = useToast()
  const [amount, setAmount] = useState<number | undefined>(initial.amount ?? 2000)
  const [universe, setUniverse] = useState<UniverseKind>(initial.universe ?? (isPremium && portfolios.length > 0 ? 'portfolio' : 'tickers'))
  const [portfolioId, setPortfolioId] = useState(initial.portfolioId ?? portfolios[0]?.id ?? '')
  const [tickers, setTickers] = useState<string[]>(initial.tickers ?? [])
  const [chosenPreset, setPreset] = useState<AllocationPresetId | null>(initial.preset ?? (initial.universe === 'market' ? null : 'equilibrio'))
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [models, setModels] = useState<FairValueModelId[]>(isPremium ? ALL_MODELS : FREE_MODELS)
  const [maxPerAssetPct, setMaxPerAssetPct] = useState(DEFAULT_ALLOCATION_OPTIONS.maxPerAssetPct)
  const [allowFractional, setAllowFractional] = useState(true)
  const [respectTargets, setRespectTargets] = useState(true)
  const [assetTypes, setAssetTypes] = useState<AllocationAssetType[]>(['stock'])
  const [maxAssets, setMaxAssets] = useState(DEFAULT_MARKET_OPTIONS.maxAssets)
  const [sectorMaxAssets, setSectorMaxAssets] = useState(DEFAULT_MARKET_OPTIONS.sectorMaxAssets)
  const [sectorMaxPct, setSectorMaxPct] = useState(DEFAULT_MARKET_OPTIONS.sectorMaxPct)
  const [complement, setComplement] = useState(portfolios.length > 0)
  const [excludeTickers, setExcludeTickers] = useState<string[]>([])
  const criteriaRef = useRef<HTMLElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  const selectedPortfolio = portfolios.find((p) => p.id === portfolioId)
  const hasTargets = universe === 'portfolio' && !!selectedPortfolio?.hasTargets
  const maxTickers = isPremium ? PREMIUM_MAX_TICKERS : FREE_MAX_TICKERS
  // "Seguir meus pesos-alvo" só existe com carteira que tem pesos-alvo.
  const preset = chosenPreset === 'pesos' && !hasTargets ? 'equilibrio' : chosenPreset

  const buildRequest = (): SimulateRequestInput | null => {
    if (!amount || amount < MIN_AMOUNT || !preset) return null
    const common = {
      amount,
      preset,
      models,
      maxPerAssetPct,
      allowFractional,
      respectTargets,
    }
    if (universe === 'tickers') return tickers.length > 0 ? { ...common, universe: { kind: 'tickers', tickers } } : null
    if (universe === 'portfolio') return portfolioId ? { ...common, universe: { kind: 'portfolio', portfolioId } } : null
    if (universe === 'radar') return { ...common, universe: { kind: 'radar' } }
    return {
      ...common,
      universe: {
        kind: 'market',
        assetTypes,
        maxAssets,
        sectorMaxAssets,
        sectorMaxPct,
        complementPortfolio: complement,
        complementPortfolioId: complement && portfolioId ? portfolioId : null,
        excludeTickers,
      },
    }
  }

  const simulation = useMutation<SimulateResponse, Error, SimulateRequestInput>({
    mutationFn: (body) => postSimulation('/api/allocation/simulate', body),
  })
  const register = useMutation<{ created: number; portfolioId: string }, Error, SimulateRequestInput>({
    mutationFn: (body) => postSimulation('/api/allocation/register', body),
    onSuccess: (data) =>
      toast({ title: 'Compras registradas como pendentes', description: `${formatNumber(data.created)} transações aguardam sua confirmação em Sugestões.` }),
    onError: (error) => toast({ title: 'Não foi possível registrar', description: error.message, variant: 'destructive' }),
  })

  const request = buildRequest()
  const missing = !amount || amount < MIN_AMOUNT
    ? `Informe um valor a partir de ${formatBRL(MIN_AMOUNT)}.`
    : !preset
      ? 'Escolha um critério para calcular.'
      : universe === 'tickers' && tickers.length === 0
        ? 'Adicione pelo menos um ativo.'
        : universe === 'portfolio' && !portfolioId
          ? 'Escolha uma carteira.'
          : null

  const calculate = () => {
    const body = buildRequest()
    if (!body) return
    register.reset()
    simulation.mutate(body, {
      onSuccess: () => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
    })
  }

  // Vindo do dashboard ou de um link salvo: calcula ao abrir (no "Todo o mercado", só com o critério escolhido no link).
  const autoRan = useRef(false)
  useEffect(() => {
    if (autoRan.current || !initial.autoRun || (initial.universe === 'market' && !initial.preset)) return
    autoRan.current = true
    const body = buildRequest()
    if (body) simulation.mutate(body)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // "Todo o mercado" exige que o usuário escolha o critério antes de calcular; nas listas, volta ao padrão.
  const changeUniverse = (next: UniverseKind) => {
    setUniverse(next)
    if (next === 'market' && universe !== 'market') setPreset(null)
    else if (next !== 'market' && chosenPreset === null) setPreset('equilibrio')
  }

  // Trocar o critério depois de um resultado recalcula na hora.
  const changePreset = (next: AllocationPresetId) => {
    setPreset(next)
    register.reset()
    if (simulation.data && request) simulation.mutate({ ...request, preset: next })
  }

  const openAdjust = () => {
    setAdjustOpen(true)
    criteriaRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const copyList = async () => {
    if (!simulation.data) return
    try {
      await navigator.clipboard.writeText(allocationText(simulation.data.result))
      toast({ title: 'Lista copiada' })
    } catch {
      toast({ title: 'Não foi possível copiar', description: 'Seu navegador bloqueou a área de transferência.', variant: 'destructive' })
    }
  }

  const toggle = <T,>(list: T[], value: T, on: boolean) => (on ? [...new Set([...list, value])] : list.filter((v) => v !== value))

  const universeOptions = [
    { value: 'portfolio' as const, label: 'Minha carteira', disabled: isLoggedIn && portfolios.length === 0, locked: !isPremium },
    { value: 'radar' as const, label: 'Meu radar', disabled: isLoggedIn && radarCount === 0, locked: !isPremium },
    { value: 'tickers' as const, label: 'Digitar tickers' },
    { value: 'market' as const, label: 'Todo o mercado', locked: !isPremium },
  ]

  const data = simulation.data
  const isMarket = data?.result.funnel !== undefined

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-3">
        <section aria-labelledby="passo-valor" className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-5">
          <StepTitle step="1" id="passo-valor">
            Quanto você vai aportar?
          </StepTitle>
          <Label htmlFor="aporte-valor" className="sr-only">
            Valor do aporte
          </Label>
          <PortfolioMoneyInput id="aporte-valor" value={amount} onValueChange={setAmount} enterKeyHint="done" />
          <p className="text-xs text-muted-foreground">Mínimo de {formatBRL(MIN_AMOUNT)}. O que não couber em ações inteiras aparece como sobra.</p>
        </section>

        <section aria-labelledby="passo-universo" className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-5">
          <StepTitle step="2" id="passo-universo">
            Entre quais ativos?
          </StepTitle>
          <Segmented ariaLabel="Universo de ativos" value={universe} onChange={changeUniverse} options={universeOptions} className="grid-cols-2" />
          {universe === 'tickers' && (
            <TickerChipsInput
              id="aporte-tickers"
              tickers={tickers}
              onChange={setTickers}
              max={maxTickers}
              limitNote={
                !isPremium && (
                  <p className="text-xs text-muted-foreground">
                    Limite de {FREE_MAX_TICKERS} ativos no plano gratuito.{' '}
                    <Link href={isLoggedIn ? '/checkout' : '/register?callbackUrl=/onde-aportar'} className="text-brand underline-offset-4 hover:underline">
                      Desbloquear com 1 dia grátis
                    </Link>
                  </p>
                )
              }
            />
          )}
          {universe === 'portfolio' && isLoggedIn && portfolios.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="aporte-carteira" className="text-xs text-muted-foreground">
                Carteira
              </Label>
              <select id="aporte-carteira" className={selectClass} value={portfolioId} onChange={(e) => setPortfolioId(e.target.value)}>
                {portfolios.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {universe === 'portfolio' && isLoggedIn && portfolios.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Você ainda não tem carteira.{' '}
              <Link href="/carteira/nova" className="text-brand underline-offset-4 hover:underline">
                Criar carteira
              </Link>
            </p>
          )}
          {(universe === 'portfolio' || universe === 'radar') && !isLoggedIn && (
            <p className="text-sm text-muted-foreground">
              <Link href="/login?callbackUrl=/onde-aportar" className="text-brand underline-offset-4 hover:underline">
                Entre na sua conta
              </Link>{' '}
              para usar {universe === 'portfolio' ? 'sua carteira' : 'seu radar'}. Sem conta, digite até {FREE_MAX_TICKERS} tickers.
            </p>
          )}
          {universe === 'radar' && isLoggedIn && (
            <p className="text-sm text-muted-foreground">
              {radarCount > 0 ? `${formatNumber(radarCount)} ${radarCount === 1 ? 'ativo' : 'ativos'} no seu radar.` : 'Seu radar está vazio.'}{' '}
              <Link href="/radar" className="text-brand underline-offset-4 hover:underline">
                Editar radar
              </Link>
            </p>
          )}
          {universe === 'market' && (
            <p className="text-sm text-muted-foreground">
              A plataforma ranqueia todos os ativos pelos critérios que você escolher. Você não precisa informar tickers.
            </p>
          )}
        </section>

        <section ref={criteriaRef} aria-labelledby="passo-criterio" className="scroll-mt-24 space-y-3 rounded-lg border border-border bg-card p-4 sm:p-5">
          <StepTitle step="3" id="passo-criterio">
            Critério
          </StepTitle>
          <Segmented
            ariaLabel="Critério da prioridade"
            value={preset ?? ('' as AllocationPresetId)}
            onChange={changePreset}
            options={ALLOCATION_PRESETS.map((p) => ({ value: p.id, label: p.label, disabled: p.id === 'pesos' && !hasTargets }))}
            className="grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3"
          />
          <p className="text-xs text-muted-foreground">
            {preset ? ALLOCATION_PRESETS.find((p) => p.id === preset)?.description : 'Escolha como priorizar os ativos antes de calcular.'}
          </p>
        </section>
      </div>

      {universe === 'market' && (
        <section aria-labelledby="filtros-mercado" className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-5">
          <h2 id="filtros-mercado" className="text-base font-semibold text-foreground">
            Filtros do mercado
          </h2>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <fieldset className="space-y-1">
              <legend className="text-xs text-muted-foreground">Tipos de ativo</legend>
              {MARKET_ASSET_TYPES.map((type) => (
                <CheckRow
                  key={type.id}
                  id={`tipo-${type.id}`}
                  label={type.label}
                  checked={assetTypes.includes(type.id)}
                  onChange={(on) => setAssetTypes((list) => (on || list.length > 1 ? toggle(list, type.id, on) : list))}
                  hint={type.id === 'etf' || type.id === 'bdr' ? 'sem preço justo: ficam de fora' : undefined}
                />
              ))}
            </fieldset>
            <div className="space-y-1.5">
              <Label htmlFor="mercado-n" className="text-xs text-muted-foreground">
                Número de ativos no aporte
              </Label>
              <select id="mercado-n" className={selectClass} value={maxAssets} onChange={(e) => setMaxAssets(Number(e.target.value))}>
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="mercado-setor-n" className="text-xs text-muted-foreground">
                  Máx. por setor
                </Label>
                <select id="mercado-setor-n" className={selectClass} value={sectorMaxAssets} onChange={(e) => setSectorMaxAssets(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === 1 ? 'ativo' : 'ativos'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mercado-setor-pct" className="text-xs text-muted-foreground">
                  % do aporte
                </Label>
                <select id="mercado-setor-pct" className={selectClass} value={sectorMaxPct} onChange={(e) => setSectorMaxPct(Number(e.target.value))}>
                  {[0.25, 0.35, 0.5, 0.75, 1].map((v) => (
                    <option key={v} value={v}>
                      {formatNumber(v * 100, { digits: 0 })}%
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-2">
              {portfolios.length > 0 && (
                <SwitchRow
                  id="mercado-complementar"
                  label="Complementar minha carteira"
                  description="Reduz a prioridade de setores e ativos que já pesam demais."
                  checked={complement}
                  onChange={setComplement}
                />
              )}
              {portfolios.length > 1 && complement && (
                <select aria-label="Carteira a complementar" className={selectClass} value={portfolioId} onChange={(e) => setPortfolioId(e.target.value)}>
                  {portfolios.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground">Excluir tickers</p>
            <TickerChipsInput id="mercado-excluir" tickers={excludeTickers} onChange={setExcludeTickers} max={50} placeholder="Ticker que não deve entrar" />
          </div>
        </section>
      )}

      <Collapsible open={adjustOpen} onOpenChange={setAdjustOpen} className="rounded-lg border border-border bg-card">
        <CollapsibleTrigger className="min-h-11 px-4 py-3 hover:no-underline sm:px-5">
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal className="size-4 text-muted-foreground" strokeWidth={1.75} aria-hidden="true" />
            Ajustar modelos e limites
          </span>
          <ChevronDown className="size-4 text-muted-foreground transition-transform" strokeWidth={1.75} aria-hidden="true" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="grid gap-6 border-t border-border p-4 sm:p-5 md:grid-cols-3">
            <fieldset className="space-y-1">
              <legend className="text-xs text-muted-foreground">Modelos de preço justo</legend>
              {ALL_MODELS.map((model) => {
                const locked = !isPremium && !FREE_MODELS.includes(model)
                return (
                  <CheckRow
                    key={model}
                    id={`modelo-${model}`}
                    label={ALLOCATION_MODEL_LABEL[model]}
                    checked={models.includes(model)}
                    disabled={locked}
                    hint={locked ? 'Premium' : model === 'bankPvp' ? 'bancos e seguradoras' : model === 'fiiCeiling' ? 'FIIs' : undefined}
                    onChange={(on) => setModels((list) => (on || list.length > 1 ? toggle(list, model, on) : list))}
                  />
                )
              })}
            </fieldset>
            <div className="space-y-1.5">
              <Label htmlFor="limite-ativo" className="text-xs text-muted-foreground">
                Máximo por ativo
              </Label>
              <select id="limite-ativo" className={selectClass} value={maxPerAssetPct} onChange={(e) => setMaxPerAssetPct(Number(e.target.value))}>
                {[0.2, 0.25, 0.3, 0.4, 0.5, 0.75, 1].map((v) => (
                  <option key={v} value={v}>
                    {formatNumber(v * 100, { digits: 0 })}% do aporte
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Com carteira, cada ativo também fica limitado a 25% dela depois do aporte (ou ao seu peso-alvo, se for maior).</p>
            </div>
            <div className="space-y-2">
              <SwitchRow id="fracionario" label="Mercado fracionário" description="Desligado, compra ações em lotes de 100." checked={allowFractional} onChange={setAllowFractional} />
              {hasTargets && (
                <SwitchRow
                  id="respeitar-alvos"
                  label="Respeitar meus pesos-alvo"
                  description="Só compra o que está abaixo do alvo, sem passar dele."
                  checked={respectTargets || preset === 'pesos'}
                  onChange={setRespectTargets}
                />
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Button size="lg" onClick={calculate} disabled={!request || simulation.isPending} className="w-full sm:w-auto">
          {simulation.isPending ? 'Calculando…' : 'Calcular distribuição'}
        </Button>
        {missing && <p className="text-sm text-muted-foreground">{missing}</p>}
      </div>

      <div ref={resultRef} className="scroll-mt-24" aria-live="polite">
        {simulation.isPending && (
          <div className="space-y-3" aria-busy="true">
            <span className="sr-only">Calculando a distribuição</span>
            <Skeleton className="h-6 w-72 max-w-full" />
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        )}

        {simulation.isError && !simulation.isPending && (
          <div role="alert" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-foreground">{simulation.error.message}</p>
            <Button variant="outline" onClick={calculate}>
              <RefreshCw strokeWidth={1.75} aria-hidden="true" />
              Tentar novamente
            </Button>
          </div>
        )}

        {data && !simulation.isPending && data.locked && (
          <AllocationLocked reason={data.locked} preview={data.result} isLoggedIn={isLoggedIn} />
        )}

        {data && !simulation.isPending && !data.locked && (
          <AllocationResults
            result={data.result}
            mode={isMarket ? 'market' : 'list'}
            universeLabel={data.universeLabel}
            actions={
              <>
                {isPremium && data.portfolioId && data.result.allocations.length > 0 && (
                  register.isSuccess ? (
                    <Button asChild>
                      <Link href={`/carteira/${data.portfolioId}/sugestoes`}>Ver pendentes na carteira</Link>
                    </Button>
                  ) : (
                    <Button
                      onClick={() => simulation.variables && register.mutate(simulation.variables)}
                      disabled={register.isPending || !simulation.variables}
                    >
                      {register.isPending ? 'Registrando…' : 'Registrar compras na carteira'}
                    </Button>
                  )
                )}
                {data.result.allocations.length > 0 && (
                  <Button variant="outline" onClick={copyList}>
                    <Copy strokeWidth={1.75} aria-hidden="true" />
                    Copiar lista
                  </Button>
                )}
                <Button variant="outline" onClick={openAdjust}>
                  <SlidersHorizontal strokeWidth={1.75} aria-hidden="true" />
                  Ajustar critérios
                </Button>
              </>
            }
            extra={
              <>
                {data.unknownTickers.length > 0 && (
                  <p className="text-xs text-muted-foreground">Não encontrados na base: {data.unknownTickers.join(', ')}.</p>
                )}
                {isMarket && data.result.funnel && data.result.candidates && (
                  <MarketTransparency funnel={data.result.funnel} candidates={data.result.candidates} />
                )}
              </>
            }
          />
        )}

      </div>
    </div>
  )
}
