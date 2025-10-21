# Portfolio Drawdown & Cache - Implementação Completa

## 🎯 Melhorias Implementadas

### 1. ✅ Gráfico de Drawdown Histórico
### 2. ✅ Tabela de Retornos Mensais Detalhada
### 3. ✅ Cache de 1 Hora no Frontend
### 4. ✅ Invalidação Automática de Cache

---

## 📉 1. Gráfico de Drawdown

### O Que É Drawdown?

Drawdown mede quanto a carteira caiu desde seu pico anterior. É uma métrica crucial para entender:
- **Períodos de queda**: Quando a carteira está abaixo do pico
- **Profundidade**: Quanto caiu (em %)
- **Recuperação**: Quanto tempo leva para voltar ao pico

### Como Funciona

```
Exemplo:
- Setembro: R$ 12.663 (pico)
- Outubro: R$ 12.398 (queda de 2.10%)

Drawdown = -2.10% (em drawdown)

Quando voltar a R$ 12.663 ou mais: Drawdown = 0% (recuperado)
```

### Backend (`portfolio-analytics-service.ts`)

#### Interfaces Adicionadas

```typescript
export interface DrawdownPoint {
  date: string;
  drawdown: number; // Drawdown atual (%) - negativo no gráfico
  isInDrawdown: boolean;
  peak: number; // Pico da carteira até esta data
  value: number; // Valor atual
}

export interface DrawdownPeriod {
  startDate: string;
  endDate: string | null; // null se ainda em drawdown
  duration: number; // Duração em meses
  depth: number; // Profundidade máxima (%)
  recovered: boolean; // Se já recuperou
}
```

#### Cálculo de Drawdown

```typescript
private static calculateDrawdown(evolution: EvolutionPoint[]) {
  let peak = evolution[0].value;
  
  for (const point of evolution) {
    // Novo pico = recuperação
    if (point.value > peak) {
      peak = point.value;
      // Marca fim do drawdown anterior
    }
    
    // Calcula drawdown atual
    const drawdown = peak > 0 ? ((peak - point.value) / peak) * 100 : 0;
    
    // Identifica períodos de drawdown
    if (drawdown > 0.01) {
      // Registra início/continuação do drawdown
    }
  }
}
```

#### Métricas Calculadas

```typescript
summary: {
  // ... outras métricas
  currentDrawdown: number;        // Drawdown atual (%)
  maxDrawdownDepth: number;       // Maior drawdown histórico (%)
  averageRecoveryTime: number;    // Tempo médio de recuperação (meses)
  drawdownCount: number;          // Número de períodos de drawdown
}
```

### Frontend (`portfolio-analytics.tsx`)

#### Nova Aba "Drawdown"

```typescript
<TabsTrigger value="drawdown">Drawdown</TabsTrigger>
```

#### Gráfico de Área (AreaChart)

