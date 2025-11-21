"use client"

import { useRouter } from "next/navigation"
import { MouseEvent } from "react"

interface InnerLinkButtonProps {
  href: string
  className?: string
  children: React.ReactNode
}

export function InnerLinkButton({ href, className, children }: InnerLinkButtonProps) {
  const router = useRouter()

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    router.push(href)
  }

  return (
    <button
      onClick={handleClick}
      className={className}
      type="button"
    >
      {children}
    </button>
  )
}

