# Documentação: Filtros de Qualidade para Índices IPJ

Este documento detalha todos os filtros disponíveis para configuração de qualidade em índices Preço Justo (IPJ).

## Estrutura do Config

```json
{
  "universe": "B3",
  "assetTypes": ["STOCK"],
  "excludedTickers": ["SOND5", "PETR6"],
  "excludedTickerPatterns": ["*5", "*6"],
  "quality": {
    // Filtros básicos de indicadores financeiros
    "roe": { "gte": 0.10 },
    "margemLiquida": { "gte": 0.05 },
    "dividaLiquidaEbitda": { "lte": 3.0 },
    "payout": { "lte": 0.30 },
    "overallScore": { "gte": 50 },
    
    // Seleção por estratégia específica
    "strategy": {
      "type": "graham",
      "params": {}
    }
  }
}
```

## Configuração de Universo e Tipos de Ativos

### `universe`
- **Descrição**: Define o universo de busca (atualmente apenas "B3" é suportado)
- **Formato**: String
- **Exemplo**: `"universe": "B3"`

### `assetTypes`
- **Descrição**: Define quais tipos de ativos são permitidos no índice
- **Formato**: Array de strings
- **Valores possíveis**: `"STOCK"`, `"BDR"`, `"ETF"`, `"FII"`, `"INDEX"`, `"OTHER"`
- **Exemplos**:
  - `"assetTypes": ["STOCK"]` - Apenas ações B3 (padrão quando universe é "B3")
  - `"assetTypes": ["BDR"]` - Apenas BDRs
  - `"assetTypes": ["STOCK", "BDR"]` - Ações B3 e BDRs
- **Nota**: Se `assetTypes` não for especificado e `universe` for "B3", o padrão é `["STOCK"]`

## Operadores Disponíveis

Todos os filtros numéricos suportam os seguintes operadores:

- `gte`: Greater Than or Equal (maior ou igual) - Ex: `{ "gte": 0.10 }` = >= 10%
- `lte`: Less Than or Equal (menor ou igual) - Ex: `{ "lte": 3.0 }` = <= 3.0x
- `gt`: Greater Than (maior que) - Ex: `{ "gt": 0.05 }` = > 5%
- `lt`: Less Than (menor que) - Ex: `{ "lt": 15.0 }` = < 15.0
- `equals`: Igual a - Ex: `{ "equals": 0.12 }` = = 12%

Você pode combinar operadores:
```json
{
  "roe": { "gte": 0.10, "lte": 0.50 }  // ROE entre 10% e 50%
}
```

## Filtros Disponíveis

### 1. Indicadores de Rentabilidade

#### `roe` (Return on Equity - Retorno sobre Patrimônio Líquido)
- **Descrição**: Mede a rentabilidade do patrimônio líquido da empresa
- **Fonte**: `FinancialData.roe`
- **Formato**: Decimal (ex: 0.15 = 15%)
- **Exemplo**: `{ "roe": { "gte": 0.15 } }` - ROE >= 15%

#### `roic` (Return on Invested Capital - Retorno sobre Capital Investido)
- **Descrição**: Mede a eficiência do uso do capital investido
- **Fonte**: `FinancialData.roic`
- **Formato**: Decimal (ex: 0.12 = 12%)
- **Exemplo**: `{ "roic": { "gte": 0.12 } }` - ROIC >= 12%

#### `roa` (Return on Assets - Retorno sobre Ativos)
- **Descrição**: Mede a rentabilidade dos ativos da empresa
- **Fonte**: `FinancialData.roa`
- **Formato**: Decimal (ex: 0.08 = 8%)
- **Exemplo**: `{ "roa": { "gte": 0.08 } }` - ROA >= 8%

### 2. Indicadores de Margem

#### `margemLiquida` (Margem Líquida)
- **Descrição**: Percentual do lucro líquido sobre a receita total
- **Fonte**: `FinancialData.margemLiquida`
- **Formato**: Decimal (ex: 0.10 = 10%)
- **Exemplo**: `{ "margemLiquida": { "gte": 0.10 } }` - Margem Líquida >= 10%

