"use client"

import { NavDropdown, NavSection, NavItem } from "./nav-dropdown"
import { LineChart, BarChart3 } from "lucide-react"
import { usePremiumStatus } from "@/hooks/use-premium-status"

export function CarteirasDropdown() {
  const { isPremium } = usePremiumStatus()

  const items: NavItem[] = [
    {
      title: "Carteiras Teóricas",
      href: "/indices",
      icon: LineChart,
      description: "Índices teóricos com performance histórica e rebalanceamento automático.",
      iconGradient: "bg-gradient-to-br from-violet-500 to-purple-500",
    },
  ]

  if (isPremium) {
    items.push({
      title: "Carteiras",
      href: "/carteira",
      icon: BarChart3,
      description: "Gerencie suas carteiras de investimentos com acompanhamento em tempo real.",
      iconGradient: "bg-gradient-to-br from-blue-500 to-indigo-500",
      badge: "Premium",
    })
  }

  const sections: NavSection[] = [
    {
      items,
    },
  ]

  return <NavDropdown title="Carteiras" sections={sections} />
}

