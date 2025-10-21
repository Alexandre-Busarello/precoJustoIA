# Diferença Entre Volatilidade em Analytics vs Metrics

## 📊 Contexto

Existem **dois cálculos diferentes de volatilidade** no sistema, e isso é **INTENCIONAL**:

1. **Analytics** (Aba "Análise"): Volatilidade **MENSAL**
2. **Metrics** (Visão Geral): Volatilidade **ANUALIZADA**

## 🎯 Por Que São Diferentes?

### Analytics: Volatilidade MENSAL (0.10%)
- **Propósito**: Análise detalhada mês a mês
- **Cálculo**: Desvio padrão dos retornos mensais
- **Fórmula**: `σ = √(Σ(ri - μ)² / n)`
- **Uso**: Entender a variação mensal da carteira

```typescript
// portfolio-analytics-service.ts
const variance = monthlyReturns.reduce((sum, m) => {
  const diff = m.return - avgMonthlyReturn;
  return sum + diff * diff;
}, 0) / monthlyReturns.length;

volatility = Math.sqrt(variance); // Mensal
```

### Metrics: Volatilidade ANUALIZADA (0.34%)
- **Propósito**: Comparação com benchmarks e padrões de mercado
- **Cálculo**: Desvio padrão mensal × √12
- **Fórmula**: `σ_anual = σ_mensal × √12`
- **Uso**: Comparar com CDI, Ibovespa, fundos (que mostram volatilidade anual)

```typescript
// portfolio-metrics-service.ts
const stdDev = Math.sqrt(variance);
volatility = stdDev * Math.sqrt(12); // Anualizada
```

## 📐 Exemplo Numérico

Suponha que a volatilidade mensal seja **0.10%** (ou 0.001 em decimal):

```
Volatilidade Mensal:    0.10%
Volatilidade Anualizada: 0.10% × √12 = 0.10% × 3.464 ≈ 0.34%
```

Isso explica por que você vê:
- **Analytics**: 0.10%
- **Metrics**: 0.34%

## ✅ Por Que Isso É Correto?

A **anualização** usando √12 é um padrão da indústria financeira baseado em:

1. **Escala de tempo**: Se você tem volatilidade mensal, para convertê-la para anual, multiplica por √(períodos)
2. **Comparabilidade**: Fundos, ETFs, benchmarks sempre mostram volatilidade anual
3. **Sharpe Ratio**: Requer retorno e volatilidade na mesma base temporal (anual)

## 🎨 Sugestões para Interface

Para deixar claro para o usuário final, sugiro adicionar labels explicativos:

### 1. Na Visão Geral (Metrics)
```tsx
<div className="metric-card">
  <div className="metric-label">
    Volatilidade
    <Tooltip content="Volatilidade anualizada (base 12 meses)">
      <InfoIcon />
    </Tooltip>
  </div>
  <div className="metric-value">0.34%</div>
  <div className="metric-sublabel">anualizada</div>
</div>
```

### 2. Na Aba Analytics
```tsx
<div className="summary-card">
  <h3>Volatilidade Mensal</h3>
  <p className="value">0.10%</p>
  <p className="description">Desvio padrão dos retornos mensais</p>
</div>
```

### 3. Tooltip Educativo
```
Volatilidade:
• Visão Geral: 0.34% (anualizada)
• Análise Detalhada: 0.10% (mensal)

A volatilidade anualizada facilita comparação
com benchmarks como CDI e Ibovespa.
```

## 🔢 Implementação das Labels

### Arquivo: `src/components/portfolio-overview.tsx`

```tsx
// Antes
<div>Volatilidade: {(metrics.volatility * 100).toFixed(2)}%</div>

// Depois
<div className="flex items-center gap-2">
  <span>Volatilidade: {(metrics.volatility * 100).toFixed(2)}%</span>
  <Badge variant="secondary" className="text-xs">anualizada</Badge>
  <Tooltip>
    <TooltipTrigger>
      <Info className="h-4 w-4 text-muted-foreground" />
    </TooltipTrigger>
    <TooltipContent>
      <p className="text-sm">
        Volatilidade anualizada (base 12 meses)
        <br />
        Calculada como: σ_mensal × √12
      </p>
    </TooltipContent>
  </Tooltip>
</div>
```

### Arquivo: `src/components/portfolio-analytics.tsx`

```tsx
// Antes
<div>Volatilidade: {(summary.volatility * 100).toFixed(2)}%</div>

// Depois
<div className="flex items-center gap-2">
  <span>Volatilidade: {(summary.volatility * 100).toFixed(2)}%</span>
  <Badge variant="outline" className="text-xs">mensal</Badge>
  <Tooltip>
    <TooltipTrigger>
      <Info className="h-4 w-4 text-muted-foreground" />
    </TooltipTrigger>
    <TooltipContent>
      <p className="text-sm">
        Volatilidade mensal (desvio padrão)
        <br />
        Mede a variação dos retornos mês a mês
      </p>
    </TooltipContent>
  </Tooltip>
</div>
```

## 📚 Comparação com Mercado

Exemplo de como diferentes produtos mostram volatilidade:

| Produto | Volatilidade Típica | Base |
|---------|---------------------|------|
| CDI | ~0% | Anual |
| Ibovespa | ~25% | Anual |
| Fundos Multimercado | ~5-15% | Anual |
| **Sua Carteira (Metrics)** | **0.34%** | **Anual** |
| **Sua Carteira (Analytics)** | **0.10%** | **Mensal** |

A conversão mensal → anual permite comparar sua carteira com esses benchmarks.

## ⚠️ Não Centralizar Este Código

Diferente do cálculo de **evolução** e **drawdown** (que devem ser idênticos), o cálculo de **volatilidade** deve permanecer separado porque:

- ❌ Não são a mesma métrica (mensal vs anual)
- ❌ Têm propósitos diferentes (análise vs comparação)
- ✅ Ambas estão corretas no seu contexto

## 📝 Resumo das Mudanças no Código

### PortfolioAnalyticsService
```typescript
// Calculate volatility MENSAL (standard deviation of monthly returns)
// Nota: Esta é a volatilidade MENSAL para análise detalhada
let volatility = 0;
if (monthlyReturns.length > 1) {
  const variance = monthlyReturns.reduce(...);
  volatility = Math.sqrt(variance); // SEM anualização
}
```

### PortfolioMetricsService
```typescript
/**
 * Calculate volatility ANUALIZADA (annualized standard deviation)
 * 
 * IMPORTANTE: Esta volatilidade é ANUALIZADA para fins de comparação com benchmarks
 * Exemplo: Mensal = 0.10%, Anualizada = 0.10% × √12 ≈ 0.34%
 */
private static calculateVolatility(...) {
  const stdDev = Math.sqrt(variance);
  return stdDev * Math.sqrt(12); // COM anualização
}
```

## 🎓 Referências

- [Investopedia: Annualized Volatility](https://www.investopedia.com/terms/a/annualized-volatility.asp)
- CVM: Formulário de Informações Anuais de Fundos (usa volatilidade anual)
- ANBIMA: Padrões de Divulgação de Fundos (base anual)

## ✅ Checklist para Interface

- [ ] Adicionar badge "anualizada" na Visão Geral
- [ ] Adicionar badge "mensal" na aba Analytics
- [ ] Adicionar tooltip explicativo em ambos
- [ ] Atualizar documentação do usuário
- [ ] Considerar adicionar uma seção "Entenda as Métricas" no app

