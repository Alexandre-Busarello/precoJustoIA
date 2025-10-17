# Quote Service - Serviço de Cotações

## 📊 Overview

O `quote-service.ts` é o serviço centralizado para buscar preços de ações em tempo real. Ele implementa uma estratégia de **fonte primária + fallback** para garantir máxima disponibilidade e atualização dos preços.

## 🎯 Estratégia de Busca

### Ordem de Prioridade:

1. **Yahoo Finance API** (Primário)
   - Preços em tempo real
   - Cobertura global
   - Mais atualizado
   - **🆕 Auto-atualiza banco de dados** quando bem-sucedido

2. **Base de Dados Local** (Fallback)
   - Tabela `daily_quotes`
   - Último preço disponível
   - Garante disponibilidade

### 🔄 Atualização Automática

Quando o Yahoo Finance retorna um preço com sucesso, o serviço **automaticamente atualiza** o banco de dados local:

- **Cria** novo registro se não existir para hoje
- **Atualiza** registro existente se já houver preço para hoje
- Operação assíncrona (fire-and-forget) - não bloqueia a resposta
- Mantém base de dados sempre atualizada conforme uso do sistema

## 🚀 Funcionalidades

### `getLatestPrices(tickers: string[])`

Busca preços para múltiplos tickers em paralelo.

```typescript
import { getLatestPrices } from '@/lib/quote-service';

const prices = await getLatestPrices(['PETR4', 'VALE3', 'ITSA4']);

// Map<string, StockPrice> {
//   'PETR4' => { ticker: 'PETR4', price: 32.15, source: 'yahoo', timestamp: Date },
//   'VALE3' => { ticker: 'VALE3', price: 68.50, source: 'yahoo', timestamp: Date },
//   'ITSA4' => { ticker: 'ITSA4', price: 10.98, source: 'database', timestamp: Date }
// }
```

### `getTickerPrice(ticker: string)`

Busca preço para um único ticker.

```typescript
import { getTickerPrice } from '@/lib/quote-service';

const price = await getTickerPrice('PETR4');

// { ticker: 'PETR4', price: 32.15, source: 'yahoo', timestamp: Date }
```

### `getLatestPricesWithRetry(tickers, maxRetries)`

Busca preços com retry automático para tickers que falharam.

```typescript
import { getLatestPricesWithRetry } from '@/lib/quote-service';

const prices = await getLatestPricesWithRetry(['PETR4', 'VALE3'], 3);
```

### `pricesToNumberMap(priceMap)`

Converte `Map<string, StockPrice>` para `Map<string, number>` (compatibilidade).

```typescript
import { pricesToNumberMap } from '@/lib/quote-service';

const fullPrices = await getLatestPrices(['PETR4']);
const simplePrices = pricesToNumberMap(fullPrices);

// Map<string, number> { 'PETR4' => 32.15 }
```

## 📝 Tipo `StockPrice`

```typescript
interface StockPrice {
  ticker: string;        // Código da ação
  price: number;         // Preço em R$
  source: 'yahoo' | 'database';  // Fonte do preço
  timestamp: Date;       // Quando o preço foi obtido
}
```

## 🔧 Integração

### Portfolio Transaction Service

```typescript
// Antes (apenas database)
private static async getLatestPrices(tickers: string[]): Promise<Map<string, number>> {
  // ... query direto no Prisma
}

// Depois (Yahoo Finance + fallback)
import { getLatestPrices as getQuotes, pricesToNumberMap } from './quote-service';

private static async getLatestPrices(tickers: string[]): Promise<Map<string, number>> {
  const priceMap = await getQuotes(tickers);
  return pricesToNumberMap(priceMap);
}
```

### Portfolio Metrics Service

Mesma implementação do Transaction Service.

## 📊 Logs

O serviço gera logs detalhados para debugging:

