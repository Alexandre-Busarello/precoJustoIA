# Cálculo de Dividendos em Índices IPJ

## 📋 Visão Geral

Os índices IPJ são calculados como **Total Return**, ou seja, incluem tanto a variação de preço quanto os dividendos recebidos. Este documento explica como os dividendos são processados e convertidos em pontos do índice.

## 🔢 Fórmula de Conversão de Dividendos em Pontos

Quando um dividendo é pago, ele é convertido em pontos do índice usando a seguinte fórmula:

```typescript
dividendInPoints = (dividend / priceYesterday) * weight * previousPoints
```

Onde:
- `dividend` = Valor do dividendo por ação (ex: R$ 0,112561)
- `priceYesterday` = Preço de fechamento do dia anterior
- `weight` = Peso do ativo no índice (targetWeight, ex: 0.05 = 5%)
- `previousPoints` = Pontos do índice no dia anterior

### Exemplo Prático

Para um dividendo de R$ 0,112561 da BLAU3:
- Preço anterior: R$ 9,775
- Peso no índice: 8,38% (0,0838)
- Pontos anteriores: 101,0123

```
dividendInPoints = (0.112561 / 9.775) * 0.0838 * 101.0123
                 = 0.01152 * 0.0838 * 101.0123
                 = 0.000965 * 101.0123
                 ≈ 0.094344 pontos
```

## ✅ Como o Dividendo é Incluído nos Pontos

O dividendo **já está incluído** nos pontos calculados através do retorno diário. O processo funciona assim:

### 1. Ajuste do Preço com Dividendo

```typescript
adjustedPriceToday = priceToday + dividend
```

O preço do dia é ajustado somando o dividendo ao preço atual. Isso evita penalizar o índice quando o preço cai no ex-date.

### 2. Cálculo do Retorno Diário

```typescript
dailyReturn = (adjustedPriceToday / priceYesterday) - 1
```

O retorno diário já inclui o dividendo porque usa o preço ajustado.

### 3. Retorno Ponderado Acumulado

```typescript
totalReturn += weight * dailyReturn
```

O retorno ponderado acumula o retorno de cada ativo, já incluindo dividendos.

### 4. Cálculo dos Pontos

```typescript
points = previousPoints * (1 + totalReturn)
```

Os pontos são calculados usando o `totalReturn`, que já inclui o dividendo.

## 📊 Campo `dividendsReceived`

O campo `dividendsReceived` armazenado no banco de dados representa o **total de dividendos recebidos em pontos do índice** para aquele dia. Este valor é:

- ✅ **Informativo/Contábil**: Usado para análise e relatórios
- ✅ **Já Incluído nos Pontos**: O dividendo já está embutido no cálculo dos pontos através do retorno diário
- ❌ **Não Somado Novamente**: Não há dupla contagem - o dividendo entra apenas uma vez no cálculo

### Exemplo

Se `dividendsReceived = 0.094344` pontos:
- Este valor representa quanto do retorno do dia veio de dividendos
- Os pontos do índice já incluem esse valor através do cálculo do retorno diário
- É apenas para registro e análise, não é somado novamente aos pontos

## 🎯 Resumo

1. **Total Return**: Os índices IPJ são calculados como Total Return, incluindo dividendos
2. **Inclusão Automática**: Dividendos são automaticamente incluídos nos pontos através do ajuste de preço
3. **Sem Dupla Contagem**: O dividendo entra apenas uma vez no cálculo dos pontos
4. **Campo Informativo**: `dividendsReceived` é apenas para registro, não é somado novamente

## 📝 Código de Referência

A lógica está implementada em:
- `src/lib/index-engine.ts`:
  - Linha 404: Ajuste do preço com dividendo
  - Linha 407: Cálculo do retorno diário
  - Linha 418: Conversão de dividendo em pontos (para registro)
  - Linha 442: Cálculo final dos pontos

## 🔍 Busca de Dividendos

Os dividendos são buscados usando a função `getDividendsForDate()` que:
- Busca dividendos com `exDate` igual à data especificada
- Normaliza datas para evitar problemas de timezone
- Agrupa múltiplos dividendos do mesmo ticker no mesmo dia

**Importante**: No mercado brasileiro, o ex-date é o próprio dia em que o preço já está ajustado (já foi descontado no pregão). Portanto, ao calcular pontos para 04/12, buscamos dividendos com `exDate = 04/12`.


