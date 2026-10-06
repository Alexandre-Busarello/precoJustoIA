'use client'

import { buttonVariants } from "@/components/ui/button"
import { useCheckoutUrl } from "@/components/kiwify-checkout-link"
import { cn } from "@/lib/utils"
import { OFERTA_MONTHLY_PRICE_LABEL } from "@/components/landing/oferta-config"

/** Caixa de preço clicável da landing /oferta. */
export function OfertaPriceLink({ href, label = "Acesso anual promocional" }: { href: string; label?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex flex-col items-start gap-1 rounded-lg border border-border bg-card px-5 py-4 transition-colors hover:border-foreground/20 hover:bg-accent focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring"
    >
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-1">
        <span className="text-3xl font-semibold tracking-tight tabular-nums text-foreground sm:text-4xl">{OFERTA_MONTHLY_PRICE_LABEL}</span>
        <span className="text-base text-muted-foreground">/mês</span>
      </span>
      <span className="text-sm text-muted-foreground">No cartão, ou com desconto maior à vista</span>
    </a>
  )
}

/** Botão principal de checkout da landing /oferta. */
export function OfertaCTAButton({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto", className)}
    >
      {label}
    </a>
  )
}

export function HeroPriceLink() {
  const checkoutUrl = useCheckoutUrl()
  return <OfertaPriceLink href={checkoutUrl} />
}

export function HeroCTAButton() {
  const checkoutUrl = useCheckoutUrl()
  return <OfertaCTAButton href={checkoutUrl} label="Garantir o acesso anual" />
}

export function IntermediateCTAButton() {
  const checkoutUrl = useCheckoutUrl()
  return (
    <OfertaCTAButton
      href={checkoutUrl}
      label={`Garantir o acesso anual por ${OFERTA_MONTHLY_PRICE_LABEL}/mês`}
    />
  )
}