#### `margemEbitda` (Margem EBITDA)
- **Descrição**: Percentual do EBITDA sobre a receita total
- **Fonte**: `FinancialData.margemEbitda`
- **Formato**: Decimal (ex: 0.20 = 20%)
- **Exemplo**: `{ "margemEbitda": { "gte": 0.20 } }` - Margem EBITDA >= 20%

#### `margemBruta` (Margem Bruta)
- **Descrição**: Percentual do lucro bruto sobre a receita total
- **Fonte**: `FinancialData.margemBruta`
- **Formato**: Decimal (ex: 0.30 = 30%)
- **Exemplo**: `{ "margemBruta": { "gte": 0.30 } }` - Margem Bruta >= 30%

### 3. Indicadores de Endividamento

#### `dividaLiquidaEbitda` (Dívida Líquida / EBITDA)
- **Descrição**: Razão entre dívida líquida e EBITDA (capacidade de pagamento)
- **Fonte**: `FinancialData.dividaLiquidaEbitda`
- **Formato**: Decimal (ex: 3.0 = 3x)
- **Exemplo**: `{ "dividaLiquidaEbitda": { "lte": 3.0 } }` - Dívida/EBITDA <= 3x

#### `dividaLiquidaPl` (Dívida Líquida / Patrimônio Líquido)
- **Descrição**: Razão entre dívida líquida e patrimônio líquido
- **Fonte**: `FinancialData.dividaLiquidaPl`
- **Formato**: Decimal (ex: 1.5 = 1.5x)
- **Exemplo**: `{ "dividaLiquidaPl": { "lte": 1.5 } }` - Dívida/PL <= 1.5x

#### `passivoAtivos` (Passivo / Ativos)
- **Descrição**: Percentual de endividamento sobre os ativos
- **Fonte**: `FinancialData.passivoAtivos`
- **Formato**: Decimal (ex: 0.60 = 60%)
- **Exemplo**: `{ "passivoAtivos": { "lte": 0.60 } }` - Passivo/Ativos <= 60%

#### `debtToEquity` (Dívida / Patrimônio)
- **Descrição**: Razão entre dívida total e patrimônio líquido
- **Fonte**: `FinancialData.debtToEquity`
- **Formato**: Decimal (ex: 1.0 = 1x)
- **Exemplo**: `{ "debtToEquity": { "lte": 1.0 } }` - Dívida/Patrimônio <= 1x

### 4. Indicadores de Liquidez

#### `liquidezCorrente` (Liquidez Corrente)
- **Descrição**: Razão entre ativo circulante e passivo circulante
- **Fonte**: `FinancialData.liquidezCorrente`
- **Formato**: Decimal (ex: 1.5 = 1.5x)
- **Exemplo**: `{ "liquidezCorrente": { "gte": 1.0 } }` - Liquidez Corrente >= 1.0x

#### `liquidezRapida` (Liquidez Rápida)
- **Descrição**: Razão entre ativo circulante (sem estoques) e passivo circulante
- **Fonte**: `FinancialData.liquidezRapida`
- **Formato**: Decimal (ex: 1.0 = 1.0x)
- **Exemplo**: `{ "liquidezRapida": { "gte": 1.0 } }` - Liquidez Rápida >= 1.0x

### 5. Indicadores de Valuation

#### `pl` (P/L - Preço sobre Lucro)
- **Descrição**: Razão entre preço da ação e lucro por ação
- **Fonte**: `FinancialData.pl`
- **Formato**: Decimal (ex: 15.0 = P/L)
- **Exemplo**: `{ "pl": { "lte": 15.0 } }` - P/L <= 15

#### `pvp` (P/VP - Preço sobre Valor Patrimonial)
- **Descrição**: Razão entre preço da ação e valor patrimonial por ação
- **Fonte**: `FinancialData.pvp`
- **Formato**: Decimal (ex: 1.5 = 1.5x)
- **Exemplo**: `{ "pvp": { "lte": 1.5 } }` - P/VP <= 1.5x

#### `evEbitda` (EV/EBITDA)
- **Descrição**: Razão entre Enterprise Value e EBITDA
- **Fonte**: `FinancialData.evEbitda`
- **Formato**: Decimal (ex: 8.0 = 8x)
- **Exemplo**: `{ "evEbitda": { "lte": 8.0 } }` - EV/EBITDA <= 8x

