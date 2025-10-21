# 🐛 Debug: Dados Divergentes entre Metrics e Analytics

**Data**: 21 de Outubro de 2025  
**Problema**: Carteira ETF/BDR com dados inconsistentes

---

## 🔍 **Problemas Relatados**

### 1️⃣ **Drawdown Divergente**
- **Metrics**: Mostra 7.68%
- **Analytics**: Gráfico vazio (como se não tivesse drawdown)

### 2️⃣ **Retornos Mensais vs Retorno Total**
- **Setembro**: +1.02%
- **Outubro**: +13.33%
- **Acumulado esperado**: ~14.5% (1.0102 * 1.1333 - 1)
- **Retorno total mostrado**: 4.20% ❌

**Matemática não bate!**

---

## 🧪 **Logs de Debug Adicionados**

Adicionei logs detalhados para diagnosticar:

### 1. **Evolution completo** (com todos os campos):
```javascript
📊 [MONTHLY RETURNS] Evolution completo: {
  date, value, invested, cashBalance, return, returnAmount
}
```

### 2. **Drawdown calculation**:
```javascript
📉 [DRAWDOWN] Evolution values: 2025-09-01: R$ XXX, 2025-10-01: R$ YYY
📉 [DRAWDOWN] Pico inicial: R$ XXX
```

---

## 📋 **O Que Fazer Agora**

1. **Limpe o cache**:
```javascript
localStorage.clear()
```

2. **Recarregue** a página de Analytics da carteira ETF/BDR

3. **Abra o Console** (F12)

4. **Copie TODOS os logs** que contêm:
   - `📊 [MONTHLY RETURNS] Evolution completo`
   - `📉 [DRAWDOWN] Evolution values`
   - `📅 [MONTHLY RETURNS]` (cada mês)

5. **Envie os logs** para análise

---

## 🎯 **Hipóteses do Problema**

### Hipótese 1: **Pontos de Evolution Errados**
Se o evolution tiver valores incorretos, tanto o drawdown quanto os retornos mensais estarão errados.

**Possíveis causas**:
- Transações processadas incorretamente
- Preços históricos incorretos
- Cálculo de `invested` ou `cashBalance` errado

### Hipótese 2: **Lógica de Retornos Mensais Errada**
O cálculo de retornos mensais pode estar usando a fórmula errada.

**Exemplo do problema**:
```typescript
// Se evolution tem 3 pontos:
[
  { date: '2025-09-01', value: 100, return: 0 },
  { date: '2025-10-01', value: 101, return: 1 },  // +1%
  { date: '2025-10-20', value: 114.47, return: 14.47 }  // +14.47% total
]

// Retornos mensais CORRETOS:
- Setembro: (101 - 100) / 100 = +1%
- Outubro: (114.47 - 101) / 101 = +13.33%

// Mas se a lógica estiver usando "return" acumulado:
- Setembro: 1% (errado, deveria ser 0% ou algum valor intermediário)
- Outubro: 14.47% - 1% = 13.47% (próximo mas não exato)
```

### Hipótese 3: **Drawdown Usando Evolution Incompleto**
Se o drawdown está calculando apenas com pontos de "início do mês", ele não vê as quedas no meio do mês.

**Exemplo**:
```typescript
// Evolution com apenas início dos meses:
[
  { date: '2025-09-01', value: 100 },
  { date: '2025-10-01', value: 110 }  // Sempre crescendo, sem drawdown!
]

// Mas se houvesse ponto intermediário:
[
  { date: '2025-09-01', value: 100 },
  { date: '2025-09-15', value: 92.32 },  // -7.68% drawdown!
  { date: '2025-10-01', value: 110 }
]
```

---

## ✅ **Próximos Passos (Após Análise dos Logs)**

### Se Hipótese 1 for verdadeira:
Corrigir o `calculateEvolution` para:
- Processar transações corretamente
- Usar preços corretos
- Calcular `invested` e `cashBalance` corretamente

### Se Hipótese 2 for verdadeira:
Corrigir o `calculateMonthlyReturns` para usar:
```typescript
// Para mês completo (não o último):
monthReturn = (nextValue - currentValue) / currentValue * 100

// Para último mês (parcial):
monthReturn = (currentValue - prevValue) / prevValue * 100
```

### Se Hipótese 3 for verdadeira:
Garantir que o drawdown use TODOS os pontos de evolution, incluindo pontos intermediários no mês.

---

## 📊 **Formato dos Logs Esperados**

### Evolution completo:
```json
📊 [MONTHLY RETURNS] Evolution completo: [
  {
    "date": "2025-09-01",
    "value": "4085.07",
    "invested": "4085.07",
    "cashBalance": "0.00",
    "return": "0.00%",
    "returnAmount": "0.00"
  },
  {
    "date": "2025-10-01",
    "value": "4126.75",
    "invested": "4085.07",
    "cashBalance": "0.00",
    "return": "1.02%",
    "returnAmount": "41.68"
  },
  {
    "date": "2025-10-20",
    "value": "4256.83",
    "invested": "4085.07",
    "cashBalance": "0.00",
    "return": "4.20%",
    "returnAmount": "171.76"
  }
]
```

### Retornos mensais calculados:
```
📅 [MONTHLY RETURNS] 2025-09: 1.02% (4085.07 → 4126.75)
📅 [MONTHLY RETURNS] 2025-10: 13.33% (4126.75 → 4256.83, parcial até hoje)
```

### Drawdown:
```
📉 [DRAWDOWN] Evolution values: 2025-09-01: R$ 4085.07, 2025-10-01: R$ 4126.75, 2025-10-20: R$ 4256.83
📉 [DRAWDOWN] Pico inicial: R$ 4085.07 em 2025-09-01
```

---

**Com esses logs, poderei identificar exatamente onde está o erro!** 🎯

