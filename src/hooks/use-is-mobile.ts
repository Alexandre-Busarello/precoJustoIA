'use client'

import { useState, useEffect } from 'react'

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false)
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    
    // Verificar no mount
    checkMobile()
    
    // Adicionar listener para resize
    window.addEventListener('resize', checkMobile)
    
    return () => {
      window.removeEventListener('resize', checkMobile)
    }
  }, [])
  
  return isMobile
}