#### `psr` (P/S - Preço sobre Receita)
- **Descrição**: Razão entre preço da ação e receita por ação
- **Fonte**: `FinancialData.psr`
- **Formato**: Decimal (ex: 2.0 = 2x)
- **Exemplo**: `{ "psr": { "lte": 2.0 } }` - P/S <= 2x

#### `earningsYield` (Earnings Yield - Rendimento do Lucro)
- **Descrição**: Inverso do P/L (Lucro/Preço)
- **Fonte**: `FinancialData.earningsYield`
- **Formato**: Decimal (ex: 0.10 = 10%)
- **Exemplo**: `{ "earningsYield": { "gte": 0.10 } }` - Earnings Yield >= 10%

### 6. Indicadores de Dividendos

#### `dy` (Dividend Yield - Rendimento de Dividendos)
- **Descrição**: Percentual de dividendos pagos sobre o preço da ação
- **Fonte**: `FinancialData.dy`
- **Formato**: Decimal (ex: 0.06 = 6%)
- **Exemplo**: `{ "dy": { "gte": 0.06 } }` - Dividend Yield >= 6%

#### `payout` (Payout Ratio - Taxa de Distribuição)
- **Descrição**: Percentual do lucro distribuído como dividendos
- **Fonte**: `FinancialData.payout`
- **Formato**: Decimal (ex: 0.50 = 50%)
- **Exemplo**: `{ "payout": { "lte": 0.30 } }` - Payout <= 30% (empresas que reinvestem mais)
- **Uso comum**: Empresas de crescimento geralmente têm payout baixo (< 30%), pois reinvestem lucros

#### `dividendYield12m` (Dividend Yield 12 Meses)
- **Descrição**: Dividend Yield dos últimos 12 meses
- **Fonte**: `FinancialData.dividendYield12m`
- **Formato**: Decimal (ex: 0.08 = 8%)
- **Exemplo**: `{ "dividendYield12m": { "gte": 0.08 } }` - DY 12m >= 8%

### 7. Indicadores de Crescimento

#### `cagrLucros5a` (CAGR Lucros 5 Anos)
- **Descrição**: Taxa de crescimento anual composta dos lucros nos últimos 5 anos
- **Fonte**: `FinancialData.cagrLucros5a`
- **Formato**: Decimal (ex: 0.15 = 15% ao ano)
- **Exemplo**: `{ "cagrLucros5a": { "gte": 0.10 } }` - CAGR Lucros >= 10% a.a.

#### `cagrReceitas5a` (CAGR Receitas 5 Anos)
- **Descrição**: Taxa de crescimento anual composta das receitas nos últimos 5 anos
- **Fonte**: `FinancialData.cagrReceitas5a`
- **Formato**: Decimal (ex: 0.12 = 12% ao ano)
- **Exemplo**: `{ "cagrReceitas5a": { "gte": 0.10 } }` - CAGR Receitas >= 10% a.a.

#### `crescimentoLucros` (Crescimento de Lucros)
- **Descrição**: Crescimento do lucro líquido (ano atual vs anterior)
- **Fonte**: `FinancialData.crescimentoLucros`
- **Formato**: Decimal (ex: 0.20 = 20%)
- **Exemplo**: `{ "crescimentoLucros": { "gte": 0.10 } }` - Crescimento Lucros >= 10%

#### `crescimentoReceitas` (Crescimento de Receitas)
- **Descrição**: Crescimento da receita total (ano atual vs anterior)
- **Fonte**: `FinancialData.crescimentoReceitas`
- **Formato**: Decimal (ex: 0.15 = 15%)
- **Exemplo**: `{ "crescimentoReceitas": { "gte": 0.10 } }` - Crescimento Receitas >= 10%

### 8. Indicadores de Eficiência

#### `giroAtivos` (Giro de Ativos)
- **Descrição**: Razão entre receita total e ativos totais
- **Fonte**: `FinancialData.giroAtivos`
- **Formato**: Decimal (ex: 1.2 = 1.2x)
- **Exemplo**: `{ "giroAtivos": { "gte": 1.0 } }` - Giro de Ativos >= 1.0x

### 9. Indicadores de Valor Patrimonial

