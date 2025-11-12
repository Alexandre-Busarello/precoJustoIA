"use client"

import { useState, useRef, useEffect } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  BarChart3, 
  GitCompare, 
  TrendingUp, 
  ChevronDown,
  Wrench,
  Building2,
  Search,
  Calculator
} from "lucide-react"

interface ToolsDropdownProps {
  isPremium: boolean
}

export function ToolsDropdown({ isPremium }: ToolsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Close dropdown when pathname changes
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  const isToolsActive = ['/ranking', '/comparador', '/backtest', '/analise-setorial', '/screening-acoes', '/calculadoras'].includes(pathname)

  const tools = [
    {
      href: '/ranking',
      icon: <BarChart3 className="w-4 h-4" />,
      title: 'Rankings',
      description: 'Análise fundamentalista automatizada',
      isPremium: false
    },
    {
      href: '/screening-acoes',
      icon: <Search className="w-4 h-4" />,
      title: 'Screening de Ações',
      description: 'Filtros customizáveis por categoria',
      isPremium: false,
      isNew: true
    },
    {
      href: '/analise-setorial',
      icon: <Building2 className="w-4 h-4" />,
      title: 'Análise Setorial',
      description: 'Compare setores da B3',
      isPremium: false
    },
    {
      href: '/comparador',
      icon: <GitCompare className="w-4 h-4" />,
      title: 'Comparador',
      description: 'Compare ações lado a lado',
      isPremium: false
    },
    {
      href: '/backtest',
      icon: <TrendingUp className="w-4 h-4" />,
      title: 'Backtesting',
      description: 'Simule carteiras históricas',
      isPremium: true
    }
  ]

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant={isToolsActive ? "default" : "ghost"}
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2"
      >
        <Wrench className="w-4 h-4" />
        Ferramentas
        <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-80 bg-background border border-border rounded-lg shadow-lg z-50">
          <div className="p-2">
            {tools.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className={`flex items-center gap-3 p-3 rounded-md hover:bg-muted transition-colors ${
                  pathname === tool.href ? 'bg-muted' : ''
                }`}
              >
                <div className={`p-2 rounded-lg ${
                  tool.isPremium 
                    ? 'bg-gradient-to-br from-emerald-500 to-teal-500' 
                    : tool.href === '/analise-setorial'
                    ? 'bg-gradient-to-br from-indigo-500 to-blue-500'
                    : 'bg-gradient-to-br from-blue-500 to-purple-500'
                }`}>
                  <div className="text-white">
                    {tool.icon}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{tool.title}</span>
                    {tool.isPremium && !isPremium && (
                      <Badge variant="default" className="text-xs bg-gradient-to-r from-emerald-500 to-teal-500">
                        Premium
                      </Badge>
                    )}
                    {(tool.isNew || tool.href === '/analise-setorial') && (
                      <Badge variant="secondary" className="text-xs bg-gradient-to-r from-orange-500 to-red-500 text-white">
                        🚀 Novo
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{tool.description}</p>
                </div>
              </Link>
            ))}
            
            {/* Separador */}
            <div className="border-t border-border my-2"></div>
            
            {/* Seção Calculadoras */}
            <div className="px-2 py-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Calculadoras</p>
              <Link
                href="/calculadoras/dividend-yield"
                className={`flex items-center gap-3 p-3 rounded-md hover:bg-muted transition-colors ${
                  pathname?.startsWith('/calculadoras/dividend-yield') ? 'bg-muted' : ''
                }`}
              >
                <div className="p-2 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500">
                  <div className="text-white">
                    <Calculator className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">Dividend Yield</span>
                    <Badge variant="secondary" className="text-xs bg-gradient-to-r from-green-500 to-emerald-500 text-white">
                      Grátis
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Calcule renda passiva com dividendos</p>
                </div>
              </Link>
            </div>
          </div>
          
          {/* Footer do dropdown */}
          <div className="border-t border-border p-3 bg-muted/30">
            <p className="text-xs text-muted-foreground text-center">
              💡 Mais ferramentas em breve!
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
