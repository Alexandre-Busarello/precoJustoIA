"use client"

import { NavDropdown, NavSection } from "./nav-dropdown"
import { Radar, Search, DollarSign, TrendingUp, Building2, BarChart3 } from "lucide-react"

const sections: NavSection[] = [
  {
    label: "Descoberta",
    items: [
      {
        title: "Radar de Oportunidades",
        href: "/radar",
        icon: Radar,
        description: "Visão consolidada e visual de ativos descontados.",
        isNew: true,
      },
      {
        title: "Screening de Ações",
        href: "/screening-acoes",
        icon: Search,
        description: "Filtros customizáveis para encontrar a ação perfeita.",
      },
      {
        title: "Screening de FIIs",
        href: "/screening-fiis",
        icon: Building2,
        description: "Filtre fundos imobiliários por DY, P/VP, liquidez e segmento.",
      },
    ],
  },
  {
    label: "Análise Rápida",
    items: [
      {
        title: "Radar de Dividendos",
        href: "/radar-dividendos",
        icon: DollarSign,
        description: "Proventos confirmados e projeções estatísticas.",
      },
      {
        title: "Rankings",
        href: "/ranking",
        icon: TrendingUp,
        description: "Ações ordenadas por Graham, Bazin e outros modelos.",
      },
      {
        title: "Projeções IBOV",
        href: "/projecoes-ibov",
        icon: BarChart3,
        description: "Faixas estatísticas do Ibovespa a partir do histórico.",
      },
    ],
  },
]

export function OportunidadesDropdown() {
  return <NavDropdown title="Oportunidades" sections={sections} />
}