#### `lpa` (Lucro por Ação)
- **Descrição**: Lucro líquido dividido pelo número de ações
- **Fonte**: `FinancialData.lpa`
- **Formato**: Decimal (ex: 2.50 = R$ 2,50)
- **Exemplo**: `{ "lpa": { "gte": 1.0 } }` - LPA >= R$ 1,00

#### `vpa` (Valor Patrimonial por Ação)
- **Descrição**: Patrimônio líquido dividido pelo número de ações
- **Fonte**: `FinancialData.vpa`
- **Formato**: Decimal (ex: 15.0 = R$ 15,00)
- **Exemplo**: `{ "vpa": { "gte": 10.0 } }` - VPA >= R$ 10,00

### 10. Indicadores de Tamanho

#### `marketCap` (Market Capitalization - Valor de Mercado)
- **Descrição**: Valor total de mercado da empresa (preço × ações)
- **Fonte**: `FinancialData.marketCap`
- **Formato**: Decimal em R$ (ex: 1000000000 = R$ 1 bilhão)
- **Exemplo**: `{ "marketCap": { "gte": 1000000000 } }` - Market Cap >= R$ 1 bilhão

#### `enterpriseValue` (Enterprise Value - Valor da Empresa)
- **Descrição**: Valor total da empresa (market cap + dívida - caixa)
- **Fonte**: `FinancialData.enterpriseValue`
- **Formato**: Decimal em R$ (ex: 2000000000 = R$ 2 bilhões)
- **Exemplo**: `{ "enterpriseValue": { "gte": 2000000000 } }` - EV >= R$ 2 bilhões

### 11. Score Geral

#### `overallScore` (Score Geral)
- **Descrição**: Score composto calculado pelo sistema (0-100)
- **Fonte**: Calculado dinamicamente pelo `overall-score.ts`
- **Formato**: Integer (ex: 50 = 50 pontos)
- **Exemplo**: `{ "overallScore": { "gte": 50 } }` - Score Geral >= 50

**Nota**: O Score Geral considera múltiplas estratégias e indicadores fundamentais. Valores típicos:
- **0-30**: Empresa de baixa qualidade
- **30-50**: Empresa de qualidade média
- **50-70**: Empresa de boa qualidade
- **70-100**: Empresa de excelente qualidade

### 12. Seleção por Estratégia

#### `strategy` (Estratégia de Seleção)
- **Descrição**: Usa uma estratégia específica para ranquear e selecionar empresas
- **Tipo**: Objeto com `type` e `params`
- **Estratégias Disponíveis**:
  - `graham`: Modelo Graham (value investing)
  - `fcd`: Fluxo de Caixa Descontado
  - `dividendYield`: Foco em dividendos
  - `lowPE`: Ações com P/L baixo
  - `magicFormula`: Fórmula Mágica de Greenblatt
  - `gordon`: Modelo de Gordon (crescimento de dividendos)
  - `fundamentalist`: Análise fundamentalista completa
  - `barsi`: Estratégia Barsi (dividendos crescentes)
  - `ai`: Análise com IA
  - `screening`: Screening customizado

**Exemplo**:
```json
{
  "quality": {
    "strategy": {
      "type": "graham",
      "params": {
        "marginOfSafety": 0.30,
        "limit": 15
      }
    }
  }
}
```

**Como Funciona**:
1. Quando uma estratégia é especificada, o sistema executa o ranking dessa estratégia
2. O TOP N é selecionado baseado no ranking retornado pela estratégia
3. A estratégia já aplica seus próprios filtros de qualidade internamente
4. Você pode combinar estratégia com outros filtros (a estratégia será executada primeiro)

**Parâmetros Comuns para Estratégias**:
- `limit`: Número máximo de resultados (padrão: 10)
- `companySize`: `'all' | 'small_caps' | 'mid_caps' | 'blue_chips'`
- `useTechnicalAnalysis`: `true | false` - Priorizar ativos em sobrevenda
- `includeBDRs`: `true | false` - Incluir BDRs
- `assetTypeFilter`: `'b3' | 'bdr' | 'both'`

**Parâmetros Específicos por Estratégia**:

**Graham**:
```json
{
  "strategy": {
    "type": "graham",
    "params": {
      "marginOfSafety": 0.30  // Margem de segurança de 30%
    }
  }
}
```

