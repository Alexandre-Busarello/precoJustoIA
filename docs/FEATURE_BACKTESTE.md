# 📊 FEATURE: Backtesting de Carteira de Investimentos

## 🎯 VISÃO GERAL

A funcionalidade de **Backtesting de Carteira de Investimentos** permitirá aos usuários simular o desempenho histórico de carteiras personalizadas com rebalanceamento automático e aportes mensais, gerando relatórios completos de performance com métricas avançadas de risco e retorno.

### Principais Funcionalidades

- ✅ **Simulação Histórica**: Teste carteiras com dados reais do mercado
- ✅ **Aportes Mensais**: Simule investimentos regulares com DCA (Dollar Cost Averaging)
- ✅ **Rebalanceamento Automático**: Mantenha alocações-alvo automaticamente
- ✅ **Métricas Avançadas**: Sharpe Ratio, drawdown máximo, volatilidade, consistência
- ✅ **Integração Fluida**: Adicione ativos diretamente das páginas de análise
- ✅ **Tratamento Inteligente**: Lide com dados históricos inconsistentes
- ✅ **Relatórios Detalhados**: Visualizações e análises completas

---

## 🗄️ ESTRUTURA DO BANCO DE DADOS

### 1. Novos Modelos Prisma

```prisma
// Configurações de backtesting salvos pelo usuário
model BacktestConfig {
  id                String   @id @default(cuid())
  userId            String   @map("user_id")
  name              String   // Nome da simulação
  description       String?  // Descrição opcional
  
  // Parâmetros da simulação
  startDate         DateTime @map("start_date") @db.Date
  endDate           DateTime @map("end_date") @db.Date
  monthlyContribution Decimal @map("monthly_contribution") @db.Decimal(12, 2)
  rebalanceFrequency String  @default("monthly") // monthly, quarterly, yearly
  
  // Metadados
  createdAt         DateTime @default(now()) @map("created_at")
  updatedAt         DateTime @updatedAt @map("updated_at")
  
  // Relacionamentos
  user              User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  assets            BacktestAsset[]
  results           BacktestResult[]
  
  @@map("backtest_configs")
}

// Ativos da carteira com alocação percentual
model BacktestAsset {
  id              String   @id @default(cuid())
  backtestId      String   @map("backtest_id")
  ticker          String
  targetAllocation Decimal @map("target_allocation") @db.Decimal(5, 4) // Ex: 0.2500 = 25%
  
  backtest        BacktestConfig @relation(fields: [backtestId], references: [id], onDelete: Cascade)
  
  @@unique([backtestId, ticker])
  @@map("backtest_assets")
}

// Resultados da simulação
model BacktestResult {
  id              String   @id @default(cuid())
  backtestId      String   @map("backtest_id")
  
  // Métricas gerais
  totalReturn     Decimal  @map("total_return") @db.Decimal(10, 4)     // Retorno total %
  annualizedReturn Decimal @map("annualized_return") @db.Decimal(10, 4) // Retorno anualizado %
  volatility      Decimal  @db.Decimal(10, 4)                          // Volatilidade anualizada %
  sharpeRatio     Decimal? @map("sharpe_ratio") @db.Decimal(10, 4)     // Sharpe Ratio
  maxDrawdown     Decimal  @map("max_drawdown") @db.Decimal(10, 4)     // Drawdown máximo %
  
  // Estatísticas de consistência
  positiveMonths  Int      @map("positive_months")
  negativeMonths  Int      @map("negative_months")
  totalMonths     Int      @map("total_months")
  
  // Valores finais
  totalInvested   Decimal  @map("total_invested") @db.Decimal(15, 2)   // Total aportado
  finalValue      Decimal  @map("final_value") @db.Decimal(15, 2)      // Valor final da carteira
  
  // Dados detalhados (JSON)
  monthlyReturns  Json     @map("monthly_returns")    // Array de retornos mensais
  assetPerformance Json    @map("asset_performance")  // Performance por ativo
  portfolioEvolution Json  @map("portfolio_evolution") // Evolução mês a mês
  
  // Metadados
  calculatedAt    DateTime @default(now()) @map("calculated_at")
  
  backtest        BacktestConfig @relation(fields: [backtestId], references: [id], onDelete: Cascade)
  
  @@unique([backtestId]) // Um resultado por configuração
  @@map("backtest_results")
}
```

### 2. Atualização do Modelo User

```prisma
model User {
  // ... campos existentes ...
  backtestConfigs BacktestConfig[]
}
```

---

## 🧮 LÓGICA DE BACKTESTING

### 1. Serviço Principal (`src/lib/backtest-service.ts`)

```typescript
interface BacktestParams {
  assets: Array<{ ticker: string; allocation: number }>;
  startDate: Date;
  endDate: Date;
  monthlyContribution: number;
  rebalanceFrequency: 'monthly' | 'quarterly' | 'yearly';
}

interface BacktestResult {
  totalReturn: number;
  annualizedReturn: number;
  volatility: number;
  sharpeRatio: number;
  maxDrawdown: number;
  positiveMonths: number;
  negativeMonths: number;
  totalInvested: number;
  finalValue: number;
  monthlyReturns: Array<{
    date: string;
    return: number;
    portfolioValue: number;
    contribution: number;
  }>;
  assetPerformance: Array<{
    ticker: string;
    allocation: number;
    finalValue: number;
    totalReturn: number;
    contribution: number;
  }>;
}

export class BacktestService {
  // Executar simulação completa
  async runBacktest(params: BacktestParams): Promise<BacktestResult>
  
  // Obter preços históricos mensais
  private async getHistoricalPrices(tickers: string[], startDate: Date, endDate: Date)
  
  // Simular evolução mês a mês
  private simulatePortfolioEvolution(prices: PriceData[], params: BacktestParams)
  
  // Rebalancear carteira
  private rebalancePortfolio(currentHoldings: Holdings, targetAllocations: Allocation[], currentPrices: Prices)
  
  // Calcular métricas de performance
  private calculateMetrics(monthlyReturns: number[], portfolioValues: number[])
}
```

