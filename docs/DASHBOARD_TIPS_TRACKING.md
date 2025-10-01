# 📊 Sistema de Tracking para Dicas Dinâmicas do Dashboard

## 📋 Resumo

Implementação completa do **tracking de uso de ferramentas** para alimentar o sistema inteligente de dicas do Dashboard. Agora o sistema sabe exatamente o que o usuário já usou e pode sugerir ferramentas que ele ainda não explorou.

---

## ✅ O Que Foi Implementado

### **1. Tracking do Backtest (via Banco de Dados)**

**Como funciona:**
- Verifica se o usuário tem registros na tabela `BacktestConfig` do Prisma
- Simples e confiável: se há configurações de backtest, o usuário usou a ferramenta

**Implementação:**

#### **Backend: `/api/dashboard-stats`**

```typescript
// Verificar se usuário já usou Backtest
const backtestCount = await safeQuery('backtest-count', () =>
  prisma.backtestConfig.count({
    where: {
      userId: currentUser.id
    }
  })
);
const hasUsedBacktest = backtestCount > 0;

return NextResponse.json({
  // ... outros campos
  hasUsedBacktest // ← Novo campo
});
```

**Vantagens:**
- ✅ Dados persistentes (não depende de localStorage)
- ✅ Funciona em qualquer dispositivo
- ✅ Preciso (baseado em ação real do usuário)
- ✅ Não pode ser "limpo" por acidente

---

### **2. Tracking do Comparador (via LocalStorage)**

**Como funciona:**
- Marca `has_used_comparator: 'true'` no localStorage quando o usuário acessa a página do Comparador
- Rápido e simples, ideal para páginas sem persistência de dados

**Implementação:**

#### **Frontend: `StockComparisonSelector`**

```typescript
// ✅ Marcar que usuário usou o Comparador
useEffect(() => {
  localStorage.setItem('has_used_comparator', 'true')
}, [])
```

#### **Dashboard: Leitura do Tracking**

```typescript
const [hasUsedComparator, setHasUsedComparator] = useState(false)

useEffect(() => {
  const used = localStorage.getItem('has_used_comparator')
  setHasUsedComparator(used === 'true')
}, [])
```

**Vantagens:**
- ✅ Sem necessidade de criar tabelas no banco
- ✅ Resposta instantânea (sem query)
- ✅ Simples de implementar e manter
- ✅ Adequado para ferramentas "read-only" (sem dados salvos)

---

## 🎯 Integração com o Sistema de Dicas

### **Contexto Atualizado**

```typescript
const tipContext: DashboardTipContext = {
  totalRankings: stats?.totalRankings || 0,
  hasUsedBacktest: stats?.hasUsedBacktest || false, // ✅ Do banco
  hasUsedComparator: hasUsedComparator, // ✅ Do localStorage
  isPremium,
  hasCreatedPortfolio: false // TODO: futuro
}

const currentTip = getBestTip(tipContext)
```

---

## 📊 Como as Dicas Usam o Tracking

### **Exemplo 1: Dica de Backtest**

```typescript
{
  id: 'try-backtest',
  title: 'Simule uma Estratégia de Investimento',
  description: 'Teste como sua carteira teria performado nos últimos anos com dados reais do mercado.',
  icon: TrendingUp,
  cta: 'Testar Backtest',
  ctaLink: '/backtest',
  color: 'blue',
  priority: 2,
  shouldShow: (context) => !context.hasUsedBacktest && context.isPremium // ← TRACKING!
}
```

**Lógica:**
- Se `hasUsedBacktest === false` → Dica aparece
- Se `hasUsedBacktest === true` → Dica não aparece (usuário já conhece)

---

### **Exemplo 2: Dica do Comparador**

```typescript
{
  id: 'compare-stocks',
  title: 'Compare Ações Lado a Lado',
  description: 'Veja indicadores de múltiplas empresas ao mesmo tempo e identifique oportunidades.',
  icon: BarChart3,
  cta: 'Abrir Comparador',
  ctaLink: '/comparador',
  color: 'purple',
  priority: 3,
  shouldShow: (context) => !context.hasUsedComparator // ← TRACKING!
}
```

**Lógica:**
- Se `hasUsedComparator === false` → Dica aparece
- Se `hasUsedComparator === true` → Dica não aparece

---

## 🔄 Fluxo Completo

### **Backtest (Banco de Dados)**

```
Usuário cria Backtest
    ↓
BacktestConfig salvo no banco
    ↓
Dashboard carrega /api/dashboard-stats
    ↓
Query: SELECT COUNT(*) FROM backtest_configs WHERE user_id = ?
    ↓
hasUsedBacktest = count > 0
    ↓
tipContext.hasUsedBacktest = true
    ↓
Dicas de Backtest NÃO aparecem mais ✅
```

---

### **Comparador (LocalStorage)**

```
Usuário acessa /comparador
    ↓
StockComparisonSelector monta
    ↓
useEffect() → localStorage.setItem('has_used_comparator', 'true')
    ↓
Usuário volta ao Dashboard
    ↓
useEffect() → localStorage.getItem('has_used_comparator')
    ↓
tipContext.hasUsedComparator = true
    ↓
Dicas de Comparador NÃO aparecem mais ✅
```

---

## 📈 Benefícios do Sistema

### **1. Experiência Personalizada** 🎯
- Cada usuário vê dicas **relevantes para seu nível de engajamento**
- Não repete dicas de ferramentas que o usuário já usa

### **2. Aumento de Engajamento** 📊
- Usuários descobrem ferramentas que ainda não exploraram
- Dicas sempre "frescas" e úteis

### **3. Simplicidade Técnica** 🔧
- Backtest: 1 query simples (`COUNT`)
- Comparador: 1 linha no localStorage
- Zero overhead no sistema

### **4. Escalabilidade** 🚀
- Fácil adicionar novas ferramentas:
  - Com dados salvos → verificar tabela no banco
  - Sem dados salvos → localStorage

---

## 🧪 Como Testar

### **Teste 1: Backtest (Primeiro Acesso)**

1. **Novo usuário Premium** (sem backtests criados)
2. Abrir Dashboard
3. **Verificar:** Dica "Simule uma Estratégia de Investimento" aparece
4. Criar um backtest em `/backtest`
5. Voltar ao Dashboard
6. **Resultado Esperado:** Dica de Backtest **não aparece mais** ✅

---

### **Teste 2: Comparador (Primeiro Acesso)**

1. **Usuário novo** (localStorage limpo)
2. Abrir Dashboard
3. **Verificar:** Dica "Compare Ações Lado a Lado" aparece
4. Clicar e acessar `/comparador`
5. Voltar ao Dashboard
6. **Resultado Esperado:** Dica de Comparador **não aparece mais** ✅

---

### **Teste 3: Persistência entre Sessões**

#### **Backtest:**
1. Criar um backtest
2. Fazer logout
3. Fazer login
4. **Resultado Esperado:** `hasUsedBacktest = true` (banco persiste) ✅

#### **Comparador:**
1. Acessar `/comparador`
2. Fechar navegador
3. Abrir navegador novamente
4. **Resultado Esperado:** `hasUsedComparator = true` (localStorage persiste) ✅

---

## 🔍 Debugging

### **Verificar Backtest Tracking:**

```typescript
// No Dashboard
console.log('hasUsedBacktest:', stats?.hasUsedBacktest)

// Na API
// logs automáticos: "📊 Verificando se usuário já usou Backtest..."
```

### **Verificar Comparador Tracking:**

```typescript
// No Console do Browser
localStorage.getItem('has_used_comparator') // deve retornar 'true'

// No Dashboard
console.log('hasUsedComparator:', hasUsedComparator)
```

### **Verificar Contexto de Dicas:**

```typescript
// No Dashboard, antes de chamar getBestTip()
console.log('tipContext:', tipContext)
// {
//   totalRankings: 5,
//   hasUsedBacktest: true,
//   hasUsedComparator: false,
//   isPremium: true,
//   hasCreatedPortfolio: false
// }
```

---

## 🆕 Como Adicionar Novas Ferramentas

### **Ferramenta COM Dados Salvos (ex: Portfolio)**

1. **Adicionar campo no `/api/dashboard-stats`:**

```typescript
const portfolioCount = await safeQuery('portfolio-count', () =>
  prisma.portfolio.count({
    where: { userId: currentUser.id }
  })
);
const hasCreatedPortfolio = portfolioCount > 0;

return NextResponse.json({
  // ...
  hasCreatedPortfolio
});
```

2. **Atualizar interface `DashboardStats`:**

```typescript
interface DashboardStats {
  // ...
  hasCreatedPortfolio: boolean;
}
```

3. **Atualizar `tipContext` no Dashboard:**

```typescript
const tipContext: DashboardTipContext = {
  // ...
  hasCreatedPortfolio: stats?.hasCreatedPortfolio || false
}
```

4. **Criar dica no `dashboard-tips.ts`:**

```typescript
{
  id: 'create-portfolio',
  shouldShow: (context) => !context.hasCreatedPortfolio && context.isPremium
}
```

---

### **Ferramenta SEM Dados Salvos (ex: Calculadora)**

1. **Adicionar estado no Dashboard:**

```typescript
const [hasUsedCalculator, setHasUsedCalculator] = useState(false)

useEffect(() => {
  const used = localStorage.getItem('has_used_calculator')
  setHasUsedCalculator(used === 'true')
}, [])
```

2. **Marcar no componente da ferramenta:**

```typescript
// Em /components/calculator.tsx
useEffect(() => {
  localStorage.setItem('has_used_calculator', 'true')
}, [])
```

3. **Atualizar `tipContext`:**

```typescript
const tipContext: DashboardTipContext = {
  // ...
  hasUsedCalculator: hasUsedCalculator
}
```

4. **Criar dica no `dashboard-tips.ts`:**

```typescript
{
  id: 'try-calculator',
  shouldShow: (context) => !context.hasUsedCalculator
}
```

---

## 📊 Estatísticas de Uso

### **Tracking Atual:**

| Ferramenta | Método | Onde Verifica | Persiste Entre Sessões? |
|------------|--------|---------------|-------------------------|
| **Backtest** | Banco de Dados | `BacktestConfig` count | ✅ Sim |
| **Comparador** | LocalStorage | `has_used_comparator` key | ✅ Sim (mesmo dispositivo) |
| **Portfolio** | - | TODO | - |

---

## ⚠️ Limitações Conhecidas

### **LocalStorage:**
- **Limitação:** Específico do dispositivo/navegador
- **Impacto:** Se usuário acessa de outro dispositivo, tracking é perdido
- **Solução Futura:** Migrar para banco se necessário

### **Banco de Dados:**
- **Limitação:** Adiciona query ao `/api/dashboard-stats`
- **Impacto:** Mínimo (query simples com COUNT)
- **Otimização:** Já usa `safeQuery` com cache

---

## 🎓 Lições Aprendidas

### **1. Escolher o Método Certo**
- **Dados persistidos no banco:** Banco de Dados
- **Ferramentas "read-only":** LocalStorage

### **2. Simplicidade > Complexidade**
- Um `COUNT` é mais que suficiente
- Não precisa de "analytics pesados"

### **3. Feedback Imediato**
- LocalStorage = instantâneo
- Banco = ligeiramente mais lento, mas mais robusto

### **4. UX Matters**
- Usuários **gostam** de ver que a plataforma "lembra" deles
- Dicas repetitivas são **irritantes**

---

## 🔄 Atualizações Futuras

### **Potenciais Melhorias:**

1. **Tracking Mais Granular:**
   - Não só "usou" mas "quantas vezes usou"
   - Data do último uso

2. **Sincronização Cross-Device:**
   - Migrar localStorage para banco
   - Ou criar tabela `UserFeatureUsage`

3. **Analytics Dashboard Admin:**
   - Ver quais ferramentas são mais/menos usadas
   - Otimizar onboarding baseado em dados

4. **A/B Testing:**
   - Testar diferentes dicas
   - Ver quais convertem mais

---

## 📚 Arquivos Modificados

| Arquivo | Mudança | Linhas |
|---------|---------|--------|
| **`/api/dashboard-stats/route.ts`** | Adicionar `hasUsedBacktest` | +13 |
| **`dashboard/page.tsx`** | Adicionar `hasUsedComparator` state + useEffect | +8 |
| **`stock-comparison-selector.tsx`** | Marcar localStorage ao montar | +4 |
| **`dashboard-tips.ts`** | Usar tracking nas dicas | 0 (já implementado) |

**Total:** +25 linhas

---

## 🎯 Resultado Final

### **Antes:**

```typescript
const tipContext: DashboardTipContext = {
  totalRankings: stats?.totalRankings || 0,
  hasUsedBacktest: false, // ❌ Fixo
  hasUsedComparator: true, // ❌ Fixo
  isPremium,
  hasCreatedPortfolio: false
}
```

**Problema:** Dicas sempre mostram as mesmas coisas, ignorando o que o usuário já fez.

---

### **Depois:**

```typescript
const tipContext: DashboardTipContext = {
  totalRankings: stats?.totalRankings || 0,
  hasUsedBacktest: stats?.hasUsedBacktest || false, // ✅ Do banco
  hasUsedComparator: hasUsedComparator, // ✅ Do localStorage
  isPremium,
  hasCreatedPortfolio: false
}
```

**Benefício:** Dicas **inteligentes** baseadas no comportamento real do usuário! 🎉

---

**Data:** 2025-01-01  
**Versão:** 8.0 - Sistema de Tracking de Dicas  
**Status:** ✅ Produção

