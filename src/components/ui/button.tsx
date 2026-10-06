import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Botão base.
 * - Variantes: `default` (marca), `secondary` (neutro preenchido), `outline`, `ghost`, `destructive`, `link`.
 * - Tamanhos com alvo de toque de 44 px no mobile e compactos a partir de `md`.
 *   `icon-sm` usa um pseudo-elemento para estender a área clicável até 44 px.
 * - Um botão primário (`default`) por região visível; sem gradiente via `className`.
 */
const buttonVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-[3px] focus-visible:ring-ring aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        outline: "border border-border bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
        destructive: "bg-destructive text-primary-foreground hover:bg-destructive/90 focus-visible:ring-destructive/30",
        link: "text-brand underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 has-[>svg]:px-3 md:h-9",
        sm: "h-10 gap-1.5 px-3 has-[>svg]:px-2.5 md:h-8",
        lg: "h-12 px-6 has-[>svg]:px-4 md:h-10",
        icon: "size-11 md:size-9",
        "icon-sm": "size-9 before:absolute before:-inset-1 before:content-[''] md:size-8 md:before:-inset-1.5",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