### 2. Algoritmo de Simulação

#### Fluxo Principal:

1. **Inicialização**: Começar com aporte inicial na data de início
2. **Loop Mensal**:
   - Adicionar aporte mensal
   - Aplicar retornos dos ativos baseado nos preços históricos
   - Rebalancear se necessário (conforme frequência)
   - Registrar valor da carteira e retorno do período
3. **Cálculo de Métricas**: Computar todas as métricas de performance

#### Exemplo de Implementação:

```typescript
async simulatePortfolioEvolution(prices: PriceData[], params: BacktestParams) {
  let portfolioValue = 0;
  let holdings: Map<string, number> = new Map();
  const monthlyReturns: number[] = [];
  const portfolioEvolution: PortfolioSnapshot[] = [];
  
  const monthlyDates = this.generateMonthlyDates(params.startDate, params.endDate);
  
  for (let i = 0; i < monthlyDates.length; i++) {
    const currentDate = monthlyDates[i];
    const previousDate = i > 0 ? monthlyDates[i - 1] : null;
    
    // 1. Adicionar aporte mensal
    portfolioValue += params.monthlyContribution;
    
    // 2. Aplicar retornos dos ativos (se não for o primeiro mês)
    if (previousDate) {
      portfolioValue = this.applyAssetReturns(
        portfolioValue, 
        holdings, 
        prices, 
        previousDate, 
        currentDate
      );
    }
    
    // 3. Rebalancear carteira
    if (this.shouldRebalance(currentDate, params.rebalanceFrequency)) {
      holdings = this.rebalancePortfolio(
        portfolioValue, 
        params.assets, 
        prices[currentDate]
      );
    }
    
    // 4. Calcular retorno mensal
    const monthlyReturn = previousDate ? 
      (portfolioValue - previousPortfolioValue) / previousPortfolioValue : 0;
    
    monthlyReturns.push(monthlyReturn);
    portfolioEvolution.push({
      date: currentDate,
      value: portfolioValue,
      holdings: new Map(holdings),
      monthlyReturn
    });
  }
  
  return { monthlyReturns, portfolioEvolution };
}
```

---

## 🎨 INTERFACE DO USUÁRIO

### 1. Estrutura de Páginas

```
/backtest
├── page.tsx                 # Página principal
├── [id]/
│   └── page.tsx            # Visualizar backtest específico
└── compare/
    └── page.tsx            # Comparar múltiplos backtests
```

### 2. Componentes Principais

#### 2.1 Página Principal (`src/app/backtest/page.tsx`)

```typescript
export default function BacktestPage() {
  return (
    <div className="container mx-auto py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Coluna 1: Configuração */}
        <div className="lg:col-span-1">
          <BacktestConfigForm />
        </div>
        
        {/* Coluna 2-3: Resultados */}
        <div className="lg:col-span-2">
          <BacktestResults />
          <BacktestHistory />
        </div>
      </div>
    </div>
  );
}
```

#### 2.2 Formulário de Configuração (`src/components/backtest-config-form.tsx`)

```typescript
interface BacktestConfigFormProps {
  initialAssets?: Array<{ ticker: string; companyName: string }>;
}

export function BacktestConfigForm({ initialAssets }: BacktestConfigFormProps) {
  const [assets, setAssets] = useState<BacktestAsset[]>([]);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [monthlyContribution, setMonthlyContribution] = useState<number>(1000);
  const [rebalanceFrequency, setRebalanceFrequency] = useState<string>('monthly');
  
  // Carregar ativos pré-configurados do localStorage
  useEffect(() => {
    const preconfiguredAssets = localStorage.getItem('backtest-preconfigured-assets');
    if (preconfiguredAssets) {
      const assets = JSON.parse(preconfiguredAssets);
      // Processar e adicionar à configuração
    }
  }, []);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuração do Backtest</CardTitle>
        <CardDescription>
          Configure sua carteira e parâmetros de simulação
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Seleção de Ativos */}
        <AssetSelector 
          assets={assets}
          onAssetsChange={setAssets}
        />
        
        {/* Alocação Percentual */}
        <AllocationSliders 
          assets={assets}
          onAllocationChange={handleAllocationChange}
        />
        
        {/* Período */}
        <DateRangePicker 
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={setStartDate}
          onEndDateChange={setEndDate}
        />
        
        {/* Aportes Mensais */}
        <MonthlyContributionInput 
          value={monthlyContribution}
          onChange={setMonthlyContribution}
        />
        
        {/* Frequência de Rebalanceamento */}
        <RebalanceFrequencySelector 
          value={rebalanceFrequency}
          onChange={setRebalanceFrequency}
        />
        
        {/* Botões de Ação */}
        <div className="flex gap-3">
          <Button onClick={handleRunBacktest} className="flex-1">
            <TrendingUp className="w-4 h-4 mr-2" />
            Executar Simulação
          </Button>
          <Button variant="outline" onClick={handleSaveConfig}>
            <Save className="w-4 h-4 mr-2" />
            Salvar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

#### 2.3 Resultados (`src/components/backtest-results.tsx`)

```typescript
interface BacktestResultsProps {
  result: BacktestResult;
  validation?: BacktestDataValidation;
}