```
💰 [QUOTE SERVICE] Fetching prices for 19 tickers
  ✅ PETR4: R$ 32.15 (Yahoo Finance)
  💾 PETR4: Database updated with R$ 32.15
  ✅ VALE3: R$ 68.50 (Yahoo Finance)
  💾 VALE3: Database updated with R$ 68.50
  ⚠️ ITSA4: Yahoo Finance unavailable, trying database...
  📊 ITSA4: R$ 10.98 (Database - 2025-10-16)
  ✅ BBSE3: R$ 31.81 (Yahoo Finance)
  💾 BBSE3: Database updated with R$ 31.81
  ...
✅ [QUOTE SERVICE] Retrieved 19/19 prices
```

## 🌐 Yahoo Finance Integration

### Símbolo das Ações

Ações brasileiras usam sufixo `.SA`:

```typescript
const yahooSymbol = `${ticker}.SA`; // PETR4 -> PETR4.SA
```

### Tratamento de Erros

- Se Yahoo Finance falhar (timeout, rate limit, ação não encontrada), o serviço automaticamente busca na base de dados
- Logs informativos para cada tentativa
- Nenhum erro é propagado se pelo menos uma fonte funcionar

## ⚙️ Configuração

### Dependências

```bash
npm install yahoo-finance2
```

### Yahoo Finance2 Options

O serviço usa configuração padrão do yahoo-finance2:

```typescript
await yahooFinance.quote(yahooSymbol, {
  return: 'object'
});
```

## 🔄 Atualização Automática do Banco de Dados

### Como Funciona

1. **Busca bem-sucedida no Yahoo Finance** → Preço retornado para o cliente
2. **Assíncrono (background)**: Sistema atualiza `daily_quotes` automaticamente
3. **Upsert**: Cria se não existe para hoje, atualiza se já existe
4. **Fire-and-forget**: Não bloqueia resposta, falhas são apenas logadas

### Benefícios

✅ **Base de dados sempre atualizada** conforme usuários usam o sistema  
✅ **Fallback melhor**: Quando Yahoo Finance cair, dados locais estão recentes  
✅ **Zero esforço**: Acontece automaticamente em background  
✅ **Performance**: Não impacta tempo de resposta do usuário  

### Lógica de Atualização

```typescript
// Quando Yahoo Finance retorna preço
updateDatabasePrice(ticker, price) {
  1. Busca company por ticker
  2. Se não encontrar → skip (log warning)
  3. Upsert em daily_quotes com data de hoje
  4. Log sucesso ou erro
}
```

### Casos Especiais

- **Ticker não existe na base**: Log informativo, não é erro
- **Falha no upsert**: Apenas loga erro, não afeta usuário
- **Múltiplas requisições no mesmo dia**: Última sobrescreve (upsert)

## 🔮 Melhorias Futuras

- [ ] Cache em memória (5 minutos) para reduzir chamadas à API
- [ ] Rate limiting inteligente para Yahoo Finance
- [ ] Suporte a múltiplas exchanges (US, EU, etc.)
- [ ] Webhook para atualização automática de preços
- [ ] Histórico de tentativas/falhas para monitoring
- [ ] Fallback para outras APIs (Alpha Vantage, Twelve Data)
- [ ] Atualizar também OHLCV (Open, High, Low, Close, Volume) quando disponível

## 🐛 Troubleshooting

### Nenhum preço retornado

1. Verifique se o ticker existe
2. Confira logs para ver qual fonte falhou
3. Verifique conectividade com Yahoo Finance
4. Confirme se existe quote na base de dados local

### Preços desatualizados

Se receber preços da database com datas antigas:

1. Yahoo Finance pode estar bloqueando requisições
2. Símbolo pode estar incorreto (verificar sufixo `.SA`)
3. Ação pode estar suspensa de negociação

### Performance lenta

- Yahoo Finance faz requisições sequenciais por ticker
- Para muitos tickers (>50), considere implementar cache
- Use `getLatestPricesWithRetry` para maior confiabilidade

## 📚 Referências

- [yahoo-finance2 Documentation](https://www.npmjs.com/package/yahoo-finance2)
- [Yahoo Finance API](https://finance.yahoo.com/)

