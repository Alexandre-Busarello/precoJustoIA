# Integração de Invalidação de Cache - Guia Completo

## 🎯 Objetivo

Invalidar o cache de analytics em TODOS os lugares onde transações são modificadas.

---

## ✅ 1. portfolio-transaction-form.tsx

**Status**: ✅ CONCLUÍDO

**O que foi feito**:
```typescript
// Import adicionado
import { invalidatePortfolioAnalyticsCache } from '@/components/portfolio-analytics';

// Após criar transação (linha ~170)
invalidatePortfolioAnalyticsCache(portfolioId);
```

---

## 📝 2. portfolio-transaction-list.tsx

**O que fazer**:

### a) Adicionar import no topo:
```typescript
import { invalidatePortfolioAnalyticsCache } from '@/components/portfolio-analytics';
```

### b) Após EDITAR transação (linha ~237):
```typescript
toast({
  title: 'Sucesso',
  description: 'Transação atualizada com sucesso'
});

// ✅ ADICIONAR AQUI
invalidatePortfolioAnalyticsCache(portfolioId);

setShowEditModal(false);
```

### c) Após DELETAR transação (linha ~289):
```typescript
toast({
  title: 'Sucesso',
  description: 'Transação excluída com sucesso'
});

// ✅ ADICIONAR AQUI
invalidatePortfolioAnalyticsCache(portfolioId);

setShowDeleteDialog(false);
```

---

## 📝 3. portfolio-transaction-suggestions.tsx

**O que fazer**:

### a) Adicionar import no topo:
```typescript
import { invalidatePortfolioAnalyticsCache } from '@/components/portfolio-analytics';
```

### b) Método `handleConfirm` (aceitar sugestão individual):

Procure por:
```typescript
const handleConfirm = async (suggestion: SuggestedTransaction) => {
  // ... código existente ...
  
  toast({
    title: 'Transação confirmada',
    description: 'A transação foi registrada com sucesso'
  });
  
  // ✅ ADICIONAR AQUI
  invalidatePortfolioAnalyticsCache(portfolioId);
  
  loadSuggestions();
```

### c) Método `handleReject` (rejeitar sugestão individual):

Procure por:
```typescript
const handleReject = async (suggestion: SuggestedTransaction) => {
  // ... código existente ...
  
  toast({
    title: 'Transação rejeitada',
    description: 'A sugestão foi removida'
  });
  
  // ✅ ADICIONAR AQUI
  invalidatePortfolioAnalyticsCache(portfolioId);
  
  loadSuggestions();
```

### d) Método `handleConfirmAll` (confirmar todas):

Procure por:
```typescript
const handleConfirmAll = async () => {
  // ... código existente ...
  
  toast({
    title: 'Sucesso!',
    description: `${confirmedCount} transações confirmadas`
  });
  
  // ✅ ADICIONAR AQUI
  invalidatePortfolioAnalyticsCache(portfolioId);
  
  if (onTransactionsConfirmed) {
    onTransactionsConfirmed();
  }
```

### e) Método `handleRecalculateSuggestions` (recalcular):

Procure por:
```typescript
const handleRecalculateSuggestions = async () => {
  // ... código existente ...
  
  toast({
    title: 'Sugestões recalculadas',
    description: `${response.suggestions.length} novas sugestões geradas`
  });
  
  // ✅ ADICIONAR AQUI
  invalidatePortfolioAnalyticsCache(portfolioId);
  
  loadSuggestions();
```

---

## 📝 4. portfolio-negative-cash-alert.tsx (OPCIONAL)

Se houver botões "Recalcular" neste componente que modificam transações, adicionar também.

---

## 🧪 Como Testar

### Teste 1: Criar Transação
1. Abra uma carteira
2. Vá para aba "Analytics" (carrega dados)
3. Console deve mostrar: `💾 [CACHE] Analytics salvo no cache`
4. Volte para "Visão Geral"
5. Crie uma nova transação
6. Console deve mostrar: `🗑️ [CACHE] Cache invalidado`
7. Vá para "Analytics" novamente
8. Console deve mostrar: `🌐 [API] Buscando analytics do servidor...` (não cache)

### Teste 2: Editar Transação
1. Edite uma transação existente
2. Console deve mostrar: `🗑️ [CACHE] Cache invalidado`
3. Próximo acesso a analytics busca da API

### Teste 3: Deletar Transação
1. Delete uma transação
2. Console deve mostrar: `🗑️ [CACHE] Cache invalidado`
3. Próximo acesso a analytics busca da API

### Teste 4: Aceitar Sugestão
1. Aceite uma transação sugerida
2. Console deve mostrar: `🗑️ [CACHE] Cache invalidado`
3. Próximo acesso a analytics busca da API

### Teste 5: Rejeitar Sugestão
1. Rejeite uma transação sugerida
2. Console deve mostrar: `🗑️ [CACHE] Cache invalidado`
3. Próximo acesso a analytics busca da API

### Teste 6: Confirmar Todas
1. Clique em "Confirmar Todas"
2. Console deve mostrar: `🗑️ [CACHE] Cache invalidado`
3. Próximo acesso a analytics busca da API

### Teste 7: Recalcular Sugestões
1. Clique em "Recalcular"
2. Console deve mostrar: `🗑️ [CACHE] Cache invalidado`
3. Próximo acesso a analytics busca da API

---

## 📋 Checklist de Implementação

- [x] portfolio-transaction-form.tsx - Criar transação
- [ ] portfolio-transaction-list.tsx - Editar transação
- [ ] portfolio-transaction-list.tsx - Deletar transação
- [ ] portfolio-transaction-suggestions.tsx - Aceitar sugestão
- [ ] portfolio-transaction-suggestions.tsx - Rejeitar sugestão
- [ ] portfolio-transaction-suggestions.tsx - Confirmar todas
- [ ] portfolio-transaction-suggestions.tsx - Recalcular sugestões

---

## 🔍 Como Encontrar os Lugares Certos

Use grep para encontrar os lugares:

```bash
# Buscar onde toast de sucesso aparece
grep -n "title: 'Sucesso" src/components/portfolio-*.tsx

# Buscar onde transações são confirmadas
grep -n "confirmada\|rejeitada\|excluída" src/components/portfolio-*.tsx

# Buscar onde onTransactionsConfirmed é chamado
grep -n "onTransactionsConfirmed" src/components/portfolio-*.tsx
```

---

## 📝 Template de Código

Use este template em todos os lugares:

```typescript
// Após sucesso de qualquer operação de transação
toast({
  title: 'Sucesso',
  description: 'Operação realizada com sucesso'
});

// ✅ ADICIONAR ESTA LINHA
invalidatePortfolioAnalyticsCache(portfolioId);

// ... resto do código (callbacks, recarregamentos, etc)
```

---

**Status**: EM IMPLEMENTAÇÃO
**Data**: 20 de Outubro de 2025
**Próximo Passo**: Implementar nos arquivos restantes usando este guia