export function BacktestResults({ result, validation }: BacktestResultsProps) {
  return (
    <div className="space-y-6">
      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard 
          title="Retorno Total"
          value={formatPercentage(result.totalReturn)}
          icon={<TrendingUp />}
          color="green"
        />
        <MetricCard 
          title="Retorno Anualizado"
          value={formatPercentage(result.annualizedReturn)}
          icon={<Calendar />}
          color="blue"
        />
        <MetricCard 
          title="Volatilidade"
          value={formatPercentage(result.volatility)}
          icon={<Activity />}
          color="orange"
        />
        <MetricCard 
          title="Sharpe Ratio"
          value={result.sharpeRatio?.toFixed(2) || 'N/A'}
          icon={<Target />}
          color="purple"
        />
      </div>
      
      {/* Gráfico de Evolução */}
      <Card>
        <CardHeader>
          <CardTitle>Evolução da Carteira</CardTitle>
        </CardHeader>
        <CardContent>
          <PortfolioEvolutionChart data={result.portfolioEvolution} />
        </CardContent>
      </Card>
      
      {/* Performance por Ativo */}
      <Card>
        <CardHeader>
          <CardTitle>Performance por Ativo</CardTitle>
        </CardHeader>
        <CardContent>
          <AssetPerformanceTable data={result.assetPerformance} />
        </CardContent>
      </Card>
      
      {/* Métricas de Risco */}
      <Card>
        <CardHeader>
          <CardTitle>Análise de Risco</CardTitle>
        </CardHeader>
        <CardContent>
          <RiskMetricsPanel 
            maxDrawdown={result.maxDrawdown}
            volatility={result.volatility}
            positiveMonths={result.positiveMonths}
            negativeMonths={result.negativeMonths}
          />
        </CardContent>
      </Card>
      
      {/* Heatmap de Retornos Mensais */}
      <Card>
        <CardHeader>
          <CardTitle>Consistência Mensal</CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlyReturnsHeatmap data={result.monthlyReturns} />
        </CardContent>
      </Card>
      
      {/* Informações sobre Qualidade dos Dados */}
      {validation && (
        <BacktestDataQualityPanel validation={validation} />
      )}
    </div>
  );
}
```

---

## 🔗 INTEGRAÇÃO COM PÁGINAS EXISTENTES

### 1. Componente de Botão "Adicionar ao Backtest"

#### Arquivo: `src/components/add-to-backtest-button.tsx`

```typescript
interface AddToBacktestButtonProps {
  ticker: string;
  companyName: string;
  currentPrice?: number;
  source?: 'ticker-page' | 'ranking' | 'comparison';
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

export function AddToBacktestButton({ 
  ticker, 
  companyName, 
  currentPrice,
  source = 'ticker-page',
  variant = 'outline',
  size = 'sm'
}: AddToBacktestButtonProps) {
  const { data: session } = useSession();
  const router = useRouter();
  
  const handleAddToBacktest = () => {
    // Verificar se usuário está logado
    if (!session) {
      router.push('/login?redirect=/backtest');
      return;
    }

    // Salvar no localStorage para pré-configurar
    const backtestAsset = {
      ticker,
      companyName,
      currentPrice,
      addedAt: new Date().toISOString(),
      source
    };
    
    // Adicionar à lista de ativos pré-configurados
    const existingAssets = JSON.parse(
      localStorage.getItem('backtest-preconfigured-assets') || '[]'
    );
    
    // Evitar duplicatas
    const filteredAssets = existingAssets.filter(
      (asset: any) => asset.ticker !== ticker
    );
    
    const updatedAssets = [...filteredAssets, backtestAsset];
    localStorage.setItem('backtest-preconfigured-assets', JSON.stringify(updatedAssets));
    
    // Feedback visual
    toast.success(`${ticker} adicionado ao backtest!`);
    
    // Redirecionar para página de backtest
    router.push('/backtest?preconfigured=true');
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleAddToBacktest}
      className={cn("gap-2", className)}
    >
      <TrendingUp className="w-4 h-4" />
      <span className="hidden sm:inline">Adicionar ao Backtest</span>
      <span className="sm:hidden">Backtest</span>
    </Button>
  );
}
```

### 2. Integrações Específicas

#### 2.1 Página do Ativo (`src/app/acao/[ticker]/page.tsx`)

```typescript
// Adicionar após o botão "Comparador Inteligente" (linha ~534)
{smartComparatorUrl && (
  <div className="mb-4 flex gap-2">
    <Button asChild>
      <Link href={smartComparatorUrl}>
        <GitCompare className="w-4 h-4 mr-2" />
        Comparador Inteligente
      </Link>
    </Button>
    
    {/* NOVO: Botão Adicionar ao Backtest */}
    <AddToBacktestButton
      ticker={ticker}
      companyName={companyData.name}
      currentPrice={currentPrice}
      source="ticker-page"
    />
  </div>
)}
```

#### 2.2 Quick Ranker (`src/components/quick-ranker.tsx`)

```typescript
// Modificar a estrutura dos resultados (linha ~1103)
<div className="border-t pt-3 sm:pt-4">
  <div className="flex items-center justify-between mb-2">
    <div className="flex items-center gap-2">
      <Target className="w-3 h-3 text-blue-600" />
      <h5 className="font-semibold text-xs text-blue-600">Análise Individual</h5>
    </div>
    
    {/* NOVO: Botão Adicionar ao Backtest */}
    <AddToBacktestButton
      ticker={result.ticker}
      companyName={result.name}
      currentPrice={result.currentPrice}
      source="ranking"
      variant="ghost"
      size="sm"
      className="text-xs"
    />
  </div>
  <MarkdownRenderer content={result.rational} className="text-xs leading-relaxed" />
