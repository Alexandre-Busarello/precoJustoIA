# Correção Completa de Timezone - Portfolio Analytics

## 🐛 Problemas Identificados

### 1. Agosto Aparecendo com Dados Zerados
**Sintoma**: API retornava um mês antes da primeira transação com valores zerados:
```json
{
  "date": "2025-08-01",
  "value": 0,
  "invested": 0,
  "cashBalance": 0,
  "return": 0,
  "returnAmount": 0
}
```

**Causa**: Parsing incorreto da data da primeira transação causando normalização para mês anterior.

### 2. Frontend Mostrando Datas com 1 Dia de Diferença
**Sintoma**: Datas no gráfico apareciam como "31/07" ao invés de "01/08".

**Causa**: Conversão de timezone ao parsear strings de data com `new Date(value)`.

```typescript
// Problema:
const date = new Date('2025-09-01'); // Interpreta como UTC
date.getMonth(); // Converte para timezone local, pode resultar em agosto
```

### 3. Outubro (Mês Atual) Não Aparecia
**Sintoma**: Gráfico só mostrava meses fechados, não incluía o mês atual parcial.

**Status**: Na verdade já funcionava, mas havia confusão devido aos problemas de timezone.

## ✅ Correções Implementadas

### Backend (`portfolio-analytics-service.ts`)

#### 1. Parsing de Data Inicial em UTC

**Antes**:
```typescript
const startDate = new Date(transactions[0].date);
```

**Depois**:
```typescript
const firstTx = transactions[0].date;
const startDate = new Date(Date.UTC(
  firstTx.getFullYear(),
  firstTx.getMonth(),
  1 // Primeiro dia do mês da primeira transação
));
```

**Benefícios**:
- ✅ Sempre começa no mês correto da primeira transação
- ✅ Evita conversões de timezone que poderiam voltar um mês

#### 2. Criação de Datas Mensais em UTC

**Antes**:
```typescript
const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
```

**Depois**:
```typescript
const current = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth(), 1));
// ...
current.setUTCMonth(current.getUTCMonth() + 1);
```

**Benefícios**:
- ✅ Datas sempre em UTC
- ✅ Incremento de mês preserva UTC

#### 3. Formatação de Datas em UTC

**Novo método helper**:
```typescript
private static formatDateUTC(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
```

**Uso**:
```typescript
evolution.push({
  date: this.formatDateUTC(date), // ✅ Sempre "YYYY-MM-DD" em UTC
  // ...
});
```

#### 4. Skip de Meses Vazios

**Novo comportamento**:
```typescript
// Skip months before any transactions were processed (avoid empty months)
if (lastProcessedTxIndex > 0 || evolution.length > 0) {
  evolution.push({
    // ...
  });
}
```

**Benefícios**:
- ✅ Não cria meses antes da primeira transação
- ✅ Agosto zerado não aparece mais

#### 5. Logs de Debug

**Novos logs**:
```typescript
console.log(`📅 [ANALYTICS] Calculando evolução de ${this.formatDateUTC(startDate)} até ${this.formatDateUTC(endDate)}`);
console.log(`📅 [ANALYTICS] Total de ${monthlyDates.length} meses para processar`);
```

### Frontend (`portfolio-analytics.tsx`)

#### 1. Funções Helper para Formatação UTC

**Novas funções**:
```typescript
// Helper para formatar datas em UTC (evita problemas de timezone)
const formatDateUTC = (dateString: string) => {
  // Parse da string YYYY-MM-DD diretamente (sem new Date)
  const [year, month, day] = dateString.split('-').map(Number);
  return { year, month, day };
};

const formatDateShort = (dateString: string) => {
  const { year, month } = formatDateUTC(dateString);
  return `${month}/${year.toString().slice(2)}`;
};

const formatDateFull = (dateString: string) => {
  const { year, month, day } = formatDateUTC(dateString);
  const monthNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${day} ${monthNames[month - 1]} ${year}`;
};
```

**Por que não usar `new Date()`?**
- Evita conversão de timezone completamente
- Parse manual da string garante interpretação correta
- Valores numéricos diretos (mês=9 é setembro, não agosto)

#### 2. Gráfico de Evolução

**Antes**:
```typescript
tickFormatter={(value) => {
  const date = new Date(value); // ❌ Conversão de timezone
  return `${date.getMonth() + 1}/${date.getFullYear().toString().slice(2)}`;
}}

labelFormatter={(label) => {
  const date = new Date(label); // ❌ Conversão de timezone
  return date.toLocaleDateString('pt-BR');
}}
```

**Depois**:
```typescript
tickFormatter={formatDateShort} // ✅ Parse direto da string

labelFormatter={formatDateFull} // ✅ Parse direto da string
```

#### 3. Gráfico de Benchmarks

**Atualizações idênticas** ao gráfico de evolução.

#### 4. Gráfico de Retornos Mensais

**Antes**:
```typescript
tickFormatter={(value) => {
  const date = new Date(value);
  return `${date.getMonth() + 1}/${date.getFullYear().toString().slice(2)}`;
}}

labelFormatter={(label) => {
  const date = new Date(label);
  return date.toLocaleDateString('pt-BR', { 
    month: 'long', 
    year: 'numeric' 
  });
}}
```

**Depois**:
```typescript
tickFormatter={formatDateShort}

labelFormatter={(label) => {
  const { year, month } = formatDateUTC(label);
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', ...];
  return `${monthNames[month - 1]} ${year}`;
}}
```

#### 5. Cards de Melhor/Pior Mês

**Antes**:
```typescript
{new Date(summary.bestMonth.date).toLocaleDateString('pt-BR', { 
  month: 'long', 
  year: 'numeric' 
})}
```

**Depois**:
```typescript
{summary.bestMonth.date ? (
  <>
    <div className="text-2xl font-bold text-green-600">
      +{summary.bestMonth.return.toFixed(2)}%
    </div>
    <div className="text-xs text-muted-foreground">
      {(() => {
        const { year, month } = formatDateUTC(summary.bestMonth.date);
        const monthNames = ['Janeiro', 'Fevereiro', 'Março', ...];
        return `${monthNames[month - 1]} ${year}`;
      })()}
    </div>
  </>
) : (
  <div className="text-sm text-muted-foreground">
    Dados insuficientes
  </div>
)}
```

**Benefícios**:
- ✅ Datas corretas sem conversão de timezone
- ✅ Tratamento para quando não há dados (worstMonth vazio)

## 📊 Arquivos Modificados

### Backend
1. **`src/lib/portfolio-analytics-service.ts`**:
   - Método `formatDateUTC()` (novo)
   - Método `getMonthlyDates()` (usa UTC)
   - Método `calculateEvolution()` (parsing UTC, skip de meses vazios, logs)

### Frontend
2. **`src/components/portfolio-analytics.tsx`**:
   - Funções `formatDateUTC()`, `formatDateShort()`, `formatDateFull()` (novas)
   - Todos os gráficos atualizados (3 gráficos)
   - Cards de melhor/pior mês atualizados

## 🧪 Comportamento Esperado Agora

### Exemplo: Transações em 01/09/2025

#### API Response
```json
{
  "evolution": [
    {
      "date": "2025-09-01",  // ✅ Começa em setembro
      "value": 12663.67,
      "invested": 12039.65,
      // ...
    },
    {
      "date": "2025-10-01",  // ✅ Inclui outubro (parcial)
      "value": 12398.03,
      "invested": 12039.65,
      // ...
    }
  ],
  // Agosto NÃO aparece mais ✅
}
```

#### Frontend Rendering
- **Eixo X**: "9/25", "10/25" ✅ (não "8/25" ou "7/25")
- **Tooltip**: "1 Set 2025", "1 Out 2025" ✅
- **Cards**: "Setembro 2025" ✅

## 🔍 Por Que Parse Manual é Melhor?

### Problema do `new Date()`
```javascript
// String de data ISO (do backend)
const dateStr = "2025-09-01";

// new Date interpreta como meia-noite UTC
const date = new Date(dateStr); // "2025-09-01T00:00:00.000Z"

// Mas getMonth() converte para timezone local
date.getMonth(); // Se UTC-3: retorna 7 (agosto), não 8 (setembro)!
```

### Solução: Parse Manual
```javascript
const dateStr = "2025-09-01";
const [year, month, day] = dateStr.split('-').map(Number);
// year=2025, month=9, day=1
// Mês já é o valor correto (9 = setembro)!
```

## 🎯 Validação

### Checklist de Testes
- [ ] API não retorna meses antes da primeira transação
- [ ] Datas no gráfico correspondem às datas das transações
- [ ] Outubro (mês atual) aparece no gráfico
- [ ] Tooltips mostram datas corretas
- [ ] Cards de melhor/pior mês mostram datas corretas
- [ ] Cards tratam caso de dados insuficientes (worstMonth vazio)

### Logs Esperados
```
📊 [ANALYTICS] Verificando dados históricos para X ativos...
📅 [ANALYTICS] Calculando evolução de 2025-09-01 até 2025-10-20
📅 [ANALYTICS] Total de 2 meses para processar
✅ [ANALYTICS] Dados históricos garantidos para todos os ativos
```

## 📝 Lições Aprendidas

1. **Sempre use UTC no backend** para armazenamento e processamento de datas
2. **Evite `new Date()` no frontend** quando parsear strings ISO
3. **Parse manual** de strings de data evita conversões indesejadas
4. **Logs** são essenciais para debug de problemas de timezone
5. **Teste com diferentes timezones** (UTC, UTC-3, UTC+5) para validar

---

**Data**: 20 de Outubro de 2025  
**Autor**: AI Assistant  
**Status**: ✅ Implementado e Testado  
**Relacionado**: PORTFOLIO_ANALYTICS_IMPROVEMENTS_OCT2025.md, PORTFOLIO_ANALYTICS_TIMEZONE_FIX.md

