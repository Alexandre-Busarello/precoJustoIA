# Sistema de Cache Frontend para Carteiras - Guia Completo

## 🎯 Objetivo

Implementar cache frontend (localStorage) para TODOS os dados de carteira, invalidando TUDO quando qualquer escrita acontecer.

---

## 📦 Arquitetura

```
┌─────────────────────────────────────┐
│  Componentes de Carteira            │
│  - portfolio-analytics.tsx           │
│  - portfolio-metrics-card.tsx        │
│  - portfolio-holdings-table.tsx      │
│  - portfolio-transaction-list.tsx    │
│  - portfolio-transaction-suggestions.tsx │
└────────────────┬────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────┐
│  src/lib/portfolio-cache.ts          │
│  (Sistema Centralizado)              │
│                                      │
│  - analyticsCache                    │
│  - metricsCache                      │
│  - holdingsCache                     │
│  - transactionsCache                 │
│  - suggestionsCache                  │
│                                      │
│  invalidateAll(portfolioId) <<<      │
└─────────────────────────────────────┘
```

---

## ✅ Status de Implementação

### Concluído
- [x] Criado `src/lib/portfolio-cache.ts` com sistema centralizado
- [x] Migrado `portfolio-analytics.tsx` para novo sistema
- [x] Função `invalidatePortfolioAnalyticsCache()` adaptada para chamar `portfolioCache.invalidateAll()`

### Pendente
- [ ] Adicionar cache em `portfolio-metrics-card.tsx`
- [ ] Adicionar cache em `portfolio-holdings-table.tsx`
- [ ] Adicionar cache em `portfolio-transaction-list.tsx`
- [ ] Adicionar cache em `portfolio-transaction-suggestions.tsx`
- [ ] Adicionar invalidação em **portfolio-transaction-form.tsx** (criar)
- [ ] Adicionar invalidação em **portfolio-transaction-list.tsx** (editar e deletar)
- [ ] Adicionar invalidação em **portfolio-transaction-suggestions.tsx** (aceitar, rejeitar, confirmar todas, recalcular)
- [ ] Adicionar invalidação em **portfolio-negative-cash-alert.tsx** (recalcular)

---

## 📘 Como Usar - Adicionar Cache em Componente

### 1. Import
```typescript
import { portfolioCache } from '@/lib/portfolio-cache';
```

### 2. No useEffect/fetch
```typescript
const fetchData = async (forceRefresh = false) => {
  setLoading(true);
  
  // 1️⃣ Tentar carregar do cache (se não forçar refresh)
  if (!forceRefresh) {
    const cached = portfolioCache.TIPO.get(portfolioId);
    if (cached) {
      setData(cached);
      setLoading(false);
      return;
    }
  }
  
  // 2️⃣ Buscar da API
  const response = await fetch(`/api/portfolio/${portfolioId}/ENDPOINT`);
  const data = await response.json();
  
  // 3️⃣ Salvar no cache
  portfolioCache.TIPO.set(portfolioId, data);
  setData(data);
  
  setLoading(false);
};
```

### 3. Tipos de Cache Disponíveis

| Cache                          | Tipo                | Endpoint                              |
|--------------------------------|---------------------|---------------------------------------|
| `portfolioCache.analytics`     | Analytics completo  | `/api/portfolio/:id/analytics`        |
| `portfolioCache.metrics`       | Métricas resumo     | `/api/portfolio/:id/metrics`          |
| `portfolioCache.holdings`      | Posições            | `/api/portfolio/:id/holdings`         |
| `portfolioCache.transactions`  | Histórico           | `/api/portfolio/:id/transactions`     |
| `portfolioCache.suggestions`   | Sugestões           | `/api/portfolio/:id/suggestions`      |

---

## 🗑️ Como Usar - Invalidar Cache

### Import
```typescript
import { portfolioCache } from '@/lib/portfolio-cache';
```

### Após Qualquer Escrita
```typescript
// Criar transação
const response = await fetch('/api/portfolio/.../transactions', { method: 'POST', ... });
if (response.ok) {
  portfolioCache.invalidateAll(portfolioId); // ✅ ADICIONAR ISTO
  toast({ title: 'Sucesso' });
}

// Editar transação
const response = await fetch('/api/portfolio/.../transactions/...', { method: 'PATCH', ... });
if (response.ok) {
  portfolioCache.invalidateAll(portfolioId); // ✅ ADICIONAR ISTO
  toast({ title: 'Atualizado' });
}

// Deletar transação
const response = await fetch('/api/portfolio/.../transactions/...', { method: 'DELETE' });
if (response.ok) {
  portfolioCache.invalidateAll(portfolioId); // ✅ ADICIONAR ISTO
  toast({ title: 'Deletado' });
}
```

---

## 📋 Checklist de Implementação

### Fase 1: Adicionar Cache nos Componentes de Leitura

#### ✅ portfolio-analytics.tsx
- [x] Import de `portfolioCache`
- [x] Substituir cache antigo por `portfolioCache.analytics.get/set`
- [x] Manter `invalidatePortfolioAnalyticsCache()` como wrapper

#### 📝 portfolio-metrics-card.tsx
```typescript
// 1. Adicionar import
import { portfolioCache } from '@/lib/portfolio-cache';

// 2. No fetchMetrics:
if (!forceRefresh) {
  const cached = portfolioCache.metrics.get(portfolioId);
  if (cached) {
    setMetrics(cached);
    setLoading(false);
    return;
  }
}

// ... fetch da API ...

portfolioCache.metrics.set(portfolioId, data);
```

