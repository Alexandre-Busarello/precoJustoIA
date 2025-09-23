# 📊 Script de Dados Históricos BRAPI

## 🎯 Objetivo

Script para buscar e armazenar dados históricos de cotação da BRAPI, focado em dados mensais para gráficos candlestick.

## 🗄️ Estrutura do Banco

### Novo Modelo: `HistoricalPrice`

```prisma
model HistoricalPrice {
  id            Int      @id @default(autoincrement())
  companyId     Int      @map("company_id")
  date          DateTime @db.Date
  open          Decimal  @db.Decimal(10, 4)
  high          Decimal  @db.Decimal(10, 4)
  low           Decimal  @db.Decimal(10, 4)
  close         Decimal  @db.Decimal(10, 4)
  volume        BigInt
  adjustedClose Decimal  @map("adjusted_close") @db.Decimal(10, 4)
  interval      String   @default("1mo") // 1d, 1wk, 1mo
  updatedAt     DateTime @updatedAt @map("updated_at")
  company       Company  @relation(fields: [companyId], references: [id])

  @@unique([companyId, date, interval])
  @@index([companyId, interval, date])
  @@index([date])
  @@map("historical_prices")
}
```

### Campos Explicados

- **OHLCV**: Open, High, Low, Close, Volume (padrão candlestick)
- **adjustedClose**: Preço ajustado para dividendos/splits
- **interval**: Intervalo dos dados (1d, 1wk, 1mo)
- **Índices**: Otimizados para consultas por empresa/período

## 🚀 Como Usar

### 1. Preparar o Banco

```bash
# Aplicar migração (se usando Prisma)
npm run db:push

# Ou executar SQL manualmente
psql -d sua_database -f scripts/create-historical-prices-migration.sql
```

### 2. Configurar Token BRAPI

```bash
# No arquivo .env
BRAPI_TOKEN=seu_token_aqui
```

### 3. Executar o Script

```bash
# Buscar dados de todas as empresas (máximo histórico, mensal)
npm run fetch:historical:brapi

# Buscar tickers específicos
npm run fetch:historical:brapi -- --tickers=PETR4,VALE3,ITUB4

# Configurar período e intervalo
npm run fetch:historical:brapi -- --range=5y --interval=1mo

# Forçar atualização (reprocessar dados existentes)
npm run fetch:historical:brapi -- --force
```

### 4. Opções Disponíveis

#### Ranges (Períodos)
- `1d`, `5d`: Dias
- `1mo`, `3mo`, `6mo`: Meses  
- `1y`, `2y`, `5y`, `10y`: Anos
- `ytd`: Ano atual
- `max`: Máximo disponível (recomendado)

#### Intervals (Intervalos)
- `1d`: Diário
- `1wk`: Semanal
- `1mo`: Mensal (recomendado para candlestick)

## 📊 Dados da BRAPI

### Formato de Entrada (historicalDataPrice)

```json
{
  "historicalDataPrice": [
    {
      "date": 1756126800,        // timestamp Unix
      "open": 30.47,
      "high": 30.78,
      "low": 30.42,
      "close": 30.65,
      "volume": 21075300,
      "adjustedClose": 30.65
    }
  ]
}
```

### Processamento

1. **Conversão de timestamp**: Unix → Date
2. **Verificação de duplicatas**: Evita reprocessamento
3. **Inserção em lotes**: Performance otimizada
4. **Rastreamento de progresso**: Via TickerProcessingManager

## 🎯 Casos de Uso

### 1. Gráficos Candlestick Mensais

```sql
SELECT 
  date,
  open,
  high,
  low,
  close,
  volume
FROM historical_prices 
WHERE company_id = ? 
  AND interval = '1mo'
  AND date >= ?
ORDER BY date ASC;
```

### 2. Análise de Volatilidade

```sql
SELECT 
  date,
  ((high - low) / close) * 100 as volatility_percent
FROM historical_prices 
WHERE company_id = ? 
  AND interval = '1mo'
ORDER BY date DESC;
```

### 3. Retornos Mensais

```sql
SELECT 
  date,
  close,
  LAG(close) OVER (ORDER BY date) as prev_close,
  ((close - LAG(close) OVER (ORDER BY date)) / LAG(close) OVER (ORDER BY date)) * 100 as return_percent
FROM historical_prices 
WHERE company_id = ? 
  AND interval = '1mo'
ORDER BY date ASC;
```

## 🔧 Funcionalidades

### ✅ Implementado

- ✅ Busca dados históricos da BRAPI
- ✅ Suporte a múltiplos tickers
- ✅ Configuração flexível de período/intervalo
- ✅ Prevenção de duplicatas
- ✅ Inserção em lotes (performance)
- ✅ Rastreamento de progresso
- ✅ Rate limiting (respeitando limites da API)
- ✅ Tratamento de erros robusto
- ✅ Logs detalhados

### 🔄 Melhorias Futuras

- 🔄 Atualização incremental (apenas dados novos)
- 🔄 Suporte a intervalos diários/semanais
- 🔄 Compressão de dados antigos
- 🔄 API endpoint para consulta dos dados
- 🔄 Dashboard de monitoramento

## 🧪 Testes

### Ações Gratuitas (Sem Token)

A BRAPI oferece 4 ações para teste sem autenticação:
- **PETR4** (Petrobras PN)
- **MGLU3** (Magazine Luiza ON)  
- **VALE3** (Vale ON)
- **ITUB4** (Itaú Unibanco PN)

```bash
# Testar com ações gratuitas
npm run fetch:historical:brapi -- --tickers=PETR4,MGLU3,VALE3,ITUB4 --range=1y
```

### Script de Teste

```bash
# Executar teste automatizado
tsx scripts/test-historical-fetch.ts
```

## 📈 Performance

### Otimizações Implementadas

1. **Inserção em lotes**: 100 registros por vez
2. **Verificação de duplicatas**: Consulta prévia de datas existentes
3. **Processamento paralelo**: 3 tickers simultâneos
4. **Rate limiting**: 2s entre lotes
5. **Índices otimizados**: Consultas rápidas por empresa/período

### Estimativas

- **1 ticker, 5 anos mensais**: ~60 registros, ~2s
- **100 tickers, 5 anos mensais**: ~6.000 registros, ~5min
- **500 tickers, máximo histórico**: ~50.000+ registros, ~30min

## 🚨 Limitações

### BRAPI API

- **Rate limits**: Varia por plano
- **Dados históricos**: Limitados por ticker
- **Token obrigatório**: Exceto para 4 ações de teste

### Script

- **Sem atualização incremental**: Reprocessa tudo se forçado
- **Apenas BRAPI**: Não integra outras fontes
- **Foco mensal**: Otimizado para candlestick mensal

## 🔗 Integração

### Com Sistema Existente

O script integra com:
- ✅ **TickerProcessingManager**: Rastreamento de progresso
- ✅ **Modelo Company**: Usa empresas existentes
- ✅ **backgroundPrisma**: Conexão otimizada
- ✅ **Sistema de logs**: Padrão do projeto

### Próximos Passos

1. **API Endpoint**: Expor dados via REST/GraphQL
2. **Frontend**: Componente de gráfico candlestick
3. **Análises**: Indicadores técnicos baseados nos dados
4. **Alertas**: Notificações baseadas em padrões

## 📚 Referências

- [Documentação BRAPI](https://brapi.dev/docs/acoes)
- [Candlestick Charts](https://en.wikipedia.org/wiki/Candlestick_chart)
- [Prisma Documentation](https://www.prisma.io/docs/)
