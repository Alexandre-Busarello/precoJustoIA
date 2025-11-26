'use client'

import { useState, useEffect } from 'react'
import { Button } from "@/components/ui/button"
import { X, Rocket, ArrowRight } from "lucide-react"
import Link from "next/link"

interface FloatingCTAProps {
  text: string
  href: string
  showAfterScroll?: number // pixels scrolled before showing
  className?: string
}

export function FloatingCTA({
  text,
  href,
  showAfterScroll = 300,
  className = ''
}: FloatingCTAProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    if (isDismissed) return

    const handleScroll = () => {
      const scrolled = window.scrollY
      setIsVisible(scrolled > showAfterScroll)
    }

    // Verificar posição inicial
    handleScroll()

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [showAfterScroll, isDismissed])

  if (isDismissed) return null

  return (
    <div className={`fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'} ${className}`}>
      <div className="bg-white dark:bg-background border-2 border-blue-600 rounded-full shadow-2xl px-4 py-2 flex items-center gap-3 max-w-md mx-auto">
        <Button
          size="sm"
          className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white rounded-full px-6"
          asChild
        >
          <Link href={href} className="flex items-center gap-2">
            <Rocket className="w-4 h-4" />
            <span className="font-semibold">{text}</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
        <button
          onClick={() => setIsDismissed(true)}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
          aria-label="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

