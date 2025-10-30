# Integração BDR (Brazilian Depositary Receipts)

## Visão Geral

Este documento descreve a integração completa de dados de BDRs (Brazilian Depositary Receipts) no sistema Preço Justo AI. A integração permite que BDRs sejam automaticamente detectados e processados usando dados do Yahoo Finance, seguindo o mesmo padrão de campos salvos pelo `fetch-data-ward.ts` para ações brasileiras.

## Funcionalidades

### 1. Detecção Automática de BDRs
- Identifica automaticamente tickers que terminam com `34.SA` ou `35.SA`
- Inclui ETFs internacionais específicos (`IVVB11.SA`, `SPXI11.SA`)
- Processamento diferenciado usando Yahoo Finance API

### 2. Lista Completa de BDRs Principais
O sistema inclui uma lista curada dos principais BDRs da B3, organizados por setor:

#### Tecnologia
- `AMZO34.SA` (Amazon), `AAPL34.SA` (Apple), `MSFT34.SA` (Microsoft)
- `GOGL34.SA` (Google), `META34.SA` (Meta), `NVDC34.SA` (NVIDIA)
- `NFLX34.SA` (Netflix), `TSLA34.SA` (Tesla), `UBER34.SA` (Uber)

#### Financeiro
- `JPMC34.SA` (JPMorgan), `BAC34.SA` (Bank of America)
- `V34.SA` (Visa), `MA34.SA` (Mastercard), `BRK34.SA` (Berkshire)

#### Saúde
- `JNJ34.SA` (Johnson & Johnson), `PFE34.SA` (Pfizer)
- `UNH34.SA` (UnitedHealth), `ABBV34.SA` (AbbVie)

