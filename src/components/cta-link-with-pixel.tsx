'use client'

import Link from 'next/link'
import { ReactNode } from 'react'
import { useEngagementPixel } from '@/hooks/use-engagement-pixel'
import { useSession } from 'next-auth/react'

interface CTALinkWithPixelProps {
  href: string
  children: ReactNode
  className?: string
}

/**
 * Componente Link que dispara pixel de engajamento quando usuário deslogado clica
 * Usado em páginas server-side onde não podemos usar hooks diretamente nos Links
 */
export function CTALinkWithPixel({ href, children, className }: CTALinkWithPixelProps) {
  const { data: session } = useSession()
  const { trackEngagement } = useEngagementPixel()

  const handleClick = () => {
    if (!session) {
      trackEngagement()
    }
  }

  return (
    <Link href={href} onClick={handleClick} className={className}>
      {children}
    </Link>
  )
}