</div>
```

#### 2.3 Tabela de Comparação (`src/components/comparison-table.tsx`)

```typescript
// Adicionar nova seção (após linha ~492)
<div className="mt-4 sm:mt-6 pt-3 sm:pt-4 border-t">
  <div className="flex items-center justify-between mb-3">
    <h4 className="font-semibold text-sm sm:text-base">Análises Individuais</h4>
    
    {/* NOVO: Botão para adicionar todas ao backtest */}
    <Button
      variant="outline"
      size="sm"
      onClick={() => handleAddAllToBacktest(companies)}
      className="text-xs"
    >
      <TrendingUp className="w-3 h-3 mr-1" />
      Adicionar Todas ao Backtest
    </Button>
  </div>
  
  <div className="flex flex-wrap gap-2">
    {companies.map((company) => (
      <div key={company.ticker} className="flex gap-1">
        <Button asChild variant="outline" size="sm" className="text-xs sm:text-sm">
          <Link href={`/acao/${company.ticker}`}>
            <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
            {company.ticker}
          </Link>
        </Button>
        
        {/* NOVO: Botão individual de backtest */}
        <AddToBacktestButton
          ticker={company.ticker}
          companyName={company.name}
          currentPrice={company.currentPrice}
          source="comparison"
          variant="ghost"
          size="sm"
        />
      </div>
    ))}
  </div>
</div>
```

---

## 📊 TRATAMENTO DE DADOS HISTÓRICOS INCONSISTENTES

### 1. Serviço de Validação (`src/lib/backtest-data-validator.ts`)

```typescript
interface DataAvailability {
  ticker: string;
  availableFrom: Date;
  availableTo: Date;
  totalMonths: number;
  missingMonths: number;
  dataQuality: 'excellent' | 'good' | 'fair' | 'poor';
  warnings: string[];
}

interface BacktestDataValidation {
  isValid: boolean;
  adjustedStartDate: Date;
  adjustedEndDate: Date;
  assetsAvailability: DataAvailability[];
  globalWarnings: string[];
  recommendations: string[];
}

export class BacktestDataValidator {
  
  /**
   * Valida disponibilidade de dados históricos para todos os ativos
   */
  async validateBacktestData(
    assets: Array<{ ticker: string; allocation: number }>,
    requestedStartDate: Date,
    requestedEndDate: Date
  ): Promise<BacktestDataValidation> {
    
    const assetsAvailability: DataAvailability[] = [];
    const globalWarnings: string[] = [];
    const recommendations: string[] = [];
    
    // Verificar dados para cada ativo
    for (const asset of assets) {
      const availability = await this.checkAssetDataAvailability(
        asset.ticker, 
        requestedStartDate, 
        requestedEndDate
      );
      assetsAvailability.push(availability);
    }
    
    // Encontrar período comum mais amplo possível
    const commonPeriod = this.findOptimalCommonPeriod(
      assetsAvailability, 
      requestedStartDate, 
      requestedEndDate
    );
    
    // Gerar warnings e recomendações
    this.generateWarningsAndRecommendations(
      assetsAvailability, 
      commonPeriod, 
      globalWarnings, 
      recommendations
    );
    
    return {
      isValid: commonPeriod.monthsAvailable >= 12, // Mínimo 1 ano
      adjustedStartDate: commonPeriod.startDate,
      adjustedEndDate: commonPeriod.endDate,
      assetsAvailability,
      globalWarnings,
      recommendations
    };
  }
}
```

### 2. Backtesting Adaptativo (`src/lib/adaptive-backtest-service.ts`)

```typescript
export class AdaptiveBacktestService extends BacktestService {
  
  /**
   * Executa backtesting com tratamento inteligente de dados faltantes
   */
  async runAdaptiveBacktest(params: BacktestParams): Promise<BacktestResult> {
    
    // 1. Validar dados disponíveis
    const validator = new BacktestDataValidator();
    const validation = await validator.validateBacktestData(
      params.assets,
      params.startDate,
      params.endDate
    );
    
    if (!validation.isValid) {
      throw new Error('Dados insuficientes para realizar o backtesting');
    }
    
    // 2. Ajustar parâmetros baseado na validação
    const adjustedParams = {
      ...params,
      startDate: validation.adjustedStartDate,
      endDate: validation.adjustedEndDate
    };
    
    // 3. Obter preços históricos com fallbacks
    const pricesData = await this.getHistoricalPricesWithFallbacks(
      params.assets.map(a => a.ticker),
      adjustedParams.startDate,
      adjustedParams.endDate
    );
    
    // 4. Executar simulação adaptativa
    const portfolioEvolution = await this.simulateAdaptivePortfolio(
      pricesData,
      adjustedParams,
      validation.assetsAvailability
    );
    
    // 5. Calcular métricas e incluir informações de qualidade dos dados
    const result = await this.calculateMetricsWithDataQuality(
      portfolioEvolution,
      validation
    );
    
    return result;
  }
  