#### Consumo
- `KO34.SA` (Coca-Cola), `PEP34.SA` (PepsiCo), `WMT34.SA` (Walmart)
- `MCD34.SA` (McDonald's), `DIS34.SA` (Disney), `NKE34.SA` (Nike)

*E muitos outros... (total de 80+ BDRs principais)*

### 3. Mapeamento de Dados Completo

Os dados do Yahoo Finance são mapeados para os mesmos campos salvos pelo sistema Ward:

#### Indicadores de Valuation
- P/L, P/VP, Dividend Yield, EV/EBITDA, EV/Revenue
- Earnings Yield calculado automaticamente

#### Indicadores de Rentabilidade  
- ROE, ROA, Margens (Bruta, EBITDA, Líquida)
- Crescimento de lucros e receitas

#### Dados Financeiros
- Market Cap, Enterprise Value, Total de Ações
- EBITDA, Receita Total, Fluxo de Caixa
- Total de Caixa, Total de Dívida

#### Dados de Dividendos
- Dividend Yield 12M, Último Dividendo, Payout Ratio
- Datas de ex-dividendo e pagamento

### 4. Integração com Sistema de Carteiras

- **Lista Única**: Combina BDRs das carteiras dos usuários com lista principal
- **Priorização Inteligente**: Intercala BDRs e ações brasileiras para distribuir carga
- **Atualização Automática**: Incluído no cron job de atualização de carteiras

## Como Usar

### 1. Atualização Manual de BDRs

```bash
# Executar atualização completa de BDRs (local)
npm run update:bdr

# Executar em produção
npm run update:bdr:prod
```

### 2. Teste da Integração

```bash
# Testar integração com BDRs principais
npm run test:bdr
```

### 3. Atualização Automática via Cron

O endpoint `/api/cron/update-portfolio-assets` agora inclui automaticamente:
- Detecção de BDRs nas carteiras
- Processamento usando Yahoo Finance
- Lista principal de BDRs importantes

```bash
# Atualização completa (inclui BDRs)
curl -H "Authorization: Bearer $CRON_SECRET" \
     "https://precojusto.ai/api/cron/update-portfolio-assets?mode=full"
```

## Arquitetura Técnica

### Serviços Principais

#### `BDRDataService`
- **Localização**: `src/lib/bdr-data-service.ts`
- **Responsabilidades**:
  - Detecção de BDRs
  - Busca de dados do Yahoo Finance
  - Conversão para formato do banco
  - Criação/atualização de empresas BDR

#### `PortfolioAssetUpdateService` (Modificado)
- **Integração**: Detecta BDRs e usa processamento específico
- **Priorização**: Intercala BDRs e ações brasileiras
- **Lista Única**: Combina carteiras + lista principal

### Fluxo de Processamento

1. **Detecção**: `BDRDataService.isBDR(ticker)`
2. **Busca de Dados**: Yahoo Finance API (Quote + QuoteSummary)
3. **Conversão**: Mapeia campos para schema Prisma
4. **Persistência**: Salva empresa + dados financeiros + cotação

### Campos Mapeados

```typescript
// Exemplo de mapeamento Yahoo Finance → Schema Prisma
{
  pl: quote.trailingPE,
  pvp: quote.priceToBook,
  dy: quote.dividendYield,
  roe: financialData.returnOnEquity,
  marketCap: quote.marketCap,
  ebitda: financialData.ebitda,
  // ... 50+ campos mapeados
}
```

## Monitoramento e Logs

### Logs de Processamento
```
🌎 [TICKER] Detectado como BDR, processando com Yahoo Finance...
📡 Buscando dados do Yahoo Finance para TICKER...
✅ Quote obtido: Company Name
✅ defaultKeyStatistics: dados obtidos
📊 Dados financeiros criados para TICKER (2024)
```

### Métricas de Sucesso
- Total de BDRs processados
- Sucessos vs falhas
- Tempo de processamento
- Campos coletados por BDR

## Limitações e Considerações

### Rate Limiting
- Yahoo Finance: ~1 req/segundo recomendado
- Delays automáticos entre requisições (200ms-2s)
- Retry automático em caso de falha

### Dados Disponíveis
- **Completos**: Indicadores de valuation, rentabilidade, dividendos
- **Limitados**: Dados de balanço detalhados, fluxo de caixa histórico
- **Não Disponíveis**: Alguns indicadores específicos do mercado brasileiro

### Moeda e Conversão
- Dados em USD (empresa original)
- Cotação BDR em BRL (B3)
- Conversão automática quando necessário

## Troubleshooting

### Problemas Comuns

1. **BDR não detectado**
   ```bash
   # Verificar se ticker termina com 34.SA ou 35.SA
   console.log(BDRDataService.isBDR('AMZO34.SA')); // true
   ```

2. **Dados não encontrados**
   ```bash
   # Testar manualmente no Yahoo Finance
   npm run test:bdr
   ```

3. **Rate limiting**
   ```
   ⚠️ Rate limit atingido, aguardando...
   # Sistema aguarda automaticamente
   ```

### Logs de Debug
```bash
# Ativar logs detalhados
DEBUG=bdr:* npm run update:bdr
```

## Roadmap Futuro

### Melhorias Planejadas
- [ ] Histórico de preços BDR via Yahoo Finance
- [ ] Dados fundamentais históricos (balanços, DREs)
- [ ] Conversão automática USD/BRL para comparações
- [ ] Cache inteligente para reduzir chamadas API
- [ ] Alertas específicos para BDRs

### Integrações Futuras
- [ ] Dados de volume e liquidez B3
- [ ] Comparação BDR vs ação original
- [ ] Análise de prêmio/desconto BDR
- [ ] Recomendações específicas para BDRs

## Suporte

Para dúvidas ou problemas com a integração BDR:

1. **Logs**: Verificar logs detalhados do processamento
2. **Teste**: Executar `npm run test:bdr` para diagnóstico
3. **Documentação**: Consultar código em `src/lib/bdr-data-service.ts`
4. **Issues**: Reportar problemas com logs completos