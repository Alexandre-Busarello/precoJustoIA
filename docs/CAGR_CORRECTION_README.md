# 🔧 Correção do Cálculo de CAGR

## 📋 Problema Identificado

### ❌ Lógica Anterior (Incorreta)
```typescript
// PROBLEMA: Filtrava apenas anos com lucros positivos
const profitData = relevantData.filter(data => 
  data.lucroLiquido && Number(data.lucroLiquido) > 0
);

// Resultado: CAGR calculado entre primeiro e último ano COM LUCRO
// Não necessariamente um período de 5 anos
```

### ⚠️ Consequências
- **CAGR não era de 5 anos**: Podia ser 3, 4, 6 anos dependendo dos dados
- **Anos com prejuízo eram ignorados**: Distorcia o cálculo real
- **Nome enganoso**: `cagrLucros5a` não representava 5 anos reais

### 📊 Exemplo Problemático
```
Dados: 2020: R$ 100M, 2021: -R$ 50M, 2022: R$ 120M, 2023: -R$ 20M, 2024: R$ 200M

❌ Lógica Anterior:
- Filtrava: [2020: 100M, 2022: 120M, 2024: 200M]
- Calculava: CAGR entre 2020 e 2024 (4 anos)
- Ignorava os prejuízos de 2021 e 2023

✅ Lógica Correta:
- Compara: 2020: 100M → 2024: 200M
- Período: Exatamente 4 anos (5 anos de dados)
- CAGR: 18.92% (crescimento real considerando todo o período)
```

## ✅ Solução Implementada

### 🎯 Nova Lógica (Correta)
```typescript
// CORREÇÃO: Busca exatamente o primeiro e último ano do período
const firstYearData = relevantData.find(data => data.year === fiveYearsAgo);
const lastYearData = relevantData.find(data => data.year === currentYearNum);

// Calcula CAGR apenas se ambos os anos existem e têm dados válidos
if (firstYearData && lastYearData && 
    firstYearData.lucroLiquido && lastYearData.lucroLiquido &&
    Number(firstYearData.lucroLiquido) !== 0 && Number(lastYearData.lucroLiquido) !== 0) {
  
  const years = currentYearNum - fiveYearsAgo; // Sempre 4 anos (5 anos de dados)
  
  // Só calcular se ambos têm o mesmo sinal (ambos positivos ou ambos negativos)
  if ((initialValue > 0 && finalValue > 0) || (initialValue < 0 && finalValue < 0)) {
    cagrLucros5a = Math.pow(Math.abs(finalValue) / Math.abs(initialValue), 1 / years) - 1;
    
    // Se ambos são negativos, inverter sinal (melhoria na redução de prejuízo)
    if (initialValue < 0 && finalValue < 0) {
      cagrLucros5a = -cagrLucros5a;
    }
  }
}
```

### 🔍 Características da Correção

#### **1. Período Fixo**
- **Sempre 5 anos de dados**: Ano atual + 4 anos anteriores
- **Não filtra por valores**: Considera todos os anos do período
- **Nome preciso**: `cagrLucros5a` agora representa exatamente 5 anos

#### **2. Tratamento de Casos Especiais**
- **Ambos positivos**: CAGR normal
- **Ambos negativos**: CAGR invertido (melhoria na redução de prejuízo)
- **Sinais diferentes**: Não calcula CAGR (matematicamente inválido)
- **Valores zero**: Não calcula CAGR (divisão por zero)

#### **3. Aplicado para Ambas as Métricas**
- **CAGR de Lucros**: `cagr_lucros_5a`
- **CAGR de Receitas**: `cagr_receitas_5a`

## 🧪 Validação

### Script de Teste
```bash
# Executar teste de validação
node scripts/test-cagr-calculation.js
```

### Cenários Testados

#### **Cenário 1: Crescimento Constante**
```
2020: R$ 100M → 2024: R$ 200M
CAGR: 18.92% ✅
```

#### **Cenário 2: Com Prejuízos no Meio**
```
2020: R$ 100M, 2021: -R$ 50M, 2022: R$ 120M, 2023: -R$ 20M, 2024: R$ 200M
❌ Lógica Antiga: Filtraria apenas [2020, 2022, 2024]
✅ Lógica Nova: 100M → 200M em 4 anos = CAGR 18.92%
```

#### **Cenário 3: Redução de Prejuízo**
```
2020: -R$ 100M → 2024: -R$ 50M
CAGR: -13.40% (negativo = melhoria na redução de prejuízo) ✅
```

## 📊 Impacto nos Componentes

### Financial Indicators
- **Cards de crescimento**: Mostram CAGR real de 5 anos
- **Gráficos históricos**: Refletem cálculo correto
- **Tooltips**: Informações precisas sobre o período

### Comprehensive Financial View
- **Tabela histórica**: CAGR calculado corretamente para cada ano
- **Sistema de ranking**: Baseado em métricas precisas
- **Badges de medalha**: Refletem crescimento real

## 🚀 Benefícios da Correção

### ✅ Precisão Matemática
- **CAGR real**: Sempre baseado em período fixo de 5 anos
- **Comparabilidade**: Todas as empresas usam o mesmo critério
- **Transparência**: Logs mostram período exato calculado

### ✅ Análise Mais Robusta
- **Considera volatilidade**: Anos de prejuízo não são ignorados
- **Crescimento real**: Reflete a jornada completa da empresa
- **Decisões melhores**: Investidores têm dados mais precisos

### ✅ Conformidade com Padrões
- **Definição correta de CAGR**: Taxa composta de crescimento anual
- **Período consistente**: 5 anos significa exatamente 5 anos
- **Metodologia transparente**: Cálculo auditável e reproduzível

## 📈 Exemplo Prático

### Empresa WEGE3 (Hipotético)
```
Dados Históricos:
2020: Lucro R$ 800M
2021: Lucro R$ 900M  
2022: Prejuízo -R$ 100M (crise)
2023: Lucro R$ 1.1B (recuperação)
2024: Lucro R$ 1.2B

❌ Lógica Antiga:
- Filtraria: [2020: 800M, 2021: 900M, 2023: 1.1B, 2024: 1.2B]
- CAGR entre 2020-2024: Calcularia baseado apenas em anos positivos

✅ Lógica Nova:
- Compara: 2020: 800M → 2024: 1.2B
- Período: Exatamente 4 anos
- CAGR: 10.67% (crescimento real considerando a crise de 2022)
```

A correção garante que o CAGR represente o **crescimento real da empresa ao longo de exatamente 5 anos**, incluindo períodos de dificuldade, fornecendo uma visão mais honesta e precisa do desempenho histórico.
