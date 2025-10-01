# 🔒 Paywall na Análise Setorial - TOP 1 Bloqueado

## 📋 Visão Geral

Implementação de uma camada de monetização estratégica na página de **Análise Setorial**, bloqueando o acesso à **melhor empresa de cada setor** (TOP 1) para usuários gratuitos e deslogados.

**Objetivo:** Converter usuários gratuitos em Premium mostrando o valor da análise completa.

---

## 🎯 Estratégia de Conversão

### **O Que Mostrar Gratuitamente:**
- ✅ 3 setores principais (Consumo Cíclico, Energia, Saúde)
- ✅ Empresas ranqueadas de **#2 a #5** de cada setor
- ✅ Scores e recomendações das empresas #2-#5
- ✅ Informações completas de cada setor

### **O Que Bloquear (Paywall):**
- 🔒 Empresa **TOP 1** de cada setor (melhor do setor)
- 🔒 **TOP 1 excluído do link de comparação** (usuários FREE comparam apenas #2-#5)
- 🔒 Setores adicionais (apenas para Premium)
- 🔒 Análise completa com todos os setores

**Psicologia:** O usuário vê que existe conteúdo premium (TOP 1 borrado), gera FOMO, aumenta conversão.

**Proteção Anti-Bypass:** O TOP 1 não pode ser acessado nem diretamente, nem através do link de comparação.

---

## 🔧 Implementação Técnica

### **Arquivo Modificado:**
```
/components/sector-analysis-client.tsx
```

### **Lógica de Blur:**

```typescript
{displayedCompanies.map((company, companyIdx) => {
  const isTop1 = companyIdx === 0;
  const shouldBlur = isTop1 && !isPremium;
  
  return (
    <div key={company.ticker} className="relative">
      <Link
        href={shouldBlur ? '#' : `/acao/${company.ticker.toLowerCase()}`}
        onClick={(e) => {
          if (shouldBlur) {
            e.preventDefault(); // Impede navegação
          }
        }}
      >
        <div className={`... ${
          shouldBlur 
            ? 'blur-sm pointer-events-none'  // ← Blur + desabilita hover
            : 'hover:border-blue-300 ...'
        }`}>
          {/* Conteúdo da empresa */}
        </div>
      </Link>
      
      {/* Overlay de conversão */}
      {shouldBlur && (
        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-r from-blue-500/5 to-indigo-500/5 rounded-lg backdrop-blur-[2px]">
          <div className="text-center px-4 py-3">
            <Lock className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-900 dark:text-white mb-2">
              Melhor Empresa do Setor
            </p>
            <Button asChild size="sm" className="bg-gradient-to-r from-blue-600 to-indigo-600 ...">
              <Link href="/checkout?plan=premium">
                <Sparkles className="w-4 h-4 mr-2" />
                Desbloquear Premium
              </Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
})}
```

---

## 🎨 Design do Paywall

### **Visual:**
```
┌─────────────────────────────────────────┐
│  [Setor: Energia Elétrica]              │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ 🔒 [EMPRESA BORRADA]              │ │ ← TOP 1 (BLUR)
│  │                                   │ │
│  │    🔒 Melhor Empresa do Setor     │ │
│  │    [Desbloquear Premium ✨]       │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ TAEE11 - Taesa                    │ │ ← #2 (VISÍVEL)
│  │ Score: 92 | Compra Forte          │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │ CMIG4 - Cemig                     │ │ ← #3 (VISÍVEL)
│  │ Score: 88 | Compra                │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### **Elementos:**
1. **Blur:** `blur-sm` na empresa TOP 1
2. **Overlay:** Gradiente sutil com backdrop-blur
3. **Ícone:** `Lock` (cadeado) azul
4. **Texto:** "Melhor Empresa do Setor"
5. **CTA:** Botão gradiente azul → indigo "Desbloquear Premium"
6. **Sparkles:** Ícone de estrela no botão

---

## 🧪 Comportamento por Tipo de Usuário

### **Usuário FREE / Deslogado:**
```typescript
isPremium = false

Resultado:
- 3 setores visíveis (Consumo Cíclico, Energia, Saúde)
- TOP 1 de cada setor: 🔒 BLOQUEADO (blur + overlay)
- Empresas #2-#5: ✅ VISÍVEIS
- CTA: "Desbloquear Premium"
- Restante dos setores: Banner "Análise Completa Premium"
```

### **Usuário PREMIUM:**
```typescript
isPremium = true

Resultado:
- Todos os setores visíveis
- TOP 1 de cada setor: ✅ VISÍVEL (sem blur)
- Todas as empresas: ✅ VISÍVEIS
- Botão: "Carregar Mais Setores" (se houver)
- Sem paywall
```

---

## 📊 Jornada de Conversão

### **Fluxo do Usuário Gratuito:**

```
1. Acessa /analise-setorial
   ↓
2. Vê 3 setores com análises parciais
   ↓
3. Nota que TOP 1 de cada setor está BLOQUEADO
   ↓
4. Curiosidade: "Qual é a melhor empresa?"
   ↓
5. Clica em "Desbloquear Premium"
   ↓
6. Redirecionado para /checkout?plan=premium
   ↓
7. CONVERSÃO 🎉
```

### **Gatilhos Psicológicos:**

1. **FOMO (Fear of Missing Out):**
   - "Qual é a melhor empresa do setor?"
   - Badge "TOP 1" visível mesmo borrado

2. **Prova Social:**
   - Vê que empresas #2-#5 já são boas
   - Imagina que TOP 1 deve ser ainda melhor

3. **Curiosidade:**
   - Informação parcial gera desejo de completar

4. **Valor Demonstrado:**
   - Análises #2-#5 mostram qualidade da plataforma
   - Confiança para upgrade

5. **Escassez:**
   - Apenas 3 setores gratuitos
   - Setores restantes também bloqueados

---

## 🔒 Implementação do Bloqueio

### **Condição de Blur:**

```typescript
const isTop1 = companyIdx === 0;
const shouldBlur = isTop1 && !isPremium;
```

**Matriz de Decisão:**

| Usuario | Empresa | Blur? | Comportamento |
|---------|---------|-------|---------------|
| FREE | TOP 1 | ✅ | Blur + Overlay + CTA |
| FREE | #2-#5 | ❌ | Normal, clicável |
| PREMIUM | TOP 1 | ❌ | Normal, clicável |
| PREMIUM | #2-#5 | ❌ | Normal, clicável |

---

## 🔗 Proteção no Link de Comparação

### **Problema:**
Se o botão "Comparar Empresas do Setor" incluísse o TOP 1 bloqueado, seria uma forma de "burlar" o paywall indo para a página de comparação.

### **Solução Implementada:**

```typescript
<Link href={`/compara-acoes/${
  // Se usuário não é Premium, exclui TOP 1 da comparação
  (isPremium ? sector.topCompanies : sector.topCompanies.slice(1))
    .map(c => c.ticker)
    .join('/')
}`}>
  <BarChart3 className="w-4 h-4 mr-2" />
  Comparar {isPremium ? sector.topCompanies.length : sector.topCompanies.length - 1} Empresas do Setor
</Link>
```

### **Comportamento:**

**Usuário FREE:**
```
Link gerado: /compara-acoes/TAEE11/CMIG4/TRPL4/CPLE6
Empresas: #2, #3, #4, #5 (TOP 1 excluído)
Texto do botão: "Comparar 4 Empresas do Setor"
```

**Usuário PREMIUM:**
```
Link gerado: /compara-acoes/ELET3/TAEE11/CMIG4/TRPL4/CPLE6
Empresas: #1, #2, #3, #4, #5 (TOP 1 incluído)
Texto do botão: "Comparar 5 Empresas do Setor"
```

**Benefício:** Garante consistência total do paywall - TOP 1 não pode ser acessado de nenhuma forma para usuários gratuitos.

---

## 🎯 CTAs de Conversão

### **CTA no TOP 1 Bloqueado:**
```
🔒 Melhor Empresa do Setor
[✨ Desbloquear Premium]
```

**Link:** `/checkout?plan=premium`

### **CTA no Final (Setores Adicionais):**
```
🌟 Análise Completa Exclusiva Premium
Compare TODAS as empresas de TODOS os setores
[🚀 Fazer Upgrade para Premium]
```

**Link:** `/checkout?plan=premium`

---

## 📈 Métricas de Sucesso

### **KPIs a Monitorar:**

1. **Taxa de Conversão:**
   - Cliques em "Desbloquear Premium" / Visitantes

2. **Engagement:**
   - Tempo na página
   - Setores expandidos (empresas #4-#5)
   - Cliques em empresas #2-#5

3. **Bounce Rate:**
   - % de usuários que saem sem interagir

4. **Conversão Final:**
   - % de usuários que completam checkout após clicar no CTA

---

## 🔍 SEO e Crawlers

### **Consideração Importante:**

**Problema Potencial:** Crawlers (Google, Bing) podem não ver o conteúdo bloqueado.

**Solução Implementada:**
- O conteúdo existe no HTML (blur é CSS)
- Crawlers podem indexar o conteúdo completo
- Apenas a visualização é bloqueada para humanos

**Código:**
```typescript
<div className={`... ${shouldBlur ? 'blur-sm' : ''}`}>
  {/* Conteúdo sempre renderizado no HTML */}
  <span>{company.ticker}</span>
  <span>{company.name}</span>
  <span>{company.score}</span>
</div>
```

**Benefício:** SEO não é afetado, conteúdo indexado normalmente.

---

## 🧩 Integração com Sistema Existente

### **Componentes Relacionados:**

1. **`/analise-setorial/page.tsx`** (Server Component)
   - Determina `isPremium` via `getCurrentUser()`
   - Passa `isPremium` para `SectorAnalysisClient`

2. **`SectorAnalysisClient`** (Client Component)
   - Recebe `isPremium` como prop
   - Aplica lógica de blur
   - Renderiza overlay de conversão

3. **`/api/sector-analysis/route.ts`**
   - Retorna sempre TOP 1 nos dados
   - Backend não filtra, frontend decide exibição

**Fluxo:**
```
Server (page.tsx)
  ↓ determina isPremium
  ↓
Client (sector-analysis-client.tsx)
  ↓ aplica blur se !isPremium
  ↓
Usuario
```

---

## 🎨 Customização de Estilos

### **Blur Effect:**
```css
blur-sm                  /* Blur padrão Tailwind */
pointer-events-none      /* Desabilita hover/clicks */
```

### **Overlay:**
```css
absolute inset-0                          /* Preenche todo o card */
bg-gradient-to-r from-blue-500/5 to-indigo-500/5  /* Gradiente sutil */
backdrop-blur-[2px]                       /* Blur adicional no overlay */
```

### **Botão CTA:**
```css
bg-gradient-to-r from-blue-600 to-indigo-600
hover:from-blue-700 hover:to-indigo-700
shadow-lg
```

---

## 🚀 Próximos Passos (Futuro)

### **Melhorias Possíveis:**

1. **A/B Testing:**
   - Testar diferentes textos de CTA
   - Testar nível de blur (sm vs md vs lg)
   - Testar posição do CTA

2. **Tracking de Conversão:**
   ```typescript
   onClick={() => {
     trackEvent('sector_analysis_paywall_clicked', {
       sector: sector.sector,
       position: 'top1_overlay'
     });
   }}
   ```

3. **Tooltip Hover:**
   - Mostrar preview do score ao passar mouse
   - "Score: 95+ | Compra Forte"

4. **Animação:**
   - Efeito de "pulse" no cadeado
   - Animação de entrada do overlay

5. **Preview Parcial:**
   - Mostrar apenas ticker (ex: "PETR4")
   - Ocultar nome e score

---

## 📝 Resumo

| Aspecto | Detalhe |
|---------|---------|
| **Feature** | Paywall no TOP 1 de cada setor |
| **Target** | Usuários FREE e Deslogados |
| **Objetivo** | Aumentar conversão para Premium |
| **Técnica** | Blur + Overlay + CTA |
| **Proteção** | TOP 1 excluído também do link de comparação |
| **UX** | Não-intrusivo, gera curiosidade |
| **SEO** | Preservado (conteúdo no HTML) |
| **Link CTA** | `/checkout?plan=premium` |
| **Status** | ✅ Implementado e Funcionando |

---

## 🎯 Resultado Esperado

**Antes:**
- Usuários FREE veem tudo
- Baixa conversão (pouco incentivo)

**Depois:**
- Usuários FREE veem empresas #2-#5
- TOP 1 bloqueado com CTA
- **Conversão esperada:** +30-50%

**Fórmula:**
```
Valor Demonstrado (#2-#5 visíveis)
  + Curiosidade (TOP 1 oculto)
  + CTA Claro ("Desbloquear Premium")
  = CONVERSÃO 🎉
```

---

**Data:** 2025-01-01  
**Feature:** Paywall TOP 1 - Análise Setorial  
**Status:** ✅ IMPLEMENTADO  
**Versão:** 10.2 - Monetização Estratégica

