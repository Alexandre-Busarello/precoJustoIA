import { Metadata } from "next"
import { AlfaBanner } from "@/components/alfa-banner"
import { EarlyAdopterContent } from "@/components/early-adopter-content"

export const metadata: Metadata = {
  title: "Oferta Especial Early Adopter | Preço Congelado Para Sempre - Preço Justo AI",
  description: "🚀 Oferta exclusiva para Early Adopters: Preço congelado PARA SEMPRE + Canal exclusivo WhatsApp com CEO + Acesso antecipado. Apenas durante a Fase Alfa. Garante já o seu!",
  keywords: "early adopter, oferta especial, preço congelado, análise fundamentalista, investimentos, ações B3, bovespa, desconto especial",
  openGraph: {
    title: "Oferta Especial Early Adopter - Preço Justo AI",
    description: "Preço congelado PARA SEMPRE + Canal exclusivo com CEO. Oferta limitada da Fase Alfa.",
    type: "website",
    url: "https://precojusto.ai/early-adopter",
    siteName: "Preço Justo AI",
    locale: "pt_BR",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function EarlyAdopterPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-background dark:to-background/80">
      <AlfaBanner variant="landing" />
      <EarlyAdopterContent />
    </div>
  )
}