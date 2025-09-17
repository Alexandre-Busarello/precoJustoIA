'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { 
  BarChart3, 
  Plus, 
  X, 
  TrendingUp
} from 'lucide-react'

interface StockComparisonSelectorProps {
  initialTickers?: string[]
}

export function StockComparisonSelector({ initialTickers = [] }: StockComparisonSelectorProps) {
  const [tickers, setTickers] = useState<string[]>(initialTickers)
  const [inputValue, setInputValue] = useState('')
  const router = useRouter()

  const addTicker = () => {
    const ticker = inputValue.toUpperCase().trim()
    if (ticker && !tickers.includes(ticker) && ticker.length <= 6) {
      setTickers([...tickers, ticker])
      setInputValue('')
    }
  }

  const removeTicker = (tickerToRemove: string) => {
    setTickers(tickers.filter(t => t !== tickerToRemove))
  }

  const handleCompare = () => {
    if (tickers.length >= 2) {
      router.push(`/compara-acoes/${tickers.join('/')}`)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      addTicker()
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <BarChart3 className="w-5 h-5" />
          <span>Comparar Ações</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Input para adicionar tickers */}
        <div className="flex space-x-2">
          <Input
            placeholder="Digite o ticker (ex: VALE3)"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1"
            maxLength={6}
          />
          <Button 
            onClick={addTicker}
            disabled={!inputValue.trim() || tickers.includes(inputValue.toUpperCase().trim())}
            size="sm"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Lista de tickers selecionados */}
        {tickers.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Ações selecionadas:</p>
            <div className="flex flex-wrap gap-2">
              {tickers.map((ticker) => (
                <Badge key={ticker} variant="secondary" className="flex items-center space-x-1">
                  <span>{ticker}</span>
                  <button
                    onClick={() => removeTicker(ticker)}
                    className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Botão de comparação */}
        <div className="flex flex-col space-y-2">
          <Button 
            onClick={handleCompare}
            disabled={tickers.length < 2}
            className="w-full"
          >
            <TrendingUp className="w-4 h-4 mr-2" />
            Comparar {tickers.length} Ações
          </Button>
          
          {tickers.length < 2 && (
            <p className="text-xs text-muted-foreground text-center">
              Adicione pelo menos 2 ações para comparar
            </p>
          )}
        </div>

        {/* Exemplos de comparação */}
        <div className="pt-4 border-t">
          <p className="text-sm font-medium mb-2">Exemplos populares:</p>
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push('/compara-acoes/VALE3/PETR4')}
            >
              VALE3 vs PETR4
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push('/compara-acoes/ITUB4/BBDC4/SANB11')}
            >
              Bancos
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => router.push('/compara-acoes/MGLU3/AMER3/LREN3')}
            >
              Varejo
            </Button>
          </div>
        </div>

        {/* Dica de uso */}
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-xs text-blue-800 dark:text-blue-200">
            <strong>💡 Dica:</strong> Você pode comparar até 6 ações simultaneamente. 
            Use tickers válidos da B3 (ex: VALE3, PETR4, ITUB4).
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
