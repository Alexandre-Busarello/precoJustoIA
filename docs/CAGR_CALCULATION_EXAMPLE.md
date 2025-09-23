# 📈 Cálculo de CAGR e Crescimento de Lucros - Exemplo Prático

## 🎯 Objetivo

Demonstrar como o script calcula automaticamente o CAGR (Compound Annual Growth Rate) e o crescimento de lucros baseado nos dados históricos da tabela `financial_data`.

## 📊 Exemplo: Empresa WEGE3

### Dados Históricos (Lucro Líquido)
```
Ano    | Lucro Líquido (R$ milhões)
-------|---------------------------
2020   | 2.500
2021   | 2.800
2022   | 3.200
2023   | 3.600
2024   | 3.900
```

### 🧮 Cálculo do CAGR (5 anos)

**Fórmula**: `CAGR = (Valor Final / Valor Inicial)^(1/anos) - 1`

```javascript
const initialValue = 2500; // 2020
const finalValue = 3900;   // 2024
const years = 4;           // 2024 - 2020

const cagr = Math.pow(finalValue / initialValue, 1 / years) - 1;
// cagr = (3900 / 2500)^(1/4) - 1
// cagr = 1.56^0.25 - 1
// cagr = 1.1175 - 1
// cagr = 0.1175 = 11.75%
```

### 📊 Cálculo do Crescimento Anual

**Fórmula**: `Crescimento = (Valor Atual - Valor Anterior) / |Valor Anterior|`

```javascript
const lastYear = 3900;     // 2024
const previousYear = 3600; // 2023

const growth = (lastYear - previousYear) / Math.abs(previousYear);
// growth = (3900 - 3600) / 3600
// growth = 300 / 3600
// growth = 0.0833 = 8.33%
```

## 🔍 Lógica do Script

### 1. Busca Dados Históricos
```sql
SELECT year, lucroLiquido 
FROM financial_data 
WHERE companyId = ? 
  AND year >= (CURRENT_YEAR - 5)
  AND lucroLiquido IS NOT NULL
ORDER BY year ASC
```

### 2. Filtra Lucros Positivos (CAGR)
- **Problema**: CAGR não funciona com valores negativos
- **Solução**: Usar apenas anos com lucro positivo
- **Exemplo**: Se 2021 teve prejuízo, CAGR seria 2020→2022→2023→2024

### 3. Calcula Métricas
```javascript
// CAGR: Apenas se temos 2+ anos de lucros positivos
if (profitableYears.length >= 2) {
  const firstYear = profitableYears[0];
  const lastYear = profitableYears[profitableYears.length - 1];
  const years = lastYear.year - firstYear.year;
  
  if (years > 0) {
    cagrLucros5a = Math.pow(
      Number(lastYear.lucroLiquido) / Number(firstYear.lucroLiquido), 
      1 / years
    ) - 1;
  }
}

// Crescimento: Último ano vs penúltimo (pode ser negativo)
if (historicalData.length >= 2) {
  const lastYear = historicalData[historicalData.length - 1];
  const previousYear = historicalData[historicalData.length - 2];
  
  crescimentoLucros = (
    Number(lastYear.lucroLiquido) - Number(previousYear.lucroLiquido)
  ) / Math.abs(Number(previousYear.lucroLiquido));
}
```

## 📋 Cenários Especiais

### Cenário 1: Empresa com Prejuízo
```
2020: R$ 1.000 (lucro)
2021: -R$ 500 (prejuízo)
2022: R$ 1.200 (lucro)
2023: R$ 1.400 (lucro)
2024: R$ 1.600 (lucro)
```

**Resultado**:
- **CAGR**: Baseado em 2020→2022→2023→2024 (ignora 2021)
- **Crescimento**: 2023→2024 = (1600-1400)/1400 = 14.29%

### Cenário 2: Dados Insuficientes
```
2024: R$ 1.000 (único ano disponível)
```

**Resultado**:
- **CAGR**: `null` (precisa de pelo menos 2 anos)
- **Crescimento**: `null` (precisa de pelo menos 2 anos)

### Cenário 3: Recuperação de Prejuízo
```
2023: -R$ 200 (prejuízo)
2024: R$ 300 (lucro)
```

**Resultado**:
- **CAGR**: `null` (não há 2 anos de lucros positivos)
- **Crescimento**: (300 - (-200)) / 200 = 250% (recuperação)

## 🎯 Vantagens da Abordagem

### ✅ **Dados Reais**
- Baseado em dados históricos já validados
- Não depende de estimativas externas
- Consistente com outras análises do sistema

### ✅ **Flexibilidade**
- Funciona com qualquer quantidade de anos disponíveis
- Trata casos especiais (prejuízos, dados faltantes)
- Calcula automaticamente o período disponível

### ✅ **Precisão**
- CAGR considera apenas lucros positivos (matematicamente correto)
- Crescimento considera todos os cenários (incluindo recuperações)
- Logs detalhados para auditoria

## 📊 Exemplo de Log

```
📊 Calculando métricas de crescimento histórico...
📈 CAGR Lucros: 11.75% (4 anos: 2020-2024)
📊 Crescimento Lucros: 8.33% (2023 → 2024)
✅ WEGE3: P/L=24.3, ROE=28.90%, DY=2.20%, CAGR=11.75%, Cresc=8.33%
```

## 🔮 Integração com Estratégias

Essas métricas podem ser usadas em:

1. **Filtros de Qualidade**: Empresas com CAGR > 15%
2. **Ranking**: Priorizar empresas com crescimento consistente
3. **Alertas**: Detectar mudanças bruscas no crescimento
4. **Comparações**: Benchmarking entre setores

---

**Implementado em**: `fetch-data-fundamentus.ts`  
**Função**: `calculateHistoricalGrowthMetrics()`  
**Campos**: `cagrLucros5a`, `crescimentoLucros`
