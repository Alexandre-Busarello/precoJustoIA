# Sistema de Múltiplos Dividendos por Mês

## 🎯 Problema Resolvido

Anteriormente, o sistema não conseguia diferenciar múltiplos dividendos pagos pela mesma empresa no mesmo mês. Isso causava problemas quando empresas pagavam:

- **Dividendos Ordinários** + **Dividendos Extraordinários**
- **Dividendos** + **Juros sobre Capital Próprio (JCP)**
- **Múltiplos pagamentos** em datas diferentes do mesmo mês

## 🔧 Solução Implementada

### Chave de Identificação Aprimorada

**Antes:**
```typescript
const key = `${ticker}_${year}_${month}`;
// Exemplo: "PETR4_2025_0" (janeiro 2025)
```

**Agora:**
```typescript
const key = `${ticker}_${year}_${month}_${dividendAmount.toFixed(6)}`;
// Exemplo: "PETR4_2025_0_0.150000" e "PETR4_2025_0_0.200000"
```

### Exemplo Prático: PETR4 em Janeiro 2025

#### Cenário: Empresa paga 2 dividendos no mesmo mês

| Data | Tipo | Valor/Ação | Chave Gerada |
|------|------|------------|--------------|
| 15/01/2025 | Dividendo Ordinário | R$ 0,15 | `PETR4_2025_0_0.150000` |
| 25/01/2025 | Dividendo Extraordinário | R$ 0,20 | `PETR4_2025_0_0.200000` |

#### Comportamento do Sistema

```typescript
// Usuário possui 1000 ações de PETR4

// 1º Dividendo (R$ 0,15/ação)
✅ SUGERIDO: R$ 150,00 (1000 × R$ 0,15)
👤 USUÁRIO: Confirma

// 2º Dividendo (R$ 0,20/ação) 
✅ SUGERIDO: R$ 200,00 (1000 × R$ 0,20)
👤 USUÁRIO: Confirma

// Tentativa de sugerir novamente o 1º dividendo
❌ BLOQUEADO: "Already processed (CONFIRMED)"

// Tentativa de sugerir novamente o 2º dividendo  
❌ BLOQUEADO: "Already processed (CONFIRMED)"
```

## 📊 Logs Detalhados

### Carregamento de Transações Existentes
```
🔍 [DIVIDEND DEDUP] Loaded 2 existing dividend transactions for deduplication
📊 [DIVIDEND SUMMARY] Existing dividends by ticker: PETR4: 2
```

### Processamento de Sugestões
```
💵 [DIVIDEND SUGGESTED] PETR4: 1000 shares × R$ 0.1500 = R$ 150.00 (Ex-date: 2025-01-10, Payment: 2025-01-15)
⏩ [DIVIDEND SKIP] PETR4 2025-01-15: Already processed (CONFIRMED) (R$ 0.1500/share)
💵 [DIVIDEND SUGGESTED] PETR4: 1000 shares × R$ 0.2000 = R$ 200.00 (Ex-date: 2025-01-20, Payment: 2025-01-25)
```

## 🎯 Benefícios

### ✅ Para o Usuário
- **Precisão**: Cada dividendo é tratado individualmente
- **Transparência**: Logs mostram valor exato por ação
- **Controle**: Pode aceitar/rejeitar cada dividendo separadamente
- **Sem Duplicatas**: Nunca vê o mesmo dividendo duas vezes

### ✅ Para o Sistema
- **Robustez**: Suporta cenários complexos de pagamento
- **Performance**: Lookup O(1) por chave única
- **Debugging**: Logs detalhados para troubleshooting
- **Escalabilidade**: Funciona com qualquer quantidade de dividendos

## 🔄 Casos de Uso Suportados

### 1. Dividendos Múltiplos no Mesmo Mês
```
VALE3 - Janeiro 2025:
- 10/01: R$ 0,50 (Dividendo Regular)
- 20/01: R$ 1,00 (Dividendo Extraordinário)
- 30/01: R$ 0,25 (JCP)
```

### 2. Rejeição Seletiva
```
ITUB4 - Fevereiro 2025:
- Dividendo 1: R$ 0,30 → USUÁRIO CONFIRMA ✅
- Dividendo 2: R$ 0,15 → USUÁRIO REJEITA ❌
- Dividendo 3: R$ 0,45 → USUÁRIO CONFIRMA ✅

Resultado: Apenas dividendos 1 e 3 são processados
```

### 3. Valores Similares mas Diferentes
```
BBDC4 - Março 2025:
- 05/03: R$ 0,1500 (Dividendo)
- 15/03: R$ 0,1501 (Dividendo Ajustado)

Sistema trata como dividendos diferentes devido à precisão de 6 casas decimais
```

## 🛡️ Proteções Implementadas

1. **Precisão Decimal**: 6 casas decimais evitam conflitos por arredondamento
2. **Status Tracking**: Respeita PENDING, CONFIRMED, EXECUTED, REJECTED
3. **Date Validation**: Verifica ex-date e payment-date
4. **Holdings Verification**: Confirma posição na data ex-dividendo
5. **Duplicate Prevention**: Chave única por ticker+mês+valor

A implementação garante que o sistema seja robusto e preciso, suportando todos os cenários reais de pagamento de dividendos no mercado brasileiro.