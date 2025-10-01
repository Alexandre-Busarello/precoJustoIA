# 🧠 Dashboard Dinâmica e Inteligente

## 🎯 Objetivo

Transformar a Dashboard em uma experiência personalizada que se adapta ao comportamento do usuário, estimulando engajamento e descoberta de recursos através de:
- Dicas contextuais inteligentes
- Hierarquia adaptativa de conteúdo
- Jornada progressiva baseada em experiência

---

## ✨ Sistema de Dicas Dinâmicas

### **Arquivo:** `src/lib/dashboard-tips.ts`

### **Como Funciona:**

O sistema analisa o **contexto do usuário** e seleciona a dica mais relevante baseada em:
- Número total de rankings
- Uso de ferramentas (Backtest, Comparador)
- Status Premium
- Tempo desde última análise
- Histórico de atividades

### **Tipos de Dicas (13 diferentes):**

#### **1. Novos Usuários (0 rankings):**
```typescript
🚀 "Comece sua jornada!"
Priority: 100
→ Criar primeiro ranking com Graham
→ Link: /ranking

🎓 "Entenda as metodologias"
Priority: 90
→ Conhecer 8 modelos disponíveis
→ Link: /metodologia
```

#### **2. Usuários Iniciantes (1-3 rankings):**
```typescript
⚡ "Experimente outros modelos"
Priority: 80
→ Testar Greenblatt ou Bazin
→ Link: /ranking

📊 "Compare ações lado a lado"
Priority: 75
→ Usar Comparador (se ainda não usou)
→ Link: /comparador
```

#### **3. Usuários Intermediários (4-10 rankings):**
```typescript
📈 "Teste suas estratégias"
Priority: 70
→ Fazer Backtesting histórico
→ Link: /backtest

🎯 "Análise setorial"
Priority: 65
→ Comparar empresas do mesmo setor
→ Link: /comparador
```

#### **4. Usuários Avançados (10+ rankings):**
```typescript
💰 "Desbloqueie todo potencial" (Free)
Priority: 60
→ Upgrade para Premium
→ Link: /planos

🔥 "Estratégias avançadas" (Premium)
Priority: 55
→ Combinar múltiplos modelos
→ Link: /metodologia
```

#### **5. Usuários Inativos (7+ dias sem análise):**
```typescript
💡 "Que tal uma nova análise?"
Priority: 85
→ Voltar a criar rankings
→ Link: /ranking
```

#### **6. Features Premium:**
```typescript
✨ "Análise com IA"
Priority: 50
→ IA preditiva e insights
→ Link: /ranking
```

---

## 🎨 Visual das Dicas

### **Componente Responsivo:**
```tsx
- Cores dinâmicas baseadas no tipo de dica
- Ícones grandes e emotivos (emoji)
- Descrição clara e acionável
- CTA direto para a ação
- Animações sutis no hover
```

### **Cores por Contexto:**
- 🟣 **Violet** - Premium, IA, Avançado
- 🔵 **Blue** - Análises, Rankings, Modelos
- 🟢 **Green** - Backtesting, Performance
- 🟠 **Orange** - Re-engajamento, Experimentação
- 🔴 **Red** - Urgência, Oportunidades
- 🟢 **Emerald** - Estratégias, Crescimento

---

## 🔄 Hierarquia Adaptativa

### **Usuário Novo (0 rankings):**

```
┌──────────────────────────────────────┐
│  💬 Grupo WhatsApp (se Alfa)         │
├──────────────────────────────────────┤
│  🚀 CRIAR SEU PRIMEIRO RANKING       │
│  ┌────────────────────────────────┐ │
│  │ Card GIGANTE focado            │ │
│  │ ✓ Análise fundamentalista      │ │
│  │ ✓ Rankings automáticos          │ │
│  │ ✓ Ações subvalorizadas         │ │
│  │                                 │ │
│  │ [Começar agora →]              │ │
│  └────────────────────────────────┘ │
├──────────────────────────────────────┤
│  🛠️ Ferramentas (Backtest + Comparador)│
├──────────────────────────────────────┤
│  📊 Histórico (vazio)                │
└──────────────────────────────────────┘
```

---

### **Usuário Ativo (1+ rankings):**

```
┌──────────────────────────────────────┐
│  💬 Grupo WhatsApp (se Alfa + clicou)│
├──────────────────────────────────────┤
│  📊 SUAS ANÁLISES + CRIAR NOVO       │
│  ┌───────────────┬────────────────┐ │
│  │ Análises      │ Nova Análise   │ │
│  │ Recentes      │                │ │
│  │               │ 📊 Criar Ranking│ │
│  │ Badge: X      │                │ │
│  │               │ Explore modelos│ │
│  │ [Ver Histórico│ [Criar →]     │ │
│  └───────────────┴────────────────┘ │
├──────────────────────────────────────┤
│  🛠️ Ferramentas                      │
├──────────────────────────────────────┤
│  📊 Histórico Completo               │
└──────────────────────────────────────┘
```

---

## 📊 Lógica de Priorização

### **Sistema de Pontos:**

```typescript
Priority = 100 (Altíssima) → Novo usuário criar 1º ranking
Priority = 90              → Entender metodologias
Priority = 85              → Re-engajar inativos
Priority = 80              → Experimentar novos modelos
Priority = 75              → Usar ferramentas (Comparador)
Priority = 70              → Fazer Backtest
Priority = 65              → Análise setorial
Priority = 60              → Upgrade Premium (Free users)
Priority = 55              → Estratégias avançadas (Premium)
Priority = 50              → Features IA
Priority = 1               → Dica genérica (fallback)
```

### **Algoritmo de Seleção:**

```typescript
function getBestTip(context: DashboardTipContext): DashboardTip {
  const applicableTips = DASHBOARD_TIPS
    .filter(tip => tip.condition(context))  // Filtra dicas aplicáveis
    .sort((a, b) => b.priority - a.priority) // Ordena por prioridade
  
  return applicableTips[0] || FALLBACK_TIP
}
```

---

## 🎓 Exemplos de Jornada do Usuário

### **Jornada 1: Novo Usuário Free**

```
Day 1:
└─ Dica: 🚀 "Comece sua jornada!" (Priority 100)
   └─ Ação: Criar primeiro ranking
      └─ Resultado: totalRankings = 1

Day 2:
└─ Dica: ⚡ "Experimente outros modelos" (Priority 80)
   └─ Ação: Testar Greenblatt
      └─ Resultado: totalRankings = 2

Day 5:
└─ Dica: 📊 "Compare ações lado a lado" (Priority 75)
   └─ Ação: Usar Comparador
      └─ Resultado: hasUsedComparator = true

Day 10:
└─ Dica: 📈 "Teste suas estratégias" (Priority 70)
   └─ Ação: Fazer Backtest
      └─ Resultado: hasUsedBacktest = true

Day 15:
└─ Dica: 💰 "Desbloqueie todo potencial" (Priority 60)
   └─ Ação: Upgrade para Premium
```

### **Jornada 2: Usuário Inativo**

```
Last Ranking: 10 dias atrás
└─ Dica: 💡 "Que tal uma nova análise?" (Priority 85)
   └─ Contexto: daysSinceLastRanking >= 7
   └─ Ação: Criar novo ranking
      └─ Resultado: Re-engagement!
```

### **Jornada 3: Usuário Premium Avançado**

```
Premium: true
Rankings: 15+
└─ Dica: 🔥 "Estratégias avançadas" (Priority 55)
   └─ Ação: Combinar modelos
      └─ OU
         ✨ "Análise com IA" (Priority 50)
         └─ Ação: Usar IA preditiva
```

---

## 🔧 Implementação Técnica

### **1. Context Interface:**

```typescript
interface DashboardTipContext {
  totalRankings: number            // Quantos rankings criou
  hasUsedBacktest: boolean         // Já fez backtest?
  hasUsedComparator: boolean       // Já usou comparador?
  isPremium: boolean               // É usuário Premium?
  daysSinceLastRanking?: number    // Dias sem análise
  hasCreatedPortfolio: boolean     // Criou carteira?
}
```

### **2. Tip Interface:**

```typescript
interface DashboardTip {
  id: string                       // Identificador único
  title: string                    // Título da dica
  description: string              // Descrição detalhada
  cta: string                      // Texto do botão
  ctaLink: string                  // Link de destino
  icon: '💡' | '🚀' | '📊' | ...  // Emoji visual
  color: 'violet' | 'blue' | ...   // Cor do card
  priority: number                 // Prioridade (maior = mais)
  condition: (ctx) => boolean      // Quando mostrar
}
```

### **3. Uso na Dashboard:**

```tsx
// Calcular contexto
const tipContext: DashboardTipContext = {
  totalRankings: stats?.totalRankings || 0,
  hasUsedBacktest: stats?.hasUsedBacktest || false, // ✅ Tracking via banco (BacktestConfig)
  hasUsedComparator: hasUsedComparator, // ✅ Tracking via localStorage
  isPremium,
  hasCreatedPortfolio: false // TODO: implementar quando houver carteiras
}

// Obter melhor dica
const currentTip = getBestTip(tipContext)

// Renderizar
<Card className={`bg-gradient-to-br ${currentTip.color}`}>
  {currentTip.icon} {currentTip.title}
  {currentTip.description}
  <Button href={currentTip.ctaLink}>{currentTip.cta}</Button>
</Card>
```

---

## 📈 Métricas de Sucesso

### **KPIs a Monitorar:**

1. **Taxa de Criação de 1º Ranking:**
   - Meta: +60% conversão de novos usuários

2. **Uso de Ferramentas:**
   - Meta: +40% em uso de Backtest
   - Meta: +50% em uso de Comparador

3. **Retenção:**
   - Meta: -30% em usuários inativos (7+ dias)

4. **Upgrade Premium:**
   - Meta: +25% em conversão Free → Premium

5. **Engajamento:**
   - Meta: +35% em rankings criados por usuário ativo
   - Meta: +45% em sessões por semana

---

## 🚀 Próximas Melhorias

### **Fase 2: Tracking Completo**

```typescript
// Adicionar tracking de uso de ferramentas
localStorage.setItem('backtest_used', 'true')
localStorage.setItem('comparator_used', 'true')
localStorage.setItem('last_ranking_date', Date.now())
```

### **Fase 3: Dicas Múltiplas**

```typescript
// Mostrar até 3 dicas relevantes
const top3Tips = getTopTips(context, 3)
```

### **Fase 4: Dicas Temporais**

```typescript
// Dicas baseadas em hora do dia, dia da semana
if (isMorning) → "☕ Bom dia! Que tal começar analisando..."
if (isMonday) → "📊 Início de semana! Revise seu portfólio..."
```

### **Fase 5: A/B Testing**

```typescript
// Testar diferentes dicas e medir conversão
const tipVariant = getABTestTip(context, experimentId)
```

### **Fase 6: Machine Learning**

```typescript
// Personalizar dicas com ML baseado em comportamento
const predictedNextAction = mlModel.predict(userHistory)
const suggestedTip = findTipForAction(predictedNextAction)
```

---

## 📝 Arquivos Modificados/Criados

### **Criados:**
1. ✅ `src/lib/dashboard-tips.ts` - Sistema de dicas inteligentes

### **Modificados:**
1. ✅ `src/app/dashboard/page.tsx` - Dashboard adaptativa
   - Import do sistema de dicas
   - Cálculo de contexto
   - Renderização condicional (novo vs ativo)
   - Grid adaptativo (histórico + novo)
   - Dica dinâmica com cores e links

---

## 📊 Sistema de Tracking

### **Tracking Implementado (v8.0):**

#### **1. Backtest (Banco de Dados)**

```typescript
// /api/dashboard-stats
const backtestCount = await prisma.backtestConfig.count({
  where: { userId: currentUser.id }
});
const hasUsedBacktest = backtestCount > 0;

return NextResponse.json({
  // ...
  hasUsedBacktest
});
```

**Vantagens:**
- ✅ Persiste entre dispositivos
- ✅ Baseado em ação real (criou backtest)
- ✅ Não pode ser limpo por acidente

---

#### **2. Comparador (LocalStorage)**

```typescript
// StockComparisonSelector.tsx
useEffect(() => {
  localStorage.setItem('has_used_comparator', 'true')
}, [])

// Dashboard
const [hasUsedComparator, setHasUsedComparator] = useState(false)

useEffect(() => {
  const used = localStorage.getItem('has_used_comparator')
  setHasUsedComparator(used === 'true')
}, [])
```

**Vantagens:**
- ✅ Resposta instantânea
- ✅ Não precisa de tabela no banco
- ✅ Ideal para páginas sem persistência

---

### **Como Adicionar Novas Ferramentas:**

**Com dados no banco:**
1. Adicionar count no `/api/dashboard-stats`
2. Retornar campo `hasUsed[Feature]`
3. Atualizar interface `DashboardStats`
4. Usar no `tipContext`

**Sem dados no banco (localStorage):**
1. Marcar `localStorage.setItem('has_used_[feature]', 'true')` na ferramenta
2. Ler no Dashboard com `useState` + `useEffect`
3. Usar no `tipContext`

📖 **Documentação Completa:** `/docs/DASHBOARD_TIPS_TRACKING.md`

---

## 🎉 Resultado

A Dashboard agora é **verdadeiramente dinâmica** e se adapta ao usuário:

✅ **Novos usuários**: Foco total em criar primeiro ranking  
✅ **Usuários ativos**: Equilíbrio entre histórico e novas análises  
✅ **Dicas inteligentes**: 13 dicas contextuais que guiam a jornada  
✅ **Tracking real**: Sabe o que o usuário já usou (Backtest, Comparador)  
✅ **Engajamento**: Links diretos e CTAs claros  
✅ **Personalização**: Cores, ícones e mensagens adaptativas  
✅ **Escalável**: Fácil adicionar novas dicas e condições  

**Resultado:** Interface que ensina, guia e engaja o usuário em cada etapa da jornada! 🚀

