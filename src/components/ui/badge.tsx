import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Badge de status. Variantes: `neutral`, `positive`, `negative`, `warning`, `brand`
 * (fundo `*-subtle` + texto semântico). Máximo de 2 por entidade.
 *
 * Nomes legados continuam aceitos: `default` → brand, `secondary`/`outline` → neutral, `destructive` → negative.
 */
const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 overflow-hidden whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-xs font-medium transition-colors focus-visible:ring-[3px] focus-visible:ring-ring [&>svg]:pointer-events-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        neutral: "border-border bg-transparent text-muted-foreground",
        positive: "border-transparent bg-positive-subtle text-positive",
        negative: "border-transparent bg-negative-subtle text-negative",
        warning: "border-transparent bg-warning-subtle text-warning",
        brand: "border-transparent bg-brand-subtle text-brand",
        default: "border-transparent bg-brand-subtle text-brand",
        secondary: "border-border bg-transparent text-muted-foreground",
        outline: "border-border bg-transparent text-muted-foreground",
        destructive: "border-transparent bg-negative-subtle text-negative",
      },
    },
    defaultVariants: {
      variant: "neutral",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
