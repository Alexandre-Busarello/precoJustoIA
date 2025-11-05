# Implementação da Estratégia Barsi

## Visão Geral

A estratégia Barsi foi implementada seguindo fielmente o método de Luiz Barsi Filho para construção de patrimônio através de dividendos. Esta implementação captura os 5 passos essenciais do método e os traduz em critérios objetivos de análise.

## Os 5 Passos do Método Barsi

### 1. Setores "Perenes" (B.E.S.T.)

**Conceito**: Focar em empresas de setores essenciais que as pessoas sempre precisarão.

**Implementação**:
```typescript
private readonly PERENNIAL_SECTORS = [
  'Bancos',           // B - Bancos
  'Energia Elétrica', // E - Energia Elétrica  
  'Saneamento',       // S - Saneamento
  'Seguros',          // S - Seguros
  'Telecomunicações', // T - Telecomunicações
  'Gás',             // Adicional
  'Água e Saneamento',
  'Energia',
  'Serviços Financeiros',
  'Utilities'
];
```

**Parâmetro**: `focusOnBEST` (padrão: `true`)
- `true`: Apenas empresas dos setores perenes
- `false`: Todos os setores (mais flexível)

### 2. Qualidade da Empresa

**Conceito**: Empresas com lucro consistente, baixo endividamento e boa governança.

**Critérios Implementados**:
- **ROE ≥ 10%**: Rentabilidade consistente
- **Dívida/PL ≤ 100%**: Endividamento controlado
- **Margem Líquida > 0%**: Empresa lucrativa
- **Histórico de Dividendos**: Mínimo 5 anos consecutivos
- **Payout 20-80%**: Distribuição sustentável
- **Market Cap ≥ R$ 1B**: Tamanho e liquidez adequados

### 3. Preço Teto (Conceito Central)

**Conceito**: Só comprar quando o preço estiver abaixo do "preço teto" calculado.

**Fórmula**:
```
Preço Teto = Dividendo por Ação ÷ DY Meta
```

**Exemplo**:
- Empresa paga R$ 2,10 por ação/ano
- Meta de DY: 6%
- Preço Teto = R$ 2,10 ÷ 0,06 = R$ 35,00
- **Só compra se preço ≤ R$ 35,00**

**Parâmetros**:
- `targetDividendYield`: Meta de DY (padrão: 6%)
- `maxPriceToPayMultiplier`: Multiplicador do teto (padrão: 1.0)

### 4. Disciplina de Aporte

**Conceito**: Aporte mensal constante, aproveitando crises para comprar mais barato.

**Implementação**: 
- A estratégia identifica oportunidades (preço ≤ teto)
- Ordena por melhor desconto do preço teto
- Prioriza empresas com maior "Score Barsi"

### 5. Reinvestimento 100%

**Conceito**: Todos os dividendos reinvestidos para efeito "bola de neve".

**Implementação**: 
- A estratégia foca em empresas com histórico consistente
- Avalia sustentabilidade dos dividendos
- Prioriza empresas com crescimento dos dividendos

## Score Barsi (Algoritmo de Qualidade)

O Score Barsi combina os conceitos do método em uma pontuação de 0-100:

### Composição do Score:

1. **Desconto do Preço Teto (40%)**
   - Peso principal: oportunidade de compra
   - Até 30% de desconto = 40 pontos máximos
   - Fórmula: `min(desconto / 30 * 40, 40)`

2. **Qualidade dos Dividendos (35%)**
   - DY atual: até 20 pontos
   - Consistência histórica: +15 pontos
   - Fórmula: `min((DY * 200) + 15, 35)`

3. **Saúde Financeira (25%)**
   - ROE: até 10 pontos
   - Liquidez Corrente: até 10 pontos  
   - Margem Líquida: até 5 pontos
   - Fórmula: `min(ROE*40 + LC*4 + ML*33, 25)`

## Parâmetros de Configuração

```typescript
interface BarsiParams {
  targetDividendYield: number;      // Meta de DY (ex: 0.06 = 6%)
  maxPriceToPayMultiplier?: number; // Multiplicador do teto (padrão: 1.0)
  minConsecutiveDividends?: number; // Anos consecutivos (padrão: 5)
  maxDebtToEquity?: number;         // Máx Dívida/PL (padrão: 1.0)
  minROE?: number;                  // ROE mínimo (padrão: 0.10)
  focusOnBEST?: boolean;            // Só setores B.E.S.T. (padrão: true)
}
```

## Configuração Padrão

```typescript
barsi: {
  targetDividendYield: 0.06,      // Meta de 6% de dividend yield
  maxPriceToPayMultiplier: 1.0,   // Preço teto exato
  minConsecutiveDividends: 5,     // 5 anos consecutivos
  maxDebtToEquity: 1.0,           // Máximo 100% Dívida/PL
  minROE: 0.10,                   // ROE mínimo 10%
  focusOnBEST: true,              // Apenas setores perenes
  companySize: 'all',             // Todas as empresas
  useTechnicalAnalysis: true,     // Análise técnica para timing
  use7YearAverages: true          // Médias históricas
}
```

## Exemplo de Uso

```typescript
import { BarsiStrategy } from './barsi-strategy';

const strategy = new BarsiStrategy();
const params = {
  targetDividendYield: 0.06,  // Meta de 6%
  focusOnBEST: true          // Apenas setores perenes
};

// Análise individual
const analysis = strategy.runAnalysis(companyData, params);

// Ranking de empresas
const ranking = strategy.runRanking(companies, params);
```

## Diferenças das Outras Estratégias

| Aspecto | Barsi | Graham | Dividend Yield |
|---------|-------|--------|----------------|
| **Foco** | Renda passiva longo prazo | Valor + segurança | Renda atual |
| **Setores** | Apenas perenes (B.E.S.T.) | Todos | Todos |
| **Preço** | Preço teto por DY | Valor justo por múltiplos | Qualquer (se DY alto) |
| **Horizonte** | 20-30 anos | 3-5 anos | Indefinido |
| **Venda** | Nunca (exceto fundamentos) | Quando atingir valor | Flexível |
| **Reinvestimento** | 100% obrigatório | Opcional | Opcional |

## Vantagens da Implementação

1. **Fidelidade ao Método**: Segue rigorosamente os 5 passos do Barsi
2. **Objetividade**: Critérios claros e mensuráveis
3. **Flexibilidade**: Parâmetros configuráveis
4. **Integração**: Compatível com análise técnica e médias históricas
5. **Score Único**: Combina oportunidade + qualidade em uma métrica

## Casos de Uso Ideais

- **Investidores Iniciantes**: Método simples e disciplinado
- **Aposentadoria**: Foco em renda passiva crescente
- **Buy and Hold**: Estratégia de longo prazo
- **Aversão ao Risco**: Setores defensivos e estáveis
- **Disciplina**: Método força bons hábitos de investimento

## Limitações

1. **Setores Limitados**: Pode perder oportunidades em outros setores
2. **Rigidez de Preço**: Pode ficar muito tempo sem comprar
3. **Dependência de Dividendos**: Vulnerável a cortes de dividendos
4. **Crescimento Limitado**: Foco em valor, não crescimento
5. **Mercado Brasileiro**: Otimizado para características locais

## Conclusão

A implementação da estratégia Barsi oferece uma abordagem sistemática e disciplinada para construção de patrimônio através de dividendos, mantendo a simplicidade e eficácia do método original enquanto adiciona objetividade e automação ao processo de seleção.