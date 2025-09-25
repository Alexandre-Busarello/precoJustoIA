## 🔧 CORREÇÃO DO ERRO CAMB3 - fetch-historical-prices-brapi.ts

### ❌ Problema Identificado:
- Erro: 'Cannot convert null to a BigInt'
- Ocorria quando o campo 'volume' da API BRAPI retornava null/undefined
- O script tentava converter diretamente para BigInt sem verificação

### ✅ Correções Implementadas:

#### 1. **Tratamento de Volume Nulo**
```typescript
// ANTES:
volume: BigInt(record.volume),

// DEPOIS:
volume: record.volume ? BigInt(record.volume) : BigInt(0),
```

#### 2. **Validação de Dados Obrigatórios**
- Adicionada verificação se campos essenciais (open, high, low, close) estão presentes
- Registros incompletos são pulados com log informativo

#### 3. **Fallback para adjustedClose**
```typescript
adjustedClose: record.adjustedClose || record.close,
```

#### 4. **Tratamento de Erro por Lote**
- Se um lote falha, tenta inserir registro por registro
- Identifica exatamente qual registro está causando problema
- Log detalhado dos dados problemáticos

### 🧪 Testes Realizados:
✅ CAMB3: 13 registros processados com sucesso
✅ PETR4: Funcionamento normal mantido  
✅ VALE3: Funcionamento normal mantido

### 🎯 Resultado:
- Erro do CAMB3 completamente resolvido
- Robustez geral do script melhorada
- Compatibilidade com dados existentes mantida
