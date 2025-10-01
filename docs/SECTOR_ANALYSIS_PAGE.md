# 📊 Página de Análise Setorial

## 📋 Resumo

Nova página dedicada para **comparação setorial de múltiplos setores** da B3, otimizada para SEO e integrada ao sistema de dicas inteligentes do Dashboard. Permite aos usuários visualizar e comparar as melhores empresas de cada setor em uma única página.

---

## 🎯 Objetivo

Criar uma **landing page SEO-friendly** que:
1. **Compare múltiplos setores** simultaneamente
2. **Mostre top 5 empresas** de cada setor
3. **Seja parcialmente aberta** com estratégia de conversão (paywall no TOP 1)
4. **Rankeie bem no Google** para termos como "melhores setores B3", "análise setorial bovespa"
5. **Integre com o Dashboard** através do sistema de dicas
6. **Converta usuários gratuitos** em Premium através de paywall estratégico

---

## 🔒 Estratégia de Monetização

### **Paywall no TOP 1 de Cada Setor**

**Para Usuários FREE/Deslogados:**
- ✅ Visualizam **3 setores** (Consumo Cíclico, Energia, Saúde)
- ✅ Veem empresas **#2 a #5** de cada setor
- 🔒 **TOP 1 bloqueado** com blur + overlay + CTA "Desbloquear Premium"
- 🔒 Setores restantes bloqueados (upgrade para Premium)

**Para Usuários PREMIUM:**
- ✅ **Todos os setores** desbloqueados
- ✅ **TOP 1** de cada setor visível
- ✅ Botão "Carregar Mais Setores" disponível

**Objetivo:** Gerar FOMO (Fear of Missing Out) e curiosidade sobre a melhor empresa de cada setor, incentivando upgrade para Premium.

**Documentação Detalhada:** Ver `SECTOR_ANALYSIS_PAYWALL.md`

---

## 🏗️ Arquitetura

### **1. API Endpoint: `/api/sector-analysis`**

**Funcionalidade:**
- Analisa os **12 principais setores da B3**
- Para cada setor, busca empresas com **indicadores mínimos de qualidade**
- Calcula o **overall score** de cada empresa
- Retorna as **top 5 empresas** de cada setor
- Implementa **cache de 24 horas** para performance

**Setores Analisados:**
```typescript
const mainSectors = [
  'Energia Elétrica',
  'Bancos',
  'Petróleo e Gás',
  'Varejo',
  'Construção Civil',
  'Saúde',
  'Alimentos e Bebidas',
  'Telecomunicações',
  'Seguradoras',
  'Mineração',
  'Transporte',
  'Papel e Celulose'
]
```

**Filtros de Qualidade:**
```typescript
roe: { gte: 0.08 },          // ROE >= 8%
pl: { gt: 0, lt: 30 },       // P/L entre 0 e 30
lpa: { not: null },          // LPA obrigatório
vpa: { not: null },          // VPA obrigatório
liquidezCorrente: { gte: 0.8 } // Liquidez >= 0.8
```

**Resposta:**
```typescript
{
  sectors: [
    {
      sector: "Bancos",
      companyCount: 5,
      topCompanies: [
        {
          ticker: "ITUB4",
          name: "Itaú Unibanco",
          score: 87,
          currentPrice: 32.50,
          logoUrl: "...",
          recommendation: "Compra Forte"
        },
        // ... mais 4 empresas
      ],
      averageScore: 82.4
    },
    // ... mais setores
  ],
  cached: false,
  timestamp: "2025-01-01T12:00:00Z"
}
```

---

### **2. Página: `/analise-setorial`**

**Metadata SEO:**
```typescript
export const metadata: Metadata = {
  title: 'Análise Setorial de Ações B3 | Compare Setores da Bovespa',
  description: '📊 Análise setorial completa da B3! Compare as melhores empresas de cada setor...',
  keywords: 'análise setorial B3, setores bovespa, melhores setores para investir...',
  openGraph: { ... },
  robots: { index: true, follow: true }
}
```

**Estrutura:**

#### **Hero Section** (SEO-friendly)
- Título principal H1 com keywords
- Descrição clara e objetiva
- Background gradient atraente

#### **Como Funciona** (SEO content)
- 3 cards explicando:
  1. Setores Estratégicos
  2. Análise por IA
  3. Ranking Atualizado

#### **Client Component** (Dados Dinâmicos)
- Carregamento assíncrono dos dados
- UI interativa e responsiva
- Expandir/Recolher setores

#### **SEO Content Section**
- "Por que fazer Análise Setorial?"
- "Principais Setores da B3 para Investir"
- Conteúdo rico em keywords naturais

---

### **3. Componente: `SectorAnalysisClient`**

**Funcionalidades:**

#### **Header com Estatísticas:**
```typescript
- Setores Analisados (12)
- Empresas Avaliadas (60)
- Score Médio Geral (78)
```

#### **Cards de Setores:**
```typescript
<Card>
  <CardHeader>
    - Nome do Setor
    - Número de empresas
    - Score médio do setor
    - Badge com score colorido
  </CardHeader>
  
  <CardContent>
    - Lista de top 3 empresas (inicialmente)
    - Badge "🏆 TOP 1" para a melhor
    - Logo, Ticker, Nome, Score, Recomendação
    - Botão "Ver Todas" (se > 3 empresas)
    - Botão "Comparar X Empresas do Setor"
      → Redireciona para /compara-acoes/TICKER1/TICKER2/TICKER3...
  </CardContent>
</Card>
```

**Exemplo de URL gerada:**
```
Setor: Transporte
Top Empresas: TGMA3, RAPT3, PORT3, MILS3, VAMO3

Botão gera: /compara-acoes/TGMA3/RAPT3/PORT3/MILS3/VAMO3
```

#### **Recursos Interativos:**
- ✅ **Expandir/Recolher:** Mostrar todas as empresas ou apenas top 3
- ✅ **Links Diretos:** Clique em qualquer empresa → `/acao/[ticker]`
- ✅ **Comparação:** Botão para comparar empresas do setor
- ✅ **Cores Dinâmicas:** Scores coloridos (verde, azul, amarelo, laranja)
- ✅ **Logos:** Exibição de logos das empresas

#### **CTA Final:**
- Link para Quick Ranker (criar ranking personalizado)
- Design destacado para conversão

---

## 🎨 UI/UX

### **Design System:**

| Elemento | Estilo | Cor |
|----------|--------|-----|
| **Hero** | Gradient | Blue-600 → Indigo-700 |
| **Cards de Setor** | White/Shadow | Border-slate-200 |
| **Score >= 85** | Green | text-green-600 |
| **Score >= 70** | Blue | text-blue-600 |
| **Score >= 50** | Yellow | text-yellow-600 |
| **Score < 50** | Orange | text-orange-600 |
| **Hover Cards** | Border Blue | hover:border-blue-300 |

### **Responsividade:**

```css
Mobile (< 640px):
  - 1 coluna
  - Cards full-width
  - Textos menores

Tablet (640-1024px):
  - 2 colunas para stats
  - Cards com padding reduzido

Desktop (> 1024px):
  - 3 colunas para stats
  - Cards otimizados
  - Hover effects completos
```

---

## 🔗 Integração com Dashboard

### **Dashboard Tip Atualizado:**

```typescript
{
  id: 'sector-analysis',
  title: '🎯 Análise Setorial',
  description: 'Compare as melhores empresas de cada setor da B3: Bancos, Energia, Varejo, Saúde e mais.',
  cta: 'Ver Análise Setorial',
  ctaLink: '/analise-setorial', // ← NOVA PÁGINA
  icon: '🎯',
  color: 'blue',
  priority: 65,
  condition: (ctx) => ctx.totalRankings >= 5
}
```

**Lógica:**
- Aparece para usuários que já criaram **5+ rankings**
- Sugere explorar análise setorial para diversificação
- Link direto para a nova página

---

## 📈 SEO Strategy

### **Target Keywords:**

