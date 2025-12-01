"use client"

import { NavDropdown, NavSection } from "./nav-dropdown"
import { Radar, Search, DollarSign, TrendingUp } from "lucide-react"

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
        iconGradient: "bg-gradient-to-br from-blue-500 to-purple-500",
      },
      {
        title: "Screening de Ações",
        href: "/screening-acoes",
        icon: Search,
        description: "Filtros customizáveis para encontrar a ação perfeita.",
        iconGradient: "bg-gradient-to-br from-amber-500 to-yellow-500",
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
        description: "Projeções de dividendos com IA.",
        iconGradient: "bg-gradient-to-br from-blue-500 to-purple-500",
      },
      {
        title: "Rankings",
        href: "/ranking",
        icon: TrendingUp,
        description: "As melhores ações segundo Graham, Bazin e outros.",
        iconGradient: "bg-gradient-to-br from-blue-500 to-purple-500",
      },
    ],
  },
]

export function OportunidadesDropdown() {
  return <NavDropdown title="Oportunidades" sections={sections} />
}

