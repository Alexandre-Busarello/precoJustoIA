export type AssetType = 'b3' | 'bdr' | 'both' | 'fii' | 'etf'
export type WizardFlow = 'new' | 'history'
export type WizardStepId = 'destination' | 'history' | 'asset-type' | 'configure'

export interface AssetTypeOption {
  id: AssetType
  label: string
  description: string
  emoji: string
  color: string
}

export interface WizardState {
  step: WizardStepId
  flow: WizardFlow | null
  assetType: AssetType | null
  rankingId: string | null
  direction: 'forward' | 'backward'
}

export const ASSET_TYPE_OPTIONS: AssetTypeOption[] = [
  {
    id: 'b3',
    label: 'Ações B3',
    description: 'Ações listadas na Bolsa brasileira',
    emoji: '🇧🇷',
    color: 'from-green-500 to-emerald-600',
  },
  {
    id: 'bdr',
    label: 'BDRs',
    description: 'Recibos de empresas internacionais',
    emoji: '🌎',
    color: 'from-blue-500 to-cyan-600',
  },
  {
    id: 'both',
    label: 'B3 + BDRs',
    description: 'Ações brasileiras e internacionais',
    emoji: '📊',
    color: 'from-violet-500 to-purple-600',
  },
  {
    id: 'fii',
    label: 'FIIs',
    description: 'Fundos de investimento imobiliário',
    emoji: '🏢',
    color: 'from-orange-500 to-amber-600',
  },
  {
    id: 'etf',
    label: 'ETFs',
    description: 'Fundos de índice negociados em bolsa',
    emoji: '📊',
    color: 'from-teal-500 to-cyan-600',
  },
]
