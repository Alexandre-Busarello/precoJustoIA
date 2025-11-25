import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowLeft, AlertCircle } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="container mx-auto px-4 py-6 sm:py-8 max-w-5xl">
      <Link href="/radar-dividendos">
        <Button variant="ghost" className="mb-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Voltar ao Radar
        </Button>
      </Link>

      <Card>
        <CardContent className="p-8 text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Empresa não encontrada</h1>
          <p className="text-muted-foreground mb-6">
            Não foi possível encontrar informações sobre este ticker no Radar de Dividendos.
          </p>
          <Link href="/radar-dividendos">
            <Button>Voltar ao Radar de Dividendos</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}