  /**
   * Calcula contribuição proporcional quando nem todos os ativos estão disponíveis
   */
  private calculateProportionalContribution(
    plannedContribution: number,
    availableAssetsCount: number,
    totalAssetsCount: number
  ): number {
    // Se todos os ativos estão disponíveis, usar contribuição total
    if (availableAssetsCount === totalAssetsCount) {
      return plannedContribution;
    }
    
    // Caso contrário, manter a contribuição total mas concentrar nos ativos disponíveis
    // Isso evita "perder" aportes quando alguns ativos não têm dados
    return plannedContribution;
  }
  
  /**
   * Ajusta alocações quando nem todos os ativos estão disponíveis
   */
  private adjustAllocationsForAvailableAssets(
    originalAssets: Array<{ ticker: string; allocation: number }>,
    availableAssets: string[]
  ): Array<{ ticker: string; allocation: number }> {
    
    // Filtrar apenas ativos disponíveis
    const availableOriginalAssets = originalAssets.filter(
      asset => availableAssets.includes(asset.ticker)
    );
    
    // Calcular soma das alocações disponíveis
    const totalAvailableAllocation = availableOriginalAssets.reduce(
      (sum, asset) => sum + asset.allocation, 0
    );
    
    // Normalizar para somar 100%
    return availableOriginalAssets.map(asset => ({
      ticker: asset.ticker,
      allocation: asset.allocation / totalAvailableAllocation
    }));
  }
}
```

### 3. Interface de Qualidade dos Dados (`src/components/backtest-data-quality-panel.tsx`)

```typescript
interface DataQualityPanelProps {
  validation: BacktestDataValidation;
  onAccept: () => void;
  onCancel: () => void;
}