**FCD**:
```json
{
  "strategy": {
    "type": "fcd",
    "params": {
      "growthRate": 0.025,        // Taxa de crescimento perpetuo (2.5%)
      "discountRate": 0.10,       // WACC (10%)
      "yearsProjection": 5,       // Anos de projeção
      "minMarginOfSafety": 0.20   // Margem de segurança mínima (20%)
    }
  }
}
```

**Dividend Yield**:
```json
{
  "strategy": {
    "type": "dividendYield",
    "params": {
      "minYield": 0.06  // Dividend Yield mínimo de 6%
    }
  }
}
```

**Low PE**:
```json
{
  "strategy": {
    "type": "lowPE",
    "params": {
      "maxPE": 15,      // P/L máximo de 15
      "minROE": 0.15    // ROE mínimo de 15%
    }
  }
}
```

**Magic Formula**:
```json
{
  "strategy": {
    "type": "magicFormula",
    "params": {
      "minROIC": 0.10,  // ROIC mínimo de 10%
      "minEY": 0.08     // Earnings Yield mínimo de 8%
    }
  }
}
```

**Gordon**:
```json
{
  "strategy": {
    "type": "gordon",
    "params": {
      "discountRate": 0.12,           // Taxa de desconto (12%)
      "dividendGrowthRate": 0.05,     // Crescimento de dividendos (5%)
      "useSectoralAdjustment": true   // Usar ajuste setorial automático
    }
  }
}
```

**Barsi**:
```json
{
  "strategy": {
    "type": "barsi",
    "params": {
      "minDividendGrowth": 0.10,  // Crescimento mínimo de dividendos (10%)
      "minDividendYield": 0.06    // Dividend Yield mínimo (6%)
    }
  }
}
```

**AI**:
```json
{
  "strategy": {
    "type": "ai",
    "params": {
      "riskTolerance": "Moderado",      // Conservador, Moderado, Agressivo
      "timeHorizon": "Longo Prazo",      // Curto Prazo, Médio Prazo, Longo Prazo
      "focus": "Valor"                   // Valor, Crescimento, Dividendos, Crescimento e Valor
    }
  }
}
```

**Screening**:
```json
{
  "strategy": {
    "type": "screening",
    "params": {
      "plFilter": { "enabled": true, "max": 15 },
      "roeFilter": { "enabled": true, "min": 0.15 },
      "dyFilter": { "enabled": true, "min": 0.06 },
      "selectedSectors": ["Financeiro", "Energia"]
    }
  }
}
```

## Campos Adicionais Disponíveis

### Da Tabela `Company`:
- `sector`: Setor da empresa (String)
- `industry`: Indústria da empresa (String)
- `assetType`: Tipo de ativo (`STOCK`, `ETF`, `FII`, `BDR`)

### Da Tabela `FinancialData`:
Todos os campos listados acima, além de:
- `forwardPE`: P/L projetado
- `trailingEps`: EPS trailing
- `pAtivos`: Preço/Ativos
- `pCapGiro`: Preço/Capital de Giro
- `pEbit`: Preço/EBIT
- `receitaPorAcao`: Receita por ação
- `caixaPorAcao`: Caixa por ação
- `variacao52Semanas`: Variação de 52 semanas
- `retornoAnoAtual`: Retorno do ano atual
- `ebitda`: EBITDA absoluto
- `receitaTotal`: Receita total absoluta
- `lucroLiquido`: Lucro líquido absoluto
- `fluxoCaixaOperacional`: Fluxo de caixa operacional
- `fluxoCaixaInvestimento`: Fluxo de caixa de investimento
- `fluxoCaixaFinanciamento`: Fluxo de caixa de financiamento
- `fluxoCaixaLivre`: Fluxo de caixa livre
- `totalCaixa`: Total de caixa
- `totalDivida`: Total de dívida
- `ativoCirculante`: Ativo circulante
- `ativoTotal`: Ativo total
- `passivoCirculante`: Passivo circulante
- `passivoTotal`: Passivo total
- `patrimonioLiquido`: Patrimônio líquido
- `caixa`: Caixa e equivalentes
- `estoques`: Estoque
- `contasReceber`: Contas a receber
- `imobilizado`: Imobilizado
- `intangivel`: Intangível
- `dividaCirculante`: Dívida circulante
- `dividaLongoPrazo`: Dívida de longo prazo

