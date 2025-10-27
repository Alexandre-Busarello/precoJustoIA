# Correção: Detecção de Dividendos Manuais vs Automáticos

## 🐛 Problema Identificado

O sistema estava sugerindo dividendos que já haviam sido lançados manualmente pelo usuário, porque a lógica de comparação não considerava que:

1. **Transações Automáticas**: Têm valor por ação no campo `price`
2. **Transações Manuais**: Geralmente têm `price = null` ou `0`

### Exemplo do Problema

**Sugestão Gerada:**
```
Dividendo RBRR11: R$ 0.9000/ação × 15 ações = R$ 13.50 (Ex-date: 2025-06-11)
```

**Transação Manual Existente:**
```
17/06/2025 | Dividendo | RBRR11 | R$ 13.50 | price: null | Status: EXECUTADA
```

**Resultado:** Sistema não detectava a duplicata porque comparava `0.900000` vs `0.000000`

## ✅ Solução Implementada

### 1. Detecção de Tipo de Transação

```typescript
const isManual = perShareAmount === 0; // Manual entries typically don't have per-share amount
```

### 2. Comparação Inteligente

#### Para Transações Manuais
```typescript
if (existing.isManual) {
  // Compare total amounts with tolerance
  const totalAmountDiff = Math.abs(existing.amount - totalDividendAmount);
  const tolerance = Math.max(0.01, totalDividendAmount * 0.02); // 2% tolerance
  
  if (totalAmountDiff <= tolerance) {
    isMatch = true; // ✅ Detecta R$ 13.50 vs R$ 13.50
  }
}
```

#### Para Transações Automáticas
```typescript
else {
  // Compare per-share amounts with high precision
  const perShareDiff = Math.abs(existing.perShareAmount - dividend.amount);
  const tolerance = Math.max(0.0001, dividend.amount * 0.01); // 1% tolerance
  
  if (perShareDiff <= tolerance) {
    isMatch = true; // ✅ Detecta R$ 0.9000 vs R$ 0.9000
  }
}
```

### 3. Logs Detalhados

```typescript
// Para transações manuais
🔍 [DIVIDEND MATCH] Manual transaction found: R$ 13.50 vs suggested R$ 13.50 (diff: R$ 0.00)
⏩ [DIVIDEND SKIP] RBRR11 2025-06-17: Already processed (EXECUTED) - Manual entry (R$ 13.50 total)

// Para transações automáticas  
🔍 [DIVIDEND MATCH] Auto transaction found: R$ 0.9000/share vs suggested R$ 0.9000/share (diff: R$ 0.0000)
⏩ [DIVIDEND SKIP] RBRR11 2025-06-17: Already processed (CONFIRMED) - Auto entry (R$ 0.9000/share)
```

## 🎯 Cenários de Teste

### Cenário 1: Transação Manual Exata
```
Manual: R$ 13.50 total
Sugestão: R$ 0.90/ação × 15 ações = R$ 13.50
Resultado: ✅ BLOQUEADO (valores totais iguais)
```

### Cenário 2: Transação Manual com Pequena Diferença
```
Manual: R$ 13.48 total (usuário arredondou)
Sugestão: R$ 0.90/ação × 15 ações = R$ 13.50
Diferença: R$ 0.02 (dentro da tolerância de 2%)
Resultado: ✅ BLOQUEADO (considerado mesmo dividendo)
```

### Cenário 3: Transação Automática Prévia
```
Auto: R$ 0.9000/ação (price field preenchido)
Sugestão: R$ 0.9000/ação
Resultado: ✅ BLOQUEADO (valores por ação iguais)
```

### Cenário 4: Dividendos Diferentes no Mesmo Mês
```
Manual: R$ 13.50 (dividendo ordinário)
Sugestão: R$ 20.00 (dividendo extraordinário)
Resultado: ✅ PERMITIDO (valores diferentes)
```

## 📊 Melhorias nos Logs

### Resumo de Carregamento
```
🔍 [DIVIDEND DEDUP] Loaded 5 existing dividend transactions for deduplication
📊 [DIVIDEND SUMMARY] 3 manual + 2 auto transactions by ticker: RBRR11: 2, PETR4: 3
```

### Detecção de Matches
```
🔍 [DIVIDEND MATCH] Manual transaction found: R$ 13.50 vs suggested R$ 13.50 (diff: R$ 0.00)
⏩ [DIVIDEND SKIP] RBRR11 2025-06-17: Already processed (EXECUTED) - Manual entry (R$ 13.50 total)
```

## 🛡️ Tolerâncias Implementadas

### Para Transações Manuais
- **Tolerância**: 2% ou R$ 0,01 (o que for maior)
- **Motivo**: Usuários podem arredondar valores ou ter pequenas diferenças

### Para Transações Automáticas
- **Tolerância**: 1% ou R$ 0,0001 (o que for maior)
- **Motivo**: Valores automáticos são mais precisos, menor tolerância necessária

## ✅ Benefícios da Correção

1. **Precisão**: Detecta corretamente transações manuais e automáticas
2. **Flexibilidade**: Tolera pequenas diferenças de arredondamento
3. **Transparência**: Logs mostram exatamente por que uma sugestão foi bloqueada
4. **Robustez**: Funciona independente de como o usuário lançou a transação

A correção garante que o sistema nunca mais sugira dividendos já lançados, independente de terem sido inseridos manual ou automaticamente! 🎉