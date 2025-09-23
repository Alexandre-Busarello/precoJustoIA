'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Building2 } from 'lucide-react'

interface CompanyLogoProps {
  logoUrl?: string | null
  companyName: string
  ticker: string
  size?: number
}

export function CompanyLogo({ 
  logoUrl, 
  companyName, 
  size = 80 
}: CompanyLogoProps) {
  const [hasError, setHasError] = useState(false)

  // Se não há URL ou houve erro, mostrar fallback
  if (!logoUrl || hasError) {
    return (
      <div 
        className="bg-gradient-to-br from-blue-500 to-violet-500 rounded-xl flex items-center justify-center"
        style={{ width: size, height: size }}
      >
        <Building2 className="w-10 h-10 text-white" />
      </div>
    )
  }

  return (
    <div 
      className="bg-white rounded-xl flex items-center justify-center overflow-hidden border"
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
