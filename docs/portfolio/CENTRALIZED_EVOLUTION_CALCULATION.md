# Refatoração: Cálculo Centralizado de Evolução e Drawdown

## 🎯 Problema Original

Haviam **duas implementações separadas** para calcular a evolução da carteira e o drawdown:

1. **PortfolioAnalyticsService**: Implementação para o endpoint `/analytics`
2. **PortfolioMetricsService**: Implementação **duplicada** para o endpoint `/metrics`

Isso causava **inconsistências**:
- Valores diferentes de evolução
- Drawdowns diferentes (6.26% vs 0%)
- Datas de cálculo diferentes
- Lógica duplicada e difícil de manter

## ❌ Anti-Pattern: Duplicação de Código

```typescript
// ❌ ANTES: Duas implementações diferentes

// Em PortfolioAnalyticsService
private static async calculateEvolution(...) {
  // Lógica complexa de evolução
}

private static calculateDrawdown(...) {
  // Lógica complexa de drawdown
}

// Em PortfolioMetricsService (DUPLICADO!)
private static async calculateEvolutionData(...) {
  // Tentativa de replicar a mesma lógica
  // Mas com diferenças sutis que causam bugs
}

private static calculateMaxDrawdown(...) {
  // Tentativa de replicar a mesma lógica
  // Mas com ajustes que não funcionam
}
```

## ✅ Solução: Single Source of Truth

```typescript
// ✅ DEPOIS: Uma única implementação compartilhada

// Em PortfolioAnalyticsService
public static async calculateEvolution(...) {
  // Lógica única e testada
}

public static calculateDrawdown(...) {
  // Lógica única e testada
}

// Em PortfolioMetricsService
static async calculatePortfolioMetrics(...) {
  // Reutiliza o método do Analytics
  const evolutionPoints = await PortfolioAnalyticsService.calculateEvolution(
    portfolioId,
    transactions,
    portfolio.assets
  );
  
  // Converte para o formato esperado
  const evolutionData = evolutionPoints.map(point => ({
    date: point.date.substring(0, 7),
    value: point.value,
    cashBalance: point.cashBalance,
    invested: point.invested
  }));
  
  // Reutiliza o método do Analytics para drawdown
  const { drawdownHistory } = PortfolioAnalyticsService.calculateDrawdown(evolutionPoints);
  const maxDrawdown = drawdownHistory.length > 0 
    ? Math.abs(Math.min(...drawdownHistory.map(d => d.drawdown)) / 100)
    : null;
}
```

## 🔄 Mudanças Implementadas

### 1. PortfolioAnalyticsService

- ✅ `calculateEvolution`: Mudou de `private` para `public`
- ✅ `calculateDrawdown`: Mudou de `private` para `public`
- ✅ Adicionados comentários indicando reutilização

### 2. PortfolioMetricsService

- ✅ **Removido** `calculateEvolutionData` (duplicado)
- ✅ **Removido** `getPricesAsOf` (duplicado)
- ✅ **Removido** `calculateMaxDrawdown` (duplicado)
- ✅ Adicionado import de `PortfolioAnalyticsService`
- ✅ Modificado `calculatePortfolioMetrics` para:
  - Buscar `portfolio.assets` do banco
  - Chamar `PortfolioAnalyticsService.calculateEvolution()`
  - Converter resultado para formato do Metrics
  - Chamar `PortfolioAnalyticsService.calculateDrawdown()`
  - Extrair `maxDrawdown` do `drawdownHistory`

## 📊 Resultado

Agora **ambos os endpoints** usam:
- ✅ **Mesmos preços** (1º dia do mês + real-time para hoje)
- ✅ **Mesmas datas** (períodos idênticos)
- ✅ **Mesmo cálculo de evolução**
- ✅ **Mesmo cálculo de drawdown**

```json
// Exemplo: Carteira ETF/BDR
{
  "metrics": {
    "maxDrawdown": 0.0  // ✅ Correto
  },
  "analytics": {
    "drawdownHistory": [
      { "drawdown": 0, ... }  // ✅ Correto
    ]
  }
}
```

## 🎯 Benefícios

### 1. Consistência Garantida
- Impossível ter valores diferentes entre endpoints
- Um único ponto de verdade para a lógica

### 2. Manutenibilidade
- Mudanças feitas uma vez, refletidas em todos os lugares
- Código mais DRY (Don't Repeat Yourself)

### 3. Testabilidade
- Testes feitos uma vez no método compartilhado
- Menor superfície de bugs

### 4. Performance
- Reutilização de código otimizado
- Mesmos caches e otimizações aplicadas

## 🚀 Próximos Passos

Considerar extrair outros métodos duplicados:
- `calculateMonthlyReturns` (ambos os serviços têm)
- `calculateVolatility` (lógica similar)
- `getCurrentHoldings` (pode ser centralizado)

## ⚠️ Importante

**Sempre que modificar** a lógica de evolução ou drawdown:
- ✅ Fazer a mudança em `PortfolioAnalyticsService`
- ✅ A mudança será automaticamente refletida em `PortfolioMetricsService`
- ❌ **NUNCA** duplicar código novamente

## 📝 Arquivos Modificados

- `src/lib/portfolio-analytics-service.ts`
  - `calculateEvolution()`: `private` → `public`
  - `calculateDrawdown()`: `private` → `public`
  
- `src/lib/portfolio-metrics-service.ts`
  - Removido: `calculateEvolutionData()`, `getPricesAsOf()`, `calculateMaxDrawdown()`
  - Adicionado: Chamadas para `PortfolioAnalyticsService`
  - Modificado: `calculatePortfolioMetrics()` para buscar `portfolio.assets`

## 🎓 Lição Aprendida

**"Don't try to maintain two implementations of the same logic."**

Quando há necessidade de compartilhar lógica entre serviços:
1. Identificar a implementação correta/testada
2. Torná-la pública e bem documentada
3. Remover implementações duplicadas
4. Adaptar o formato de saída se necessário
5. Nunca duplicar novamente

