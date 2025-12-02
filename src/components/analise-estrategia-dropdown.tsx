"use client"

import { NavDropdown, NavSection } from "./nav-dropdown"
import { GitCompare, Building2, TrendingUp, History, Calculator, ArrowLeftRight } from "lucide-react"

const sections: NavSection[] = [
  {
    label: "Comparação",
    items: [
      {
        title: "Comparador",
        href: "/comparador",
        icon: GitCompare,
        description: "Compare indicadores de ações lado a lado.",
        iconGradient: "bg-gradient-to-br from-blue-500 to-purple-500",
      },
      {
        title: "Análise Setorial",
        href: "/analise-setorial",
        icon: Building2,
        description: "Compare múltiplos e métricas entre setores.",
        iconGradient: "bg-gradient-to-br from-indigo-500 to-blue-500",
      },
    ],
  },
  {
    label: "Histórico",
    items: [
      {
        title: "P/L Histórico",
        href: "/pl-bolsa",
        icon: TrendingUp,
        description: "Análise histórica do P/L da Bovespa.",
        iconGradient: "bg-gradient-to-br from-indigo-500 to-purple-500",
      },
      {
        title: "Backtesting",
        href: "/backtest",
        icon: History,
        description: "Simule estratégias de investimento no passado.",
        iconGradient: "bg-gradient-to-br from-emerald-500 to-teal-500",
      },
    ],
  },
  {
    label: "Ferramentas",
    items: [
      {
        title: "Arbitragem de Dívida",
        href: "/arbitragem-divida",
        icon: ArrowLeftRight,
        description: "Simule amortizar dívida vs investir em ativos.",
        isNew: true,
        iconGradient: "bg-gradient-to-br from-purple-500 to-pink-500",
      },
      {
        title: "Calculadoras",
        href: "/calculadoras/dividend-yield",
        icon: Calculator,
        description: "Calcule preço teto e rendimento de dividendos.",
        badge: "Grátis",
        iconGradient: "bg-gradient-to-br from-green-500 to-emerald-500",
      },
    ],
  },
]

export function AnaliseEstrategiaDropdown() {
  return <NavDropdown title="Análise & Estratégia" sections={sections} />
}

