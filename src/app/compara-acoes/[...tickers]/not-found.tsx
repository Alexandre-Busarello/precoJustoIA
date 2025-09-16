import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Home, Search, BarChart3 } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="container mx-auto py-16 px-4">
      <div className="max-w-md mx-auto">
        <Card>
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-yellow-600 dark:text-yellow-500" />
            </div>
            
            <h1 className="text-2xl font-bold mb-2">Comparação Não Encontrada</h1>
            <p className="text-muted-foreground mb-6">
              Uma ou mais ações que você está tentando comparar não foram encontradas em nossa base de dados, ou você precisa fornecer pelo menos 2 tickers para comparação.
            </p>
            
            <div className="space-y-3">
              <Button asChild className="w-full">
                <Link href="/dashboard" className="flex items-center justify-center space-x-2">
                  <Home className="w-4 h-4" />
                  <span>Voltar ao Dashboard</span>
                </Link>
              </Button>
              
              <Button asChild variant="outline" className="w-full">
                <Link href="/ranking" className="flex items-center justify-center space-x-2">
                  <BarChart3 className="w-4 h-4" />
                  <span>Ver Rankings</span>
                </Link>
              </Button>
              
              <Button asChild variant="outline" className="w-full">
                <Link href="/compara-acoes/VALE3/PETR4" className="flex items-center justify-center space-x-2">
                  <Search className="w-4 h-4" />
                  <span>Exemplo: VALE3 vs PETR4</span>
                </Link>
              </Button>
            </div>
            
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>💡 Dica:</strong> Use URLs como /compara-acoes/VALE3/PETR4/ITUB4 para comparar múltiplas ações. Verifique se os tickers estão corretos e se as empresas estão listadas na B3.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
