'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface CompanyLogoProps {
  logoUrl?: string | null
  companyName: string
  ticker: string
  size?: number
  className?: string
}

/** Logo da empresa; sem imagem (ou com erro) mostra monograma neutro com as 2 primeiras letras do ticker. */
export function CompanyLogo({ logoUrl, companyName, ticker, size = 80, className }: CompanyLogoProps) {
  const [hasError, setHasError] = useState(false)
  const monogram = (ticker || companyName || '?').replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase()

  if (!logoUrl || hasError) {
    return (
      <div
        role="img"
        aria-label={`Logo ${companyName}`}
        className={cn('flex shrink-0 items-center justify-center rounded-md bg-muted font-semibold text-muted-foreground', className)}
        style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) }}
      >
        {monogram}
      </div>
    )
  }

  // Fundo branco fixo de propósito: logos de terceiros costumam ter traço escuro sobre transparente
  // e precisam desse contraste também no tema escuro.
  return (
    <div
      className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-white', className)}
      style={{ width: size, height: size }}
    >
      <Image
        src={logoUrl}
        alt={`Logo ${companyName}`}
        width={size}
        height={size}
        className="object-contain"
        onError={() => setHasError(true)}
        onLoad={() => setHasError(false)}
      />
    </div>
  )
}
