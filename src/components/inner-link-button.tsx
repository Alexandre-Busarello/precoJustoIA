"use client"

import { useRouter } from "next/navigation"
import { MouseEvent } from "react"
import { cn } from "@/lib/utils"

interface InnerLinkButtonProps {
  href: string
  className?: string
  children: React.ReactNode
}

/** Link secundário dentro de um card clicável: navega sem disparar o clique do card. */
export function InnerLinkButton({ href, className, children }: InnerLinkButtonProps) {
  const router = useRouter()

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    router.push(href)
  }

  return (
    <button
      onClick={handleClick}
      className={cn("cursor-pointer text-sm font-medium text-brand underline-offset-4 hover:underline", className)}
      type="button"
    >
      {children}
    </button>
  )
}