### 13. Limites por Faixa de Score

#### `scoreBands` (Limites por Faixa de Score)
- **Descrição**: Permite definir limites máximos de ativos por faixa de score
- **Localização**: `selection.scoreBands`
- **Formato**: Array de objetos `{ min, max, maxCount }`
- **Exemplo**:
```json
{
  "selection": {
    "scoreBands": [
      { "min": 50, "max": 60, "maxCount": 3 },  // Máximo 3 ativos com score 50-60
      { "min": 60, "max": 70, "maxCount": 5 },  // Máximo 5 ativos com score 60-70
      { "min": 70, "max": 100, "maxCount": 10 } // Máximo 10 ativos com score 70-100
    ]
  }
}
```

**Como Funciona**:
1. As faixas são processadas em ordem decrescente de score (maiores scores primeiro)
2. Dentro de cada faixa, os ativos são ordenados pelo critério especificado (`orderBy`)
3. Seleciona até `maxCount` ativos de cada faixa
4. Se `topN` estiver definido e ainda houver espaço, preenche com os melhores restantes

**Nota**: Se `scoreBands` estiver definido, ele tem prioridade sobre `topN`. O `topN` será usado apenas para preencher vagas restantes após aplicar os limites das faixas.

## Exemplos de Configuração

### Exemplo 1: Value Investing Básico
```json
{
  "quality": {
    "roe": { "gte": 0.15 },
    "margemLiquida": { "gte": 0.10 },
    "dividaLiquidaEbitda": { "lte": 2.0 },
    "pl": { "lte": 15.0 },
    "overallScore": { "gte": 60 }
  }
}
```

### Exemplo 2: Dividendos com Qualidade
```json
{
  "quality": {
    "dy": { "gte": 0.08 },
    "payout": { "lte": 0.70 },
    "roe": { "gte": 0.12 },
    "cagrLucros5a": { "gte": 0.05 }
  }
}
```

### Exemplo 3: Crescimento com Qualidade
```json
{
  "quality": {
    "cagrLucros5a": { "gte": 0.15 },
    "cagrReceitas5a": { "gte": 0.12 },
    "margemLiquida": { "gte": 0.08 },
    "roic": { "gte": 0.15 }
  }
}
```

### Exemplo 4: Usando Estratégia Graham
```json
{
  "quality": {
    "strategy": {
      "type": "graham",
      "params": {
        "marginOfSafety": 0.30,
        "limit": 15
      }
    },
    "overallScore": { "gte": 50 }
  }
}
```

### Exemplo 5: Combinando Filtros e Estratégia
```json
{
  "quality": {
    "roe": { "gte": 0.10 },
    "margemLiquida": { "gte": 0.05 },
    "strategy": {
      "type": "magicFormula",
      "params": {
        "minROIC": 0.15,
        "minEY": 0.10
      }
    }
  }
}
```

### 14. Diversificação por Setor

#### `diversification` (Diversificação por Setor)
- **Descrição**: Permite controlar a distribuição de ativos por setor
- **Tipo**: Objeto com `type`, `sectorAllocation` ou `maxCountPerSector`
- **Tipos Disponíveis**:
  - `allocation`: Alocação percentual por setor
  - `maxCount`: Quantidade máxima de ativos por setor

**Exemplo 1: Alocação Percentual**:
```json
{
  "diversification": {
    "type": "allocation",
    "sectorAllocation": {
      "Financeiro": 0.20,  // 20% em Financeiro
      "Energia": 0.15,      // 15% em Energia
      "Consumo Não Cíclico": 0.10,  // 10% em Consumo Não Cíclico
      "Saúde": 0.10         // 10% em Saúde
    }
  }
}
```

**Como Funciona (Allocation)**:
1. Calcula quantos ativos de cada setor são necessários para atingir a alocação desejada
2. Seleciona os melhores ativos de cada setor (ordenados pelo critério especificado)
3. Se a soma das alocações for menor que 100%, preenche com os melhores restantes
4. Se a soma for maior que 100%, normaliza automaticamente

