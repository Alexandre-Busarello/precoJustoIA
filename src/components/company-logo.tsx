'use client'

import { useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'

interface CompanyLogoProps {
  logoUrl?: string | null
  companyName: string
  ticker: string
  /** Lado em px. Com `sizeClassName`, vale só como resolução da imagem (o tamanho exibido vem das classes). */
  size?: number
  /** Classes de tamanho responsivo (ex.: `size-7 sm:size-8`); substituem o tamanho fixo em px. */
  sizeClassName?: string
  /** O nome/ticker já aparece ao lado: o logo vira decorativo para leitores de tela. */
  decorative?: boolean
  className?: string
}

/** Logo da empresa; sem imagem (ou com erro) mostra monograma neutro com as 2 primeiras letras do ticker. */
export function CompanyLogo({ logoUrl, companyName, ticker, size = 80, sizeClassName, decorative = false, className }: CompanyLogoProps) {
  const [hasError, setHasError] = useState(false)
  const monogram = (ticker || companyName || '?').replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase()
  const boxStyle = sizeClassName ? undefined : { width: size, height: size }
  const a11y = decorative ? { 'aria-hidden': true as const } : { role: 'img', 'aria-label': `Logo ${companyName}` }

  if (!logoUrl || hasError) {
    return (
      <div
        {...a11y}
        className={cn(
          'flex shrink-0 items-center justify-center rounded-md bg-muted font-semibold text-muted-foreground',
          sizeClassName && 'text-[10px] leading-none sm:text-[11px]',
          sizeClassName,
          className
        )}
        style={sizeClassName ? undefined : { ...boxStyle, fontSize: Math.max(10, Math.round(size * 0.36)) }}
      >
        {monogram}
      </div>
    )
  }

  // Fundo branco fixo de propósito: logos de terceiros costumam ter traço escuro sobre transparente
  // e precisam desse contraste também no tema escuro.
  return (
    <div
      className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-white', sizeClassName, className)}
      style={boxStyle}
    >
      <Image
        src={logoUrl}
        alt={decorative ? '' : `Logo ${companyName}`}
        width={size}
        height={size}
        className={cn('object-contain', sizeClassName && 'size-full')}
        onError={() => setHasError(true)}
        onLoad={() => setHasError(false)}
      />
    </div>
  )
}
