'use client'

import { useEffect } from 'react'

interface PartnerTrackerProps {
  partnerId: string
}

export function PartnerTracker({ partnerId }: PartnerTrackerProps) {
  useEffect(() => {
    try {
      localStorage.setItem('partner_id', partnerId)
    } catch {
      // localStorage bloqueado (modo privado restrito) — ignorar silenciosamente
    }
  }, [partnerId])

  return null
}
