import Link from "next/link"
import Image from "next/image"

import { cn } from "@/lib/utils"

/**
 * Logo do Preço Justo AI com versão para fundo escuro (troca automática pelo tema).
 * Controle a altura via `className` (ex.: `h-7`).
 */
export function BrandLogo({ className, priority = false }: { className?: string; priority?: boolean }) {
  return (
    <Link href="/" aria-label="Preço Justo AI, página inicial" className="inline-flex min-h-11 shrink-0 items-center">
      <Image
        src="/logo-preco-justo.png"
        alt="Preço Justo AI"
        width={553}
        height={135}
        priority={priority}
        className={cn("w-auto dark:hidden", className)}
      />
      <Image
        src="/logo-preco-justo-dark.png"
        alt="Preço Justo AI"
        width={553}
        height={135}
        priority={priority}
        className={cn("hidden w-auto dark:block", className)}
      />
    </Link>
  )
}
