'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { BarChart3, Rocket } from 'lucide-react'

export function BacktestCTALink() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const currentView = searchParams.get('view')

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    // Se já está na página de backtest e na view configure, fazer scroll suave
    if (pathname === '/backtest' && currentView === 'configure') {
      e.preventDefault()
      
      // Encontrar o elemento do formulário
      const targetElement = document.getElementById('backtest-config-form-start') || 
                            document.getElementById('backtest-configure')
      
      if (targetElement) {
        // Calcular offset aumentado para ficar mais para cima
        const offset = window.innerWidth < 768 ? 140 : 120
        const elementPosition = targetElement.getBoundingClientRect().top
        const offsetPosition = Math.max(0, elementPosition + window.pageYOffset - offset)

        // Scroll suave usando requestAnimationFrame para garantir suavidade
        requestAnimationFrame(() => {
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          })
        })
      }
    }
    // Caso contrário, deixar o Link do Next.js fazer a navegação normalmente
  }

  return (
    <Link
      href="/backtest?view=configure#backtest-configure"
      onClick={handleClick}
      className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white rounded-lg font-semibold text-sm shadow-lg hover:shadow-xl transition-all"
    >
      <BarChart3 className="w-4 h-4" />
      Criar Novo Backtest
      <Rocket className="w-4 h-4" />
    </Link>
  )
}