**Primary:**
- análise setorial B3
- setores bovespa
- melhores setores para investir

**Secondary:**
- comparação setorial ações
- ranking setores B3
- análise fundamentalista por setor
- bancos Brasil ações
- energia elétrica ações
- top ações por setor

### **On-Page SEO:**

✅ **Title Tag:** 60-70 caracteres com keywords principais  
✅ **Meta Description:** 150-160 caracteres persuasiva  
✅ **H1:** Única, com keyword principal  
✅ **H2/H3:** Estruturados com keywords secundárias  
✅ **Alt Text:** Imagens com descrições claras  
✅ **Internal Links:** Links para comparador, quick ranker, páginas de empresas  
✅ **Schema Markup:** (futuro) Organization, BreadcrumbList  

### **Content Strategy:**

1. **Above the Fold:** Hero com título + descrição clara
2. **Quick Value:** Cards de "Como Funciona"
3. **Interactive Content:** Dados dinâmicos dos setores
4. **Long-Form SEO Content:** Seção "Por que fazer Análise Setorial?"
5. **CTA:** Conversão para ranking personalizado

---

## 🚀 Performance

### **Otimizações:**

#### **Backend:**
```typescript
// Cache de 24 horas
const CACHE_DURATION = 1000 * 60 * 60 * 24;

// Buscar apenas 10 empresas por setor (depois filtrar top 5)
take: 10

// Não incluir statements (mais rápido)
includeStatements: false
```

#### **Frontend:**
```typescript
// Loading state com spinner
<Loader2 className="animate-spin" />

// Lazy loading de imagens (CompanyLogo)
// Estado local para expandir/recolher (sem re-fetch)
```

### **Métricas Alvo:**

| Métrica | Alvo | Atual |
|---------|------|-------|
| **First Contentful Paint** | < 1.5s | - |
| **Largest Contentful Paint** | < 2.5s | - |
| **Time to Interactive** | < 3.5s | - |
| **Cumulative Layout Shift** | < 0.1 | - |

---

## 🧪 Como Testar

### **Teste 1: SEO Básico**

1. Acesse `/analise-setorial` (sem login)
2. **Verificar:**
   - Título da página no navegador
   - Meta description (View Source)
   - H1 presente e único
   - Estrutura de headings (H2, H3)
3. **Resultado Esperado:** ✅ Tudo correto

---

### **Teste 2: Carregamento de Dados**

1. Abrir `/analise-setorial`
2. **Verificar:**
   - Loading state aparece
   - Dados carregam em < 5s
   - Setores ordenados por score médio
   - Top 5 empresas por setor
3. **Resultado Esperado:** ✅ Dados corretos e rápidos

---

### **Teste 3: Interatividade**

1. Clicar em "Ver Todas" em um setor
2. **Verificar:** Lista expande mostrando todas as 5 empresas
3. Clicar em uma empresa
4. **Verificar:** Redireciona para `/acao/[ticker]`
5. Clicar em "Comparar X Empresas do Setor"
6. **Verificar:** Redireciona para `/compara-acoes/[ticker1]/[ticker2]/...` com os tickers das empresas
7. **Resultado Esperado:** ✅ Todas as interações funcionam

---

### **Teste 4: Responsividade**

1. Redimensionar para mobile (< 640px)
2. **Verificar:**
   - Layout 1 coluna
   - Cards não quebram
   - Textos legíveis
3. Redimensionar para desktop
4. **Verificar:**
   - Layout 3 colunas nas stats
   - Hover effects funcionam
5. **Resultado Esperado:** ✅ Design responsivo

---

### **Teste 5: Cache**

1. Acesse `/analise-setorial` pela primeira vez
2. **Verificar logs:** "Calculando análise setorial..."
3. Recarregue a página (< 24h depois)
4. **Verificar logs:** "Retornando análise setorial do cache"
5. **Resultado Esperado:** ✅ Cache funciona

---

### **Teste 6: Integração Dashboard**