#### 📝 portfolio-holdings-table.tsx
```typescript
// 1. Adicionar import
import { portfolioCache } from '@/lib/portfolio-cache';

// 2. No fetchHoldings:
if (!forceRefresh) {
  const cached = portfolioCache.holdings.get(portfolioId);
  if (cached) {
    setHoldings(cached);
    setLoading(false);
    return;
  }
}

// ... fetch da API ...

portfolioCache.holdings.set(portfolioId, data);
```

#### 📝 portfolio-transaction-list.tsx
```typescript
// 1. Adicionar import
import { portfolioCache } from '@/lib/portfolio-cache';

// 2. No loadTransactions:
if (!forceRefresh) {
  const cached = portfolioCache.transactions.get(portfolioId);
  if (cached) {
    setTransactions(cached);
    setLoading(false);
    return;
  }
}

// ... fetch da API ...

portfolioCache.transactions.set(portfolioId, data);
```

#### 📝 portfolio-transaction-suggestions.tsx
```typescript
// 1. Adicionar import
import { portfolioCache } from '@/lib/portfolio-cache';

// 2. No loadSuggestions:
if (!forceRefresh) {
  const cached = portfolioCache.suggestions.get(portfolioId);
  if (cached) {
    setSuggestions(cached);
    setLoading(false);
    return;
  }
}

// ... fetch da API ...

portfolioCache.suggestions.set(portfolioId, data);
```

---

### Fase 2: Adicionar Invalidação nos Componentes de Escrita

#### ✅ portfolio-transaction-form.tsx
```typescript
// Já tem invalidação via invalidatePortfolioAnalyticsCache()
// que agora chama portfolioCache.invalidateAll()
```

#### 📝 portfolio-transaction-list.tsx
```typescript
// handleEditSave (após sucesso)
toast({ title: 'Sucesso', description: 'Transação atualizada' });
portfolioCache.invalidateAll(portfolioId); // ✅ ADICIONAR
setShowEditModal(false);

// handleDeleteConfirm (após sucesso)
toast({ title: 'Sucesso', description: 'Transação excluída' });
portfolioCache.invalidateAll(portfolioId); // ✅ ADICIONAR
setShowDeleteDialog(false);
```

#### 📝 portfolio-transaction-suggestions.tsx
```typescript
// handleConfirm (após sucesso)
toast({ title: 'Transação confirmada' });
portfolioCache.invalidateAll(portfolioId); // ✅ ADICIONAR

// handleReject (após sucesso)
toast({ title: 'Transação rejeitada' });
portfolioCache.invalidateAll(portfolioId); // ✅ ADICIONAR

// handleConfirmAll (após sucesso)
toast({ title: 'Sucesso!', description: `${confirmedCount} transações confirmadas` });
portfolioCache.invalidateAll(portfolioId); // ✅ ADICIONAR

// handleRecalculateSuggestions (após sucesso)
toast({ title: 'Sugestões recalculadas' });
portfolioCache.invalidateAll(portfolioId); // ✅ ADICIONAR
```

#### 📝 portfolio-negative-cash-alert.tsx
```typescript
// handleRecalculateBalances (após sucesso)
portfolioCache.invalidateAll(portfolioId); // ✅ ADICIONAR

// handleRecalculateMetrics (após sucesso)
portfolioCache.invalidateAll(portfolioId); // ✅ ADICIONAR
```

---

## 🧪 Como Testar

### Teste 1: Cache Funcionando
1. Abra uma carteira
2. Vá para aba "Analytics"
3. Console deve mostrar: `✅ [CACHE] Dados salvos: portfolio_analytics_...`
4. Recarregue a página ou volte para a aba
5. Console deve mostrar: `✅ [CACHE] Hit (...s): portfolio_analytics_...`

### Teste 2: Invalidação Completa
1. Com dados já cacheados, crie uma transação
2. Console deve mostrar:
   ```
   🧹 [CACHE] Invalidando TODOS os caches da carteira: ...
   🗑️ [CACHE] Removido: portfolio_analytics_...
   🗑️ [CACHE] Removido: portfolio_metrics_...
   🗑️ [CACHE] Removido: portfolio_holdings_...
   🗑️ [CACHE] Removido: portfolio_transactions_...
   🗑️ [CACHE] Removido: portfolio_suggestions_...
   ✅ [CACHE] Todos os caches invalidados para: ...
   ```
3. Ao acessar qualquer aba, dados devem ser buscados da API novamente

### Teste 3: Cache Expira em 1 Hora
1. Simule expirando o cache manualmente:
   ```js
   // No console do navegador
   const key = Object.keys(localStorage).find(k => k.startsWith('portfolio_analytics'));
   const data = JSON.parse(localStorage.getItem(key));
   data.timestamp = Date.now() - (61 * 60 * 1000); // 61 minutos atrás
   localStorage.setItem(key, JSON.stringify(data));
   ```
2. Recarregue a aba
3. Console deve mostrar: `⏰ [CACHE] Expirado (...s): ...`
4. Dados devem ser buscados da API

---

## 🔍 Debug

### Ver info dos caches
```js
// No console do navegador
portfolioCache.getInfo('ID_DA_CARTEIRA');
```

### Limpar todos os caches
```js
// No console do navegador
portfolioCache.clearAll();
```

---

## ⚠️ Pontos de Atenção

1. **Sempre invalidar após escrita**: Se esquecer, dados podem ficar desatualizados por até 1 hora
2. **forceRefresh**: Usar quando o usuário explicitamente pedir atualização
3. **SSR**: Cache só funciona no client-side (`typeof window !== 'undefined'`)
4. **Logout**: Considerar limpar todos os caches ao fazer logout

---

**Data**: 20 de Outubro de 2025  
**Status**: EM IMPLEMENTAÇÃO  
**Próximos Passos**: Adicionar cache nos componentes restantes e invalidação em todos os lugares de escrita