export function BacktestDataQualityPanel({ 
  validation, 
  onAccept, 
  onCancel 
}: DataQualityPanelProps) {
  
  const getQualityColor = (quality: DataAvailability['dataQuality']) => {
    switch (quality) {
      case 'excellent': return 'text-green-600 bg-green-50';
      case 'good': return 'text-blue-600 bg-blue-50';
      case 'fair': return 'text-yellow-600 bg-yellow-50';
      case 'poor': return 'text-red-600 bg-red-50';
    }
  };
  
  return (
    <Card className="border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-600" />
          Qualidade dos Dados Históricos
        </CardTitle>
        <CardDescription>
          Alguns ajustes foram necessários baseados na disponibilidade dos dados históricos
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Período Ajustado */}
        <div className="p-4 bg-blue-50 rounded-lg">
          <h4 className="font-semibold mb-2">📅 Período Ajustado</h4>
          <p className="text-sm text-muted-foreground">
            <strong>Original:</strong> {validation.requestedStartDate.toLocaleDateString('pt-BR')} - {validation.requestedEndDate.toLocaleDateString('pt-BR')}
          </p>
          <p className="text-sm">
            <strong>Ajustado:</strong> {validation.adjustedStartDate.toLocaleDateString('pt-BR')} - {validation.adjustedEndDate.toLocaleDateString('pt-BR')}
          </p>
        </div>
        
        {/* Qualidade por Ativo */}
        <div>
          <h4 className="font-semibold mb-3">📊 Qualidade dos Dados por Ativo</h4>
          <div className="space-y-3">
            {validation.assetsAvailability.map((asset) => (
              <div key={asset.ticker} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "p-2 rounded-lg",
                    getQualityColor(asset.dataQuality)
                  )}>
                    {getQualityIcon(asset.dataQuality)}
                  </div>
                  <div>
                    <p className="font-medium">{asset.ticker}</p>
                    <p className="text-sm text-muted-foreground">
                      {asset.totalMonths} meses disponíveis
                      {asset.missingMonths > 0 && (
                        <span className="text-orange-600">
                          {" "}({asset.missingMonths} faltantes)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <Badge className={getQualityColor(asset.dataQuality)}>
                  {asset.dataQuality === 'excellent' && 'Excelente'}
                  {asset.dataQuality === 'good' && 'Boa'}
                  {asset.dataQuality === 'fair' && 'Regular'}
                  {asset.dataQuality === 'poor' && 'Ruim'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
        
        {/* Botões de Ação */}
        <div className="flex gap-3 pt-4 border-t">
          <Button onClick={onAccept} className="flex-1">
            <CheckCircle className="w-4 h-4 mr-2" />
            Continuar com Ajustes
          </Button>
          <Button variant="outline" onClick={onCancel}>
            <XCircle className="w-4 h-4 mr-2" />
            Cancelar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

---

## 🔌 ENDPOINTS DA API

### 1. Configurações de Backtest

```typescript
// GET /api/backtest/configs - Listar configurações do usuário
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const configs = await prisma.backtestConfig.findMany({
    where: { userId: user.id },
    include: { assets: true, results: true },
    orderBy: { createdAt: 'desc' }
  });
  
  return NextResponse.json({ configs });
}

// POST /api/backtest/configs - Criar nova configuração
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const body = await request.json();
  
  const config = await prisma.backtestConfig.create({
    data: {
      userId: user.id,
      name: body.name,
      description: body.description,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      monthlyContribution: body.monthlyContribution,
      rebalanceFrequency: body.rebalanceFrequency,
      assets: {
        create: body.assets.map((asset: any) => ({
          ticker: asset.ticker,
          targetAllocation: asset.allocation
        }))
      }
    },
    include: { assets: true }
  });
  
  return NextResponse.json({ config });
}

// PUT /api/backtest/configs/[id] - Atualizar configuração
// DELETE /api/backtest/configs/[id] - Deletar configuração
```

### 2. Execução de Backtest

```typescript
// POST /api/backtest/run - Executar simulação
interface RunBacktestRequest {
  configId?: string; // Opcional: usar config salva
  params?: BacktestParams; // Ou parâmetros diretos
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  // Verificar se é usuário Premium para backtests avançados
  if (!user.isPremium) {
    return NextResponse.json({ 
      error: 'Backtesting avançado exclusivo para usuários Premium' 
    }, { status: 403 });
  }
  
  const body: RunBacktestRequest = await request.json();
  
  let params: BacktestParams;
  
  if (body.configId) {
    // Usar configuração salva
    const config = await prisma.backtestConfig.findFirst({
      where: { id: body.configId, userId: user.id },
      include: { assets: true }
    });
    
    if (!config) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 });
    }
    
    params = {
      assets: config.assets.map(a => ({
        ticker: a.ticker,
        allocation: Number(a.targetAllocation)
      })),
      startDate: config.startDate,
      endDate: config.endDate,
      monthlyContribution: Number(config.monthlyContribution),
      rebalanceFrequency: config.rebalanceFrequency as any
    };
  } else if (body.params) {
    // Usar parâmetros diretos
    params = body.params;
  } else {
    return NextResponse.json({ error: 'Missing params or configId' }, { status: 400 });
  }
  
  // Executar backtesting
  const backtestService = new AdaptiveBacktestService();
  const result = await backtestService.runAdaptiveBacktest(params);
  
  // Salvar resultado se for de uma config salva
  if (body.configId) {
    await prisma.backtestResult.upsert({
      where: { backtestId: body.configId },
      update: {
        totalReturn: result.totalReturn,
        annualizedReturn: result.annualizedReturn,
        volatility: result.volatility,
        sharpeRatio: result.sharpeRatio,
        maxDrawdown: result.maxDrawdown,
        positiveMonths: result.positiveMonths,
        negativeMonths: result.negativeMonths,
        totalInvested: result.totalInvested,
        finalValue: result.finalValue,
        monthlyReturns: result.monthlyReturns as any,
        assetPerformance: result.assetPerformance as any,
        portfolioEvolution: result.portfolioEvolution as any
      },
      create: {
        backtestId: body.configId,
        totalReturn: result.totalReturn,
        annualizedReturn: result.annualizedReturn,
        volatility: result.volatility,
        sharpeRatio: result.sharpeRatio,
        maxDrawdown: result.maxDrawdown,
        positiveMonths: result.positiveMonths,
        negativeMonths: result.negativeMonths,
        totalInvested: result.totalInvested,
        finalValue: result.finalValue,
        monthlyReturns: result.monthlyReturns as any,
        assetPerformance: result.assetPerformance as any,
        portfolioEvolution: result.portfolioEvolution as any
      }
    });
  }
  
  return NextResponse.json({ result });
}

// GET /api/backtest/results/[id] - Obter resultados salvos
```

### 3. Dados Históricos

```typescript
// GET /api/backtest/historical-data - Obter dados para período específico
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tickers = searchParams.get('tickers')?.split(',') || [];
  const startDate = new Date(searchParams.get('startDate') || '');
  const endDate = new Date(searchParams.get('endDate') || '');
  
  // Reutilizar infraestrutura existente de HistoricalPrice
  const historicalData = await prisma.historicalPrice.findMany({
    where: {
      company: { ticker: { in: tickers } },
      interval: '1mo',
      date: { gte: startDate, lte: endDate }
    },
    include: { company: { select: { ticker: true } } },
    orderBy: [{ company: { ticker: 'asc' } }, { date: 'asc' }]
  });
  
  // Agrupar por ticker
  const groupedData = tickers.reduce((acc, ticker) => {
    acc[ticker] = historicalData
      .filter(d => d.company.ticker === ticker)
      .map(d => ({
        date: d.date,
        open: Number(d.open),
        high: Number(d.high),
        low: Number(d.low),
        close: Number(d.close),
        adjustedClose: Number(d.adjustedClose),
        volume: Number(d.volume)
      }));
    return acc;
  }, {} as Record<string, any[]>);
  
  return NextResponse.json({ data: groupedData });
}
```

---

## 🔒 CONTROLE DE ACESSO E PREMIUM

### 1. Funcionalidade Premium

#### Limitações por Tier:

**Usuários Free:**
- ❌ Sem acesso ao backtesting
- 🔗 Podem adicionar ativos ao backtest (redirecionamento para upgrade)

**Usuários Premium:**
- ✅ Backtesting completo sem limitações
- ✅ Múltiplas configurações salvas
- ✅ Métricas avançadas (Sharpe Ratio, drawdown, etc.)
- ✅ Comparação de estratégias
- ✅ Exportação de relatórios

### 2. Verificações de Segurança

```typescript
// Middleware de verificação Premium
export async function requirePremiumForBacktest(request: NextRequest) {
  const user = await getCurrentUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Login necessário' }, { status: 401 });
  }
  
  if (!user.isPremium) {
    return NextResponse.json({ 
      error: 'Backtesting exclusivo para usuários Premium',
      upgradeUrl: '/dashboard'
    }, { status: 403 });
  }
  
  return null; // Continuar
}

// Validações de entrada
export function validateBacktestParams(params: BacktestParams) {
  const errors: string[] = [];
  
  if (!params.assets || params.assets.length === 0) {
    errors.push('Pelo menos um ativo é obrigatório');
  }
  
  if (params.assets.length > 20) {
    errors.push('Máximo 20 ativos por carteira');
  }
  
  const totalAllocation = params.assets.reduce((sum, a) => sum + a.allocation, 0);
  if (Math.abs(totalAllocation - 1) > 0.01) {
    errors.push('Alocações devem somar 100%');
  }
  
  if (params.monthlyContribution <= 0) {
    errors.push('Aporte mensal deve ser positivo');
  }
  
  if (params.startDate >= params.endDate) {
    errors.push('Data de início deve ser anterior à data de fim');
  }
  
  const monthsDiff = (params.endDate.getTime() - params.startDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
  if (monthsDiff < 12) {
    errors.push('Período mínimo de 12 meses');
  }
  
  return errors;
}
```

---

## 📊 INTEGRAÇÃO COM DADOS EXISTENTES

### 1. Aproveitamento da Infraestrutura

#### Dados Utilizados:
- **HistoricalPrice**: Preços mensais para cálculos de retorno
- **Company**: Validação de tickers e informações básicas
- **User/Premium**: Sistema de autenticação e verificação de assinatura

#### Otimizações:
- **Cache**: Dados históricos frequentemente acessados
- **Índices**: Otimizados para consultas por ticker e período
- **Processamento Assíncrono**: Para simulações longas

### 2. Queries Otimizadas

```sql
-- Índices recomendados para performance
CREATE INDEX IF NOT EXISTS "historical_prices_backtest_idx" 
ON "historical_prices"("company_id", "interval", "date") 
WHERE "interval" = '1mo';

-- Query otimizada para buscar dados de múltiplos ativos
SELECT hp.*, c.ticker 
FROM historical_prices hp
JOIN companies c ON hp.company_id = c.id
WHERE c.ticker = ANY($1) 
  AND hp.interval = '1mo'
  AND hp.date BETWEEN $2 AND $3
ORDER BY c.ticker, hp.date;
```

---

## 🚀 CRONOGRAMA DE IMPLEMENTAÇÃO

### **Fase 1: Backend Core (2-3 semanas)**

#### Semana 1:
- ✅ Criar modelos Prisma e migração
- ✅ Implementar `BacktestService` básico
- ✅ Criar endpoints principais da API
- ✅ Testes unitários do algoritmo de simulação

#### Semana 2:
- ✅ Implementar `BacktestDataValidator`
- ✅ Criar `AdaptiveBacktestService`
- ✅ Adicionar tratamento de dados faltantes
- ✅ Implementar cálculo de métricas avançadas

#### Semana 3:
- ✅ Integrar com sistema de autenticação Premium
- ✅ Otimizar queries e performance
- ✅ Testes de integração
- ✅ Documentação da API

### **Fase 2: Frontend Core (2-3 semanas)**

#### Semana 4:
- ✅ Criar página principal `/backtest`
- ✅ Implementar `BacktestConfigForm`
- ✅ Criar componentes de seleção de ativos
- ✅ Implementar sliders de alocação

#### Semana 5:
- ✅ Criar `BacktestResults` com gráficos
- ✅ Implementar visualizações (evolução, heatmap)
- ✅ Criar tabelas de performance por ativo
- ✅ Adicionar métricas de risco

#### Semana 6:
- ✅ Implementar `BacktestDataQualityPanel`
- ✅ Criar sistema de histórico de backtests
- ✅ Adicionar funcionalidade de comparação
- ✅ Testes de usabilidade

### **Fase 3: Integração e Refinamentos (1-2 semanas)**

#### Semana 7:
- ✅ Criar `AddToBacktestButton`
- ✅ Integrar com página do ativo
- ✅ Integrar com Quick Ranker
- ✅ Integrar com tabela de comparação

#### Semana 8:
- ✅ Otimizações de performance
- ✅ Validações e tratamento de erros
- ✅ Testes end-to-end
- ✅ Documentação final

---

## 🎯 FUNCIONALIDADES AVANÇADAS (Roadmap Futuro)

### **V2.0 - Análises Avançadas**
- 📊 **Benchmark Comparison**: Comparar com índices (IBOV, CDI, SELIC)
- 📈 **Risk Metrics**: VaR, CVaR, Beta, Correlação
- 🎲 **Monte Carlo Simulation**: Simulações probabilísticas
- 📋 **Strategy Backtesting**: Testar estratégias de investimento existentes

### **V2.1 - Integração e Automação**
- 💾 **Export/Import**: Salvar/carregar configurações em CSV/JSON
- 🔗 **API Integration**: Conectar com outras plataformas (XP, Rico, etc.)
- 📧 **Relatórios Automáticos**: Envio periódico de performance
- 📱 **Mobile App**: Versão mobile nativa

### **V2.2 - Inteligência Artificial**
- 🤖 **Portfolio Optimization**: IA para otimizar alocações
- 📊 **Predictive Analytics**: Previsões baseadas em ML
- 🎯 **Smart Rebalancing**: Rebalanceamento inteligente
- 💡 **Investment Suggestions**: Sugestões personalizadas

---

## 💡 CONSIDERAÇÕES TÉCNICAS

### 1. Tratamento de Dados Faltantes

#### Estratégias Implementadas:
- **Interpolação Linear**: Para gaps pequenos (1-2 meses)
- **Forward Fill**: Usar último preço disponível
- **Exclusão Temporal**: Pular períodos sem dados suficientes
- **Alocação Proporcional**: Redistribuir entre ativos disponíveis

#### Exemplo de Implementação:
```typescript
private fillMissingPrices(prices: PricePoint[], method: 'linear' | 'forward' | 'skip'): PricePoint[] {
  switch (method) {
    case 'linear':
      return this.linearInterpolation(prices);
    case 'forward':
      return this.forwardFill(prices);
    case 'skip':
      return prices.filter(p => p.price > 0);
  }
}
```

### 2. Cálculos Financeiros Precisos

#### Bibliotecas Utilizadas:
- **decimal.js**: Aritmética de precisão para valores monetários
- **date-fns**: Manipulação robusta de datas
- **mathjs**: Cálculos estatísticos avançados

#### Exemplo de Cálculo de Sharpe Ratio:
```typescript
private calculateSharpeRatio(returns: number[], riskFreeRate: number = 0.1): number {
  const excessReturns = returns.map(r => r - riskFreeRate / 12);
  const avgExcessReturn = excessReturns.reduce((a, b) => a + b, 0) / excessReturns.length;
  const stdDev = Math.sqrt(
    excessReturns.reduce((sum, r) => sum + Math.pow(r - avgExcessReturn, 2), 0) / excessReturns.length
  );
  
  return avgExcessReturn / stdDev * Math.sqrt(12); // Anualizado
}
```

### 3. Escalabilidade e Performance

#### Otimizações Implementadas:
- **Processamento em Background**: Jobs assíncronos para simulações longas
- **Cache Inteligente**: Redis para dados históricos frequentes
- **Índices Otimizados**: Queries rápidas no PostgreSQL
- **Paginação**: Resultados grandes divididos em páginas

#### Monitoramento:
- **Métricas de Performance**: Tempo de execução por simulação
- **Usage Analytics**: Padrões de uso para otimizações
- **Error Tracking**: Sentry para monitoramento de erros
- **Resource Monitoring**: CPU/Memory usage durante simulações

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### **Database & Backend**
- [ ] Criar modelos Prisma (BacktestConfig, BacktestAsset, BacktestResult)
- [ ] Executar migração do banco de dados
- [ ] Implementar BacktestService com algoritmo de simulação
- [ ] Criar BacktestDataValidator para validação de dados
- [ ] Implementar AdaptiveBacktestService para dados inconsistentes
- [ ] Criar endpoints da API (/api/backtest/*)
- [ ] Adicionar verificações de Premium
- [ ] Implementar testes unitários e de integração

### **Frontend Core**
- [ ] Criar página principal /backtest
- [ ] Implementar BacktestConfigForm
- [ ] Criar componentes de seleção e alocação de ativos
- [ ] Implementar BacktestResults com visualizações
- [ ] Criar gráficos (evolução, heatmap, performance)
- [ ] Implementar BacktestDataQualityPanel
- [ ] Adicionar sistema de histórico de backtests
- [ ] Criar funcionalidade de comparação

### **Integração com Páginas Existentes**
- [ ] Criar AddToBacktestButton component
- [ ] Integrar na página do ativo (/acao/[ticker])
- [ ] Integrar no Quick Ranker
- [ ] Integrar na tabela de comparação
- [ ] Implementar localStorage para ativos pré-configurados
- [ ] Adicionar feedback visual (toasts, badges)

### **Tratamento de Dados**
- [ ] Implementar validação de disponibilidade de dados
- [ ] Criar algoritmo de ajuste de período
- [ ] Implementar tratamento de dados faltantes
- [ ] Adicionar cálculo de métricas de qualidade
- [ ] Criar interface de avisos e recomendações

### **Testes e Qualidade**
- [ ] Testes unitários para algoritmos de backtesting
- [ ] Testes de integração para APIs
- [ ] Testes end-to-end para fluxos completos
- [ ] Validação de performance com datasets grandes
- [ ] Testes de usabilidade com usuários

### **Documentação e Deploy**
- [ ] Documentação da API
- [ ] Guia do usuário
- [ ] Documentação técnica para desenvolvedores
- [ ] Scripts de migração e deploy
- [ ] Monitoramento e alertas

---

## 🎉 CONCLUSÃO

A funcionalidade de **Backtesting de Carteira de Investimentos** representa uma evolução significativa da plataforma, oferecendo aos usuários uma ferramenta poderosa para validar estratégias de investimento com dados históricos reais.

### **Principais Benefícios:**

1. **📊 Decisões Baseadas em Dados**: Usuários podem testar estratégias antes de investir
2. **🔗 Integração Fluida**: Adicionar ativos diretamente das análises existentes
3. **⚠️ Transparência**: Avisos claros sobre limitações dos dados
4. **📈 Métricas Profissionais**: Sharpe Ratio, drawdown, volatilidade
5. **🎯 Experiência Premium**: Funcionalidade exclusiva que agrega valor

### **Impacto Esperado:**

- **Retenção**: Usuários passam mais tempo na plataforma
- **Conversão**: Funcionalidade Premium aumenta upgrades
- **Engajamento**: Integração com páginas existentes aumenta uso
- **Diferenciação**: Ferramenta única no mercado brasileiro

A implementação seguirá as melhores práticas de desenvolvimento, aproveitando a infraestrutura existente e mantendo a consistência com o design system da plataforma.


----

🎯 PRÓXIMOS PASSOS OPCIONAIS
A feature está 100% funcional, mas podem ser adicionados:
📊 Gráficos Interativos (Recharts/Chart.js)
📤 Exportação de Relatórios (PDF/Excel)
🔄 Comparação de Estratégias
📱 Otimizações Mobile adicionais
🤖 Sugestões de IA para carteiras
