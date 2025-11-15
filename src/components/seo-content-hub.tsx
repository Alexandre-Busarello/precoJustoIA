import { Card, CardContent } from "@/components/ui/card"
import { 
  Target, 
  TrendingUp, 
  Building2, 
  Sparkles,
  Brain,
  DollarSign,
  PieChart,
  Calculator,
  BarChart3
} from "lucide-react"

interface SEOContentHubProps {
  pageType: 'screening' | 'ranking'
}

export function SEOContentHub({ pageType }: SEOContentHubProps) {
  if (pageType === 'screening') {
    return (
      <div className="mt-12 space-y-8">
        {/* O que é Screening de Ações */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-8">
            <h2 className="text-3xl font-bold mb-4 text-slate-900 dark:text-white">
              O que é Screening de Ações?
            </h2>
            <div className="prose prose-slate dark:prose-invert max-w-none">
              <p className="text-lg text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                <strong>Screening de ações</strong> é uma técnica fundamentalista que permite encontrar empresas na Bolsa de Valores (B3) que atendem critérios específicos de investimento. Com nosso <strong>filtro customizável de ações</strong>, você pode buscar empresas por múltiplos indicadores financeiros simultaneamente.
              </p>
              <p className="text-lg text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
                Nossa ferramenta de <strong>screening fundamentalista</strong> analisa mais de <strong>350 empresas listadas na B3</strong>, incluindo ações brasileiras e BDRs (Brazilian Depositary Receipts), permitindo que você encontre oportunidades de investimento baseadas em seus próprios critérios de <strong>valuation, rentabilidade, crescimento e qualidade</strong>.
              </p>
              <h3 className="text-2xl font-semibold mt-6 mb-3 text-slate-900 dark:text-white">
                Como Funciona o Screening de Ações?
              </h3>
              <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300">
                <li><strong>Filtros de Valuation:</strong> P/L (Preço/Lucro), P/VP (Preço/Valor Patrimonial), EV/EBITDA, PSR (Preço/Receita)</li>
                <li><strong>Filtros de Rentabilidade:</strong> ROE (Retorno sobre Patrimônio Líquido), ROIC (Retorno sobre Capital Investido), ROA (Retorno sobre Ativos)</li>
                <li><strong>Filtros de Crescimento:</strong> CAGR de Lucros e Receitas (últimos 5 anos)</li>
                <li><strong>Filtros de Dividendos:</strong> Dividend Yield, Payout Ratio</li>
                <li><strong>Filtros de Endividamento:</strong> Dívida Líquida/PL, Dívida Líquida/EBITDA, Liquidez Corrente</li>
                <li><strong>Filtros de Tamanho:</strong> Market Cap, Small Caps, Mid Caps, Blue Chips</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Por que usar Screening */}
        <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
          <CardContent className="p-8">
            <h2 className="text-3xl font-bold mb-4 text-slate-900 dark:text-white">
              Por que Usar Screening de Ações?
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-xl font-semibold mb-2 text-blue-900 dark:text-blue-100">
                  <Target className="w-5 h-5 inline mr-2" />
                  Encontre Oportunidades Rapidamente
                </h3>
                <p className="text-slate-700 dark:text-slate-300">
                  Em vez de analisar centenas de ações manualmente, use <strong>filtros de ações</strong> para encontrar empresas que atendem seus critérios em segundos. Ideal para investidores que buscam <strong>ações subvalorizadas</strong> ou com características específicas.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-blue-900 dark:text-blue-100">
                  <TrendingUp className="w-5 h-5 inline mr-2" />
                  Análise Fundamentalista Profissional
                </h3>
                <p className="text-slate-700 dark:text-slate-300">
                  Nossa ferramenta utiliza dados financeiros reais da B3, processados com <strong>análise fundamentalista</strong> rigorosa. Todos os indicadores são calculados a partir de demonstrações financeiras oficiais.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-blue-900 dark:text-blue-100">
                  <Building2 className="w-5 h-5 inline mr-2" />
                  Filtros Combinados
                </h3>
                <p className="text-slate-700 dark:text-slate-300">
                  Combine múltiplos filtros simultaneamente para refinar sua busca. Por exemplo: ações com <strong>P/L baixo</strong>, <strong>ROE alto</strong> e <strong>dividend yield atrativo</strong>.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2 text-blue-900 dark:text-blue-100">
                  <Sparkles className="w-5 h-5 inline mr-2" />
                  Assistente com IA
                </h3>
                <p className="text-slate-700 dark:text-slate-300">
                  Use nosso <strong>assistente de IA</strong> para gerar filtros automaticamente baseados em sua descrição. Diga o que procura e nossa IA configura os filtros ideais para você.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Exemplos de Uso */}
        <Card className="border-0 shadow-lg">
          <CardContent className="p-8">
            <h2 className="text-3xl font-bold mb-4 text-slate-900 dark:text-white">
              Exemplos de Screening de Ações
            </h2>
            <div className="space-y-6">
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="text-xl font-semibold mb-2 text-slate-900 dark:text-white">
                  Encontrar Ações Value (Subvalorizadas)
                </h3>
                <p className="text-slate-700 dark:text-slate-300 mb-2">
                  Configure filtros para encontrar ações com:
                </p>
                <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-1">
                  <li>P/L menor que 12</li>
                  <li>P/VP menor que 1.5</li>
                  <li>ROE maior que 15%</li>
                  <li>Dívida Líquida/PL menor que 1.0</li>
                </ul>
              </div>
              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="text-xl font-semibold mb-2 text-slate-900 dark:text-white">
                  Buscar Ações com Dividendos Sustentáveis
                </h3>
                <p className="text-slate-700 dark:text-slate-300 mb-2">
                  Configure filtros para encontrar ações com:
                </p>
                <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-1">
                  <li>Dividend Yield maior que 4%</li>
                  <li>Payout Ratio menor que 80%</li>
                  <li>ROE maior que 12%</li>
                  <li>Crescimento de Lucros positivo nos últimos 5 anos</li>
                </ul>
              </div>
              <div className="border-l-4 border-purple-500 pl-4">
                <h3 className="text-xl font-semibold mb-2 text-slate-900 dark:text-white">
                  Identificar Empresas em Crescimento
                </h3>
                <p className="text-slate-700 dark:text-slate-300 mb-2">
                  Configure filtros para encontrar ações com:
                </p>
                <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-1">
                  <li>CAGR de Receitas maior que 10% (5 anos)</li>
                  <li>CAGR de Lucros maior que 15% (5 anos)</li>
                  <li>ROIC maior que 20%</li>
                  <li>Margem Líquida maior que 10%</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Conteúdo para ranking
  return (
    <div className="mt-12 space-y-8">
      {/* O que são Rankings de Ações */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-8">
          <h2 className="text-3xl font-bold mb-4 text-slate-900 dark:text-white">
            O que são Rankings de Ações?
          </h2>
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <p className="text-lg text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
              <strong>Rankings de ações</strong> são listas ordenadas de empresas da Bolsa de Valores (B3) baseadas em critérios específicos de <strong>análise fundamentalista</strong>. Nossa plataforma utiliza <strong>8 modelos consagrados de valuation</strong> para identificar as melhores oportunidades de investimento em ações brasileiras e BDRs.
            </p>
            <p className="text-lg text-slate-700 dark:text-slate-300 leading-relaxed mb-4">
              Cada modelo de <strong>ranking fundamentalista</strong> aplica uma metodologia diferente: desde a clássica <strong>Fórmula de Graham</strong> (gratuita) até análises avançadas com <strong>Inteligência Artificial</strong> que combinam múltiplas estratégias simultaneamente. Todos os rankings são gerados com dados financeiros reais da B3, processados através de <strong>análise fundamentalista rigorosa</strong>.
            </p>
            <h3 className="text-2xl font-semibold mt-6 mb-3 text-slate-900 dark:text-white">
              Por que Usar Rankings de Ações?
            </h3>
            <ul className="list-disc list-inside space-y-2 text-slate-700 dark:text-slate-300">
              <li><strong>Economize Tempo:</strong> Em vez de analisar centenas de ações manualmente, nossos rankings apresentam as melhores oportunidades já ordenadas</li>
              <li><strong>Metodologias Comprovadas:</strong> Utilizamos estratégias criadas por investidores lendários como Benjamin Graham e Joel Greenblatt</li>
              <li><strong>Análise Profunda:</strong> Cada ação no ranking recebe uma análise detalhada explicando por que foi selecionada</li>
              <li><strong>Preço Justo Calculado:</strong> Descubra o valor intrínseco de cada ação e o potencial de valorização (upside)</li>
              <li><strong>Histórico Salvo:</strong> Para usuários logados, todos os rankings são salvos para consulta futura</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Modelos Disponíveis */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20">
        <CardContent className="p-8">
          <h2 className="text-3xl font-bold mb-4 text-slate-900 dark:text-white">
            Modelos de Análise Fundamentalista Disponíveis
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xl font-semibold mb-2 text-blue-900 dark:text-blue-100">
                <Target className="w-5 h-5 inline mr-2" />
                Fórmula de Graham (Gratuito)
              </h3>
              <p className="text-slate-700 dark:text-slate-300">
                Método clássico criado por <strong>Benjamin Graham</strong>, o pai do value investing. Identifica ações subvalorizadas com margem de segurança incorporada. Ideal para investidores conservadores que buscam <strong>ações baratas</strong> e empresas sólidas.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2 text-blue-900 dark:text-blue-100">
                <Brain className="w-5 h-5 inline mr-2" />
                Análise Preditiva com IA (Premium)
              </h3>
              <p className="text-slate-700 dark:text-slate-300">
                <strong>Inteligência Artificial</strong> que combina TODAS as estratégias disponíveis. Usa machine learning para identificar padrões complexos e criar rankings preditivos personalizados. Considera análise técnica e fundamentalista simultaneamente.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2 text-blue-900 dark:text-blue-100">
                <DollarSign className="w-5 h-5 inline mr-2" />
                Dividend Yield Anti-Trap (Premium)
              </h3>
              <p className="text-slate-700 dark:text-slate-300">
                Foca em <strong>renda passiva sustentável</strong> evitando dividend traps. Analisa sustentabilidade do payout, histórico de pagamentos e qualidade da empresa. Ideal para investidores que buscam <strong>dividendos consistentes</strong>.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2 text-blue-900 dark:text-blue-100">
                <PieChart className="w-5 h-5 inline mr-2" />
                Fórmula Mágica (Premium)
              </h3>
              <p className="text-slate-700 dark:text-slate-300">
                Método de <strong>Joel Greenblatt</strong> que combina qualidade operacional (ROIC) e preço atrativo (Earnings Yield). Equilibra rentabilidade e valuation para encontrar empresas excelentes a preços justos.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2 text-blue-900 dark:text-blue-100">
                <Calculator className="w-5 h-5 inline mr-2" />
                Fluxo de Caixa Descontado - FCD (Premium)
              </h3>
              <p className="text-slate-700 dark:text-slate-300">
                Avaliação intrínseca por <strong>DCF (Discounted Cash Flow)</strong> com projeções sofisticadas de fluxo de caixa futuro. Calcula o valor intrínseco real da empresa considerando taxa de desconto e crescimento projetado.
              </p>
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-2 text-blue-900 dark:text-blue-100">
                <BarChart3 className="w-5 h-5 inline mr-2" />
                Fundamentalista 3+1 (Premium)
              </h3>
              <p className="text-slate-700 dark:text-slate-300">
                Análise simplificada com <strong>3 pilares essenciais</strong>: Qualidade (ROE, ROIC, margens), Preço (P/L, P/VP) e Endividamento (contexto por setor), mais bônus de dividendos sustentáveis.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