**Exemplo 2: Quantidade Máxima por Setor**:
```json
{
  "diversification": {
    "type": "maxCount",
    "maxCountPerSector": {
      "Financeiro": 3,     // Máximo 3 ativos do setor Financeiro
      "Energia": 2,        // Máximo 2 ativos do setor Energia
      "Consumo Cíclico": 2 // Máximo 2 ativos do setor Consumo Cíclico
    }
  }
}
```

**Como Funciona (MaxCount)**:
1. Ordena todos os candidatos pelo critério especificado
2. Seleciona ativos respeitando o limite máximo de cada setor
3. Setores não especificados não têm limite

**Setores Disponíveis**:
- Bens Industriais
- Comunicações
- Consumo Cíclico
- Consumo Não Cíclico
- Energia
- Financeiro
- Imobiliário
- Materiais Básicos
- Saúde
- Tecnologia da Informação
- Utilidade Pública
- Outros (para empresas sem setor definido)

**Notas**:
- A diversificação é aplicada **após** a seleção inicial (topN ou scoreBands)
- Empresas sem setor definido são agrupadas como "Outros"
- A diversificação pode reduzir o número total de ativos selecionados se os limites forem muito restritivos
- Para `allocation`, se não houver ativos suficientes em um setor, a alocação será ajustada proporcionalmente

### 15. Exclusão de Tickers

#### `excludedTickers` (Lista de Tickers Excluídos)
- **Descrição**: Lista de tickers específicos a serem excluídos do screening
- **Formato**: Array de strings
- **Exemplo**: `{ "excludedTickers": ["SOND5", "PETR6", "VALE5"] }`

#### `excludedTickerPatterns` (Padrões de Exclusão)
- **Descrição**: Padrões para excluir múltiplos tickers de uma vez
- **Formato**: Array de strings com padrões
- **Padrões Suportados**:
  - `"*5"` ou `"*6"`: Exclui todos os tickers terminados em 5 ou 6 (ex: SOND5, PETR6)
  - `"PET*"`: Exclui todos os tickers que começam com "PET" (ex: PETR3, PETR4, PETR6)
  - Padrão exato: Exclui ticker específico (mesmo que `excludedTickers`)
- **Exemplo**: `{ "excludedTickerPatterns": ["*5", "*6"] }` - Exclui todos os tickers terminados em 5 ou 6

**Como Funciona**:
1. As exclusões são aplicadas **antes** de qualquer filtro de qualidade
2. `excludedTickers` tem prioridade sobre padrões (se um ticker está na lista, será excluído mesmo que não corresponda a nenhum padrão)
3. Padrões são processados em ordem e todos são aplicados
4. Tickers excluídos não aparecem no resultado do screening

**Casos de Uso**:
- Excluir classes específicas de ações (ex: preferir ações ordinárias sobre preferenciais)
- Excluir tickers problemáticos conhecidos
- Excluir empresas específicas por critérios não quantitativos

## Notas Importantes

1. **Valores Null**: Se um indicador for `null` (dados não disponíveis), a empresa será **rejeitada** pelo filtro, exceto quando especificado de outra forma.

2. **Combinação de Filtros**: Todos os filtros são aplicados com **AND** lógico. Uma empresa precisa passar em TODOS os filtros especificados.

3. **Estratégias**: Quando uma estratégia é especificada, ela é executada primeiro e o ranking retornado é usado para seleção. Outros filtros ainda são aplicados antes da estratégia.

4. **Performance**: Filtros que requerem cálculo dinâmico (como `overallScore`) são aplicados apenas aos primeiros 50 candidatos para otimizar performance.

5. **Case Sensitivity**: Os nomes dos campos são **case-sensitive**. Use exatamente como especificado neste documento.

6. **Formato de Valores**: 
   - Percentuais: Use decimais (0.10 = 10%, 0.15 = 15%)
   - Razões: Use decimais (1.5 = 1.5x, 3.0 = 3x)
   - Valores absolutos: Use números inteiros ou decimais (1000000000 = R$ 1 bilhão)

## Suporte

Para dúvidas sobre filtros específicos ou estratégias, consulte:
- Documentação das estratégias em `src/lib/strategies/`
- Schema do Prisma em `prisma/schema.prisma`
- Código do screening engine em `src/lib/index-screening-engine.ts`