1. Login como usuário com **5+ rankings**
2. Acesse Dashboard
3. **Verificar:** Dica "🎯 Análise Setorial" aparece
4. Clique em "Ver Análise Setorial"
5. **Verificar:** Redireciona para `/analise-setorial`
6. **Resultado Esperado:** ✅ Integração completa

---

## 📊 Analytics (Futuro)

### **Eventos para Trackear:**

```typescript
// Google Analytics 4 / Posthog
trackEvent('sector_analysis_view', {
  sectors_loaded: 12,
  total_companies: 60,
  timestamp: new Date()
})

trackEvent('sector_expand', {
  sector_name: 'Bancos',
  companies_shown: 5
})

trackEvent('company_click', {
  ticker: 'ITUB4',
  sector: 'Bancos',
  score: 87,
  source: 'sector_analysis'
})

trackEvent('compare_sector_click', {
  sector: 'Bancos'
})
```

---

## 🔄 Fluxo Completo

```
Usuário no Dashboard (5+ rankings)
    ↓
Dica "Análise Setorial" aparece
    ↓
Clique em "Ver Análise Setorial"
    ↓
Redireciona para /analise-setorial
    ↓
Loading state (spinner)
    ↓
API /sector-analysis retorna dados (ou cache)
    ↓
Renderiza 12 setores + top 5 empresas cada
    ↓
Usuário expande setor "Bancos"
    ↓
Mostra todas as 5 empresas
    ↓
Clique em "ITUB4"
    ↓
Redireciona para /acao/itub4
    ↓
Análise completa da empresa ✅

OU

Clique em "Comparar 5 Empresas do Setor"
    ↓
Redireciona para /compara-acoes/ITUB4/BBDC4/BBAS3/SANB11/BPAC11
    ↓
Comparação lado a lado das empresas do setor ✅
```

---

## 🆕 Próximas Melhorias

### **Versão 2.0:**

1. **Filtros Avançados:**
   ```typescript
   - Filtrar por score mínimo
   - Filtrar por dividend yield
   - Filtrar por P/L máximo
   ```

2. **Comparação Interativa:**
   ```typescript
   - Checkbox para selecionar múltiplas empresas
   - Comparar até 6 empresas de setores diferentes
   ```

3. **Gráficos:**
   ```typescript
   - Gráfico de barras: Score por setor
   - Gráfico de pizza: Distribuição de setores
   - Gráfico de linha: Evolução histórica (Premium)
   ```

4. **Exportação:**
   ```typescript
   - Exportar para PDF
   - Exportar para Excel
   - Compartilhar via WhatsApp/Email
   ```

5. **Premium Features:**
   ```typescript
   - Análise de sub-setores (ex: Bancos → Bancos Médios)
   - Alertas de mudança de ranking
   - Histórico de 12 meses
   ```

---

## 📚 Arquivos Criados/Modificados

| Arquivo | Tipo | Mudança |
|---------|------|---------|
| **`/api/sector-analysis/route.ts`** | Novo | Endpoint de análise setorial |
| **`/analise-setorial/page.tsx`** | Novo | Página principal SEO |
| **`sector-analysis-client.tsx`** | Novo | Componente client-side |
| **`dashboard-tips.ts`** | Modificado | Atualizar link da dica |

**Total:** 3 novos arquivos, 1 modificado

---

## 🎓 Lições Aprendidas

### **1. SEO Estruturado**
- Hero section com H1 clara e keywords
- Conteúdo longo abaixo dos dados dinâmicos
- Internal linking para outras páginas

### **2. Performance com Cache**
- Cache de 24h é suficiente para dados fundamentalistas
- Score não muda dramaticamente em horas

### **3. UX Progressiva**
- Mostrar top 3 inicialmente (faster perceived performance)
- Expandir sob demanda (melhor mobile UX)

### **4. Integração com Dashboard**
- Dicas contextuais direcionam usuários para novos recursos
- Tracking de uso para personalização futura

---

**Data:** 2025-01-01  
**Versão:** 9.0 - Análise Setorial Multi-Setor  
**Status:** ✅ Produção  
**SEO:** ✅ Otimizado  
**Mobile:** ✅ Responsivo