- **Cor**: Vermelho (#ef4444) para indicar perda
- **Valores**: Negativos (parte de 0 e vai para baixo)
- **Eixo Y**: Mostra % negativos
- **Tooltip**: Mostra drawdown em % e data

#### 3 Cards de Estatísticas

1. **Drawdown Atual**
   - Mostra se está em drawdown agora
   - Valor em % negativo

2. **Maior Drawdown**
   - Profundidade máxima histórica
   - "Pior caso" que já aconteceu

3. **Tempo de Recuperação**
   - Média de meses para recuperar
   - Baseado em períodos recuperados

#### Tabela de Períodos de Drawdown

| Início | Fim | Profundidade | Duração | Status |
|--------|-----|--------------|---------|---------|
| Set 2025 | Out 2025 | -2.10% | 1 mês | Recuperado |
| Nov 2025 | - | -5.50% | 2 meses | Em curso |

- **Status**: Badge verde (Recuperado) ou vermelho (Em curso)
- **Fim**: "-" se ainda em drawdown

---

## 📊 2. Tabela de Retornos Mensais

### O Que Foi Adicionado

Tabela detalhada abaixo do gráfico de barras mostrando:
- **Mês**: Nome completo (Janeiro 2025, Fevereiro 2025, etc.)
- **Retorno**: Valor em % com cor (verde +, vermelho -)
- **Classificação**: Ícone ↑ (positivo) ou ↓ (negativo)

### Implementação

```typescript
<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Mês</TableHead>
      <TableHead className="text-right">Retorno</TableHead>
      <TableHead className="text-center">Classificação</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    {analytics.monthlyReturns.map((item, index) => (
      <TableRow key={index}>
        <TableCell>{formatMonthYearLong(item.date)}</TableCell>
        <TableCell className={item.return >= 0 ? 'text-green-600' : 'text-red-600'}>
          {item.return >= 0 ? '+' : ''}{item.return.toFixed(2)}%
        </TableCell>
        <TableCell>
          {item.return >= 0 ? <TrendingUp /> : <TrendingDown />}
        </TableCell>
      </TableRow>
    ))}
  </TableBody>
</Table>
```

### Resultado Visual

| Mês | Retorno | Classificação |
|-----|---------|---------------|
| Setembro 2025 | +5.18% | ↑ |
| Outubro 2025 | -2.10% | ↓ |

---

## 💾 3. Cache de 1 Hora

### Por Que Cache?

O cálculo de analytics é **pesado**:
- Busca dados históricos
- Calcula evolução mensal
- Calcula drawdown
- Pode demorar 30-90 segundos

Com cache:
- ✅ Carregamento instantâneo (< 1s)
- ✅ Menos carga no servidor
- ✅ Melhor experiência do usuário

### Implementação

#### Funções de Cache

```typescript
const CACHE_KEY = `analytics_${portfolioId}`;
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

const getCachedAnalytics = (): AnalyticsData | null => {
  const cached = localStorage.getItem(CACHE_KEY);
  if (!cached) return null;

  const { data, timestamp } = JSON.parse(cached);
  const age = Date.now() - timestamp;
  
  if (age < CACHE_DURATION) {
    return data; // Cache válido
  }
  
  localStorage.removeItem(CACHE_KEY); // Cache expirado
  return null;
};

const setCachedAnalytics = (data: AnalyticsData) => {
  const cacheData = {
    data,
    timestamp: Date.now()
  };
  localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
};
```

#### Fetch com Cache

```typescript
const fetchAnalytics = async (forceRefresh = false) => {
  // 1. Tentar cache primeiro (se não for refresh forçado)
  if (!forceRefresh) {
    const cached = getCachedAnalytics();
    if (cached) {
      setAnalytics(cached);
      return; // ✅ Carregamento instantâneo
    }
  }
  
  // 2. Buscar da API
  const data = await fetch(`/api/portfolio/${portfolioId}/analytics`);
  
  // 3. Salvar no cache
  setCachedAnalytics(data);
  setAnalytics(data);
};
```

### Logs de Debug

```
📦 [CACHE] Analytics carregado do cache (5 min atrás)
// ou
🌐 [API] Buscando analytics do servidor...
💾 [CACHE] Analytics salvo no cache
```

---

## 🗑️ 4. Invalidação de Cache

### Quando Invalidar?

O cache deve ser invalidado quando **transações são modificadas**:
- ✅ Transação criada
- ✅ Transação editada
- ✅ Transação deletada

### Função Exportada

```typescript
export function invalidatePortfolioAnalyticsCache(portfolioId: string) {
  const cacheKey = `analytics_${portfolioId}`;
  localStorage.removeItem(cacheKey);
  console.log(`🗑️ [CACHE] Cache invalidado para portfolio ${portfolioId}`);
}
```

### Como Integrar

Você precisa chamar esta função nos lugares onde transações são modificadas. Exemplos:

#### 1. Ao Criar Transação

```typescript
import { invalidatePortfolioAnalyticsCache } from '@/components/portfolio-analytics';

// Depois de criar a transação
await createTransaction(data);
invalidatePortfolioAnalyticsCache(portfolioId);
```

#### 2. Ao Editar Transação

```typescript
await updateTransaction(transactionId, data);
invalidatePortfolioAnalyticsCache(portfolioId);
```

#### 3. Ao Deletar Transação

```typescript
await deleteTransaction(transactionId);
invalidatePortfolioAnalyticsCache(portfolioId);
```

### Onde Chamar?

Procure por estes arquivos (sugestões):
- `src/components/transaction-form.tsx`
- `src/components/transaction-list.tsx`
- `src/app/api/portfolio/[id]/transactions/route.ts`
- Qualquer componente que crie/edite/delete transações

**Exemplo de busca**:
```bash
grep -r "createTransaction\|updateTransaction\|deleteTransaction" src/
```

---

## 📊 Arquivos Modificados

### Backend
1. **`src/lib/portfolio-analytics-service.ts`**:
   - Interfaces: `DrawdownPoint`, `DrawdownPeriod`
   - Método: `calculateDrawdown()`
   - Atualizado: `PortfolioAnalytics` interface
   - Atualizado: `calculateSummary()` com métricas de drawdown

### Frontend
2. **`src/components/portfolio-analytics.tsx`**:
   - Nova aba: "Drawdown"
   - Gráfico de drawdown (AreaChart)
   - 3 cards de estatísticas de drawdown
   - Tabela de períodos de drawdown
   - Tabela de retornos mensais detalhada
   - Sistema de cache (getCached/setCached)
   - Função exportada: `invalidatePortfolioAnalyticsCache()`

---

## 🧪 Como Testar

### 1. Testar Drawdown

1. Acesse uma carteira
2. Vá para aba "Drawdown"
3. Verifique:
   - ✅ Gráfico de área em vermelho
   - ✅ Cards com drawdown atual, máximo e tempo de recuperação
   - ✅ Tabela com períodos (se houver drawdowns)

### 2. Testar Tabela de Retornos

1. Vá para aba "Retornos Mensais"
2. Role para baixo após o gráfico
3. Verifique:
   - ✅ Tabela com todos os meses
   - ✅ Cores corretas (verde +, vermelho -)
   - ✅ Ícones de trending corretos

### 3. Testar Cache

1. **Primeira vez**: Acesse a aba Analytics
   - Deve demorar (30-90s)
   - Log: `🌐 [API] Buscando analytics do servidor...`
   - Log: `💾 [CACHE] Analytics salvo no cache`

2. **Segunda vez**: Recarregue a página
   - Deve ser instantâneo (< 1s)
   - Log: `📦 [CACHE] Analytics carregado do cache (X min atrás)`

3. **Após 1 hora**: Acesse novamente
   - Cache expirou, busca da API novamente

4. **Após modificar transação**: 
   - Cache invalidado
   - Próximo acesso busca da API

### 4. Testar Invalidação

1. Abra o console do navegador (F12)
2. Crie/edite/delete uma transação
3. Deve ver: `🗑️ [CACHE] Cache invalidado para portfolio ${portfolioId}`
4. Recarregue a página de analytics
5. Deve buscar da API novamente

---

## 📝 Exemplo de Integração de Invalidação

### Arquivo Hipotético: `transaction-form.tsx`

```typescript
'use client';

import { invalidatePortfolioAnalyticsCache } from '@/components/portfolio-analytics';

export function TransactionForm({ portfolioId }: { portfolioId: string }) {
  const handleSubmit = async (data: TransactionData) => {
    try {
      // Criar/atualizar transação
      await fetch('/api/transactions', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      
      // ✅ Invalidar cache de analytics
      invalidatePortfolioAnalyticsCache(portfolioId);
      
      toast.success('Transação salva com sucesso!');
    } catch (error) {
      toast.error('Erro ao salvar transação');
    }
  };
  
  return (
    <form onSubmit={handleSubmit}>
      {/* ... form fields */}
    </form>
  );
}
```

---

## 🎯 Resultados Esperados

### Drawdown

- ✅ Gráfico mostra períodos de queda em vermelho
- ✅ Parte de 0 e vai para valores negativos
- ✅ Volta a 0 quando recupera
- ✅ Tabela mostra histórico completo
- ✅ Métricas resumidas nos cards

### Tabela de Retornos

- ✅ Lista todos os meses com dados
- ✅ Cores indicam positivo/negativo
- ✅ Ícones visuais de trending
- ✅ Formatação consistente (Outubro 2025)

### Cache

- ✅ Primeiro acesso: ~30-90s (API)
- ✅ Acessos subsequentes: < 1s (cache)
- ✅ Cache válido por 1 hora
- ✅ Invalidado quando transações mudam
- ✅ Logs claros no console

---

**Data**: 20 de Outubro de 2025  
**Autor**: AI Assistant  
**Status**: ✅ Implementado e Pronto para Teste  
**Próximo Passo**: Integrar `invalidatePortfolioAnalyticsCache()` onde transações são modificadas

