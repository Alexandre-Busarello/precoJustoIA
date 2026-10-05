import Link from "next/link"
import Image from "next/image"

import { cn } from "@/lib/utils"

/**
 * Logo do Preço Justo AI em SVG (public/brand), com versão para fundo escuro (troca pelo tema via `dark:`).
 * Controle a altura via `className` (ex.: `h-7`); a largura acompanha a proporção (502×107).
 * O símbolo isolado fica em /brand/logo-mark.svg.
 */
export function BrandLogo({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Link href="/" aria-label="Preço Justo AI, página inicial" className="inline-flex min-h-11 shrink-0 items-center">
      <Image
        src="/brand/logo.svg"
        alt="Preço Justo AI"
        width={502}
        height={107}
        unoptimized
        priority={priority}
        className={cn("w-auto dark:hidden", className)}
      />
      <Image
        src="/brand/logo-dark.svg"
        alt="Preço Justo AI"
        width={502}
        height={107}
        unoptimized
        priority={priority}
        className={cn("hidden w-auto dark:block", className)}
      />
    </Link>
  )
}
