'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, FileText, Copy, CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export function PortfolioTutorialPage() {
  const router = useRouter();

  return (
    <div className="container mx-auto px-2 sm:px-4 py-4 sm:py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/carteira')}
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">
              Tutorial: Importar Dados da B3
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Aprenda como importar suas transações da Área do Investidor da B3
            </p>
          </div>
        </div>

        {/* Video Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Vídeo Tutorial
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="aspect-video w-full rounded-lg overflow-hidden bg-muted">
              <iframe
                width="100%"
                height="100%"
                src="https://www.youtube.com/embed/NLRfHdcDZ_I"
                title="Tutorial: Como importar dados da B3"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </div>
            {/* <p className="text-sm text-muted-foreground mt-4 text-center">
              <strong>Nota:</strong> Substitua o vídeo acima pelo link correto do seu tutorial no YouTube
            </p> */}
          </CardContent>
        </Card>

        {/* Step by Step Guide */}
        <Card>
          <CardHeader>
            <CardTitle>Passo a Passo: Importar CSV da Área do Investidor B3</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="w-8 h-8 rounded-full flex items-center justify-center p-0">
                  1
                </Badge>
                <h3 className="text-lg font-semibold">Acesse a Área do Investidor da B3</h3>
              </div>
              <div className="ml-10 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Acesse a Área do Investidor da B3 e faça login na sua conta:
                </p>
                <div className="bg-muted p-3 rounded-md">
                  <code className="text-sm">https://www.investidor.b3.com.br/login</code>
                </div>
                <p className="text-sm text-muted-foreground">
                  Faça login com seus dados de acesso (CPF e senha).
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="w-8 h-8 rounded-full flex items-center justify-center p-0">
                  2
                </Badge>
                <h3 className="text-lg font-semibold">Navegue até a seção de Extratos</h3>
              </div>
              <div className="ml-10 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Após fazer login, procure pela seção de <strong>&quot;Extratos&quot;</strong> no menu lateral esquerdo.
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                  <li>Acesse a aba <strong>&quot;Negociações&quot;</strong></li>  
                </ul>
              </div>
            </div>

            {/* Step 3 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="w-8 h-8 rounded-full flex items-center justify-center p-0">
                  3
                </Badge>
                <h3 className="text-lg font-semibold">Selecione o Período e Exporte o Excel</h3>
              </div>
              <div className="ml-10 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Configure os filtros para exportar suas transações:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                  <li>Selecione o período desejado (ex: últimos 12 meses ou desde o início)</li>
                  <li>Clique em <strong>&quot;Baixar&quot;</strong> quando estiver satisfeito com o resultado</li>
                  <li>Selecione a opção &quot;Arquivo em Excel para ser importado em planilhas.&quot;</li>
                </ul>
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-md p-3 mt-2">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>💡 Dica:</strong> Exporte desde o início dos seus investimentos para ter o histórico completo.
                  </p>
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="w-8 h-8 rounded-full flex items-center justify-center p-0">
                  4
                </Badge>
                <h3 className="text-lg font-semibold">Abra o Arquivo Baixado</h3>
              </div>
              <div className="ml-10 space-y-2">
                <p className="text-sm text-muted-foreground">
                  O arquivo deve ser aberto em Excel ou Google Sheets e geralmente contém colunas como:
                </p>
                <div className="bg-muted p-3 rounded-md overflow-x-auto">
                  <code className="text-xs">
                    Data, Tipo de Movimentação, Produto, Quantidade, Preço, Valor, etc.
                  </code>
                </div>
                <p className="text-sm text-muted-foreground">
                  Copie o conteúdo completo do Excel ou Google Sheets com o Ctrl + C.
                </p>
              </div>
            </div>

            {/* Step 5 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="w-8 h-8 rounded-full flex items-center justify-center p-0">
                  5
                </Badge>
                <h3 className="text-lg font-semibold">Copie os Dados para o PreçoJustoAI</h3>
              </div>
              <div className="ml-10 space-y-2">
                <p className="text-sm text-muted-foreground">
                  No PreçoJustoAI, vá até sua carteira e:
                </p>
                <ol className="list-decimal list-inside text-sm text-muted-foreground space-y-1 ml-2">
                  <li>Clique em <strong>&quot;Atualizar Custódia / Importar Transações&quot;</strong></li>
                  <li>Selecione a aba <strong>&quot;Texto Inteligente&quot;</strong></li>
                  <li>Copie e cole o conteúdo copiado no campo de texto</li>
                  <li>A IA irá processar e identificar automaticamente todas as transações</li>
                </ol>
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-md p-3 mt-2">
                  <p className="text-sm text-green-800 dark:text-green-200 flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>Importante:</strong> Você pode copiar diretamente do Excel/CSV e colar no campo. 
                      A IA reconhece automaticamente o formato da B3 e processa as transações.
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Step 6 */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="w-8 h-8 rounded-full flex items-center justify-center p-0">
                  6
                </Badge>
                <h3 className="text-lg font-semibold">Revise e Confirme as Transações</h3>
              </div>
              <div className="ml-10 space-y-2">
                <p className="text-sm text-muted-foreground">
                  Após o processamento pela IA:
                </p>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 ml-2">
                  <li>Revise a tabela de pré-visualização com todas as transações identificadas</li>
                  <li>Verifique se as datas, valores e quantidades estão corretos</li>
                  <li>Confirme se todas as transações foram identificadas (compras, vendas, dividendos, etc.)</li>
                  <li>Clique em <strong>&quot;Aplicar Transações&quot;</strong> para salvar</li>
                </ul>
              </div>
            </div>

            {/* Tips Section */}
            <div className="border-t pt-6 mt-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Dicas Importantes
              </h3>
              <div className="space-y-3">
                <div className="bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-md p-3">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>⚠️ Atenção:</strong> Certifique-se de que o CSV contém todas as colunas necessárias 
                    (Data, Tipo, Ticker, Quantidade, Preço). Se alguma informação estiver faltando, 
                    você pode complementar manualmente após a importação.
                  </p>
                </div>
                <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 rounded-md p-3">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>💡 Dica:</strong> Se você já tem transações cadastradas, a IA evitará duplicatas 
                    automaticamente. Você pode importar o mesmo CSV várias vezes sem problemas.
                  </p>
                </div>
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 rounded-md p-3">
                  <p className="text-sm text-green-800 dark:text-green-200">
                    <strong>✅ Formato Suportado:</strong> A IA reconhece vários formatos de CSV da B3, 
                    incluindo variações de nomes de colunas. Se o sistema é inteligente o suficiente para 
                    identificar automaticamente o formato correto.
                  </p>
                </div>
              </div>
            </div>

            {/* Example CSV Format */}
            <div className="border-t pt-6 mt-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Copy className="h-5 w-5" />
                Exemplo de Formato CSV da B3
              </h3>
              <div className="bg-muted p-4 rounded-md overflow-x-auto">
                <pre className="text-xs">
{`Data,Produto,Tipo,Quantidade,Preço,Valor
01/01/2024,PETR4,Compra,100,32.50,3250.00
15/01/2024,VALE3,Compra,50,65.00,3250.00
01/02/2024,PETR4,Dividendo,100,0.25,25.00
15/02/2024,VALE3,Venda,25,68.00,1700.00`}
                </pre>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                O formato pode variar, mas a IA reconhece automaticamente os campos principais.
              </p>
            </div>

            {/* CTA */}
            <div className="border-t pt-6 mt-6">
              <div className="bg-primary/10 dark:bg-primary/20 border border-primary/20 rounded-lg p-6 text-center">
                <h3 className="text-lg font-semibold mb-2">Pronto para começar?</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Crie sua primeira carteira ou importe seus dados agora mesmo
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <Button onClick={() => router.push('/carteira/nova')}>
                    Criar Nova Carteira
                  </Button>
                  <Button variant="outline" onClick={() => router.push('/carteira')}>
                    Ver Minhas Carteiras
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

