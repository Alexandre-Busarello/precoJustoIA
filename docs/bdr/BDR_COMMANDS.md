# Comandos BDR - Guia Rápido

## Comandos Disponíveis

### Teste da Integração BDR
```bash
# Testar integração com BDRs principais
npm run test:bdr
```

### Atualização de BDRs
```bash
# Atualizar BDRs (ambiente local) - modo misto
npm run update:bdr

# Atualizar BDRs (ambiente de produção) - modo misto
npm run update:bdr:prod

# Atualizar BDRs (modo básico) - apenas dados atuais
npm run update:bdr:basic

# Atualizar BDRs (modo completo) - com dados históricos
npm run update:bdr:complete
```

### Atualização Geral (inclui BDRs automaticamente)
```bash
# Atualização completa de todos os ativos das carteiras (inclui BDRs)
npm run monitor:run
```

## O que cada comando faz

### `npm run test:bdr`
- Testa 8 BDRs principais (Amazon, Apple, Microsoft, Google, Tesla, Coca-Cola, Walmart, Disney)
- Verifica detecção automática de BDRs
- Testa busca de dados do Yahoo Finance
- Valida conversão de dados para formato do banco
- Mostra estrutura de dados coletados
- **Não salva dados no banco** (apenas teste)

### `npm run update:bdr`
- Executa atualização mista de BDRs via API `/api/cron/update-portfolio-assets`
- Processa BDRs das carteiras + lista principal (80+ BDRs)
- Inclui dados básicos + alguns históricos do earnings chart
- Salva dados no banco de dados
- Requer servidor Next.js rodando (`npm run dev`)

### `npm run update:bdr:prod`
- Mesmo que `update:bdr` mas para ambiente de produção
- Usa URL de produção configurada

### `npm run update:bdr:basic`
- Executa atualização básica de BDRs (modo `bdr`)
- Apenas dados financeiros atuais (TTM)
- Mais rápido: 3-5 minutos para 80+ BDRs
- Ideal para atualizações frequentes

### `npm run update:bdr:complete`
- Executa atualização completa de BDRs (modo `bdr-complete`)
- Inclui TODOS os dados históricos disponíveis
- Balanços, DREs, DFCs, preços e dividendos históricos
- Mais lento: 10-15 minutos para 80+ BDRs
- Ideal para setup inicial ou atualizações completas

## Logs e Monitoramento

### Logs de Sucesso
```
🌎 [TICKER] Detectado como BDR, processando com Yahoo Finance...
📡 Buscando dados do Yahoo Finance para TICKER...
✅ Quote obtido: Company Name
✅ defaultKeyStatistics: dados obtidos
✅ financialData: dados obtidos
📊 Dados financeiros criados para TICKER (2024)
✅ [BDR] TICKER processado com sucesso
```

### Logs de Erro Comuns
```
❌ [BDR] Erro ao buscar dados para TICKER: Request failed
⚠️ [BDR] Dados não disponíveis para TICKER
❌ [BDR] Erro ao processar TICKER: Timeout
```

## Dados Coletados

### Indicadores de Valuation
- P/L, P/VP, Dividend Yield
- EV/EBITDA, EV/Revenue
- Earnings Yield (calculado)
- PSR, P/Ativos (calculados)

### Indicadores de Rentabilidade
- ROE, ROA
- Margens (Bruta, EBITDA, Líquida)
- Crescimento de lucros e receitas

### Dados Financeiros
- Market Cap, Enterprise Value
- EBITDA, Receita Total, Lucro Líquido
- Fluxo de Caixa Operacional e Livre
- Total de Caixa e Dívida

### Dados de Dividendos
- Dividend Yield 12M
- Último dividendo e data
- Payout Ratio

## Troubleshooting

### Problema: "CRON_SECRET não configurado"
```bash
# Adicionar ao .env
CRON_SECRET="seu-secret-aqui"
```

### Problema: "Servidor não está rodando"
```bash
# Iniciar servidor Next.js
npm run dev
```

### Problema: "Rate limiting do Yahoo Finance"
- O sistema já inclui delays automáticos (500ms entre requisições)
- Em caso de muitos erros, aguardar alguns minutos antes de tentar novamente

### Problema: "BDR não detectado"
- Verificar se o ticker termina com `34.SA` ou `35.SA`
- Alguns ETFs internacionais também são suportados (`IVVB11.SA`, `SPXI11.SA`)

## Lista de BDRs Principais

### Tecnologia (20 BDRs)
AMZO34.SA, AAPL34.SA, MSFT34.SA, GOGL34.SA, META34.SA, NVDC34.SA, NFLX34.SA, TSLA34.SA, ADBE34.SA, CRM34.SA, ORCL34.SA, PYPL34.SA, UBER34.SA, SPOT34.SA, TWTR34.SA, SNAP34.SA, ZOOM34.SA, SQ34.SA, SHOP34.SA, ROKU34.SA

### Financeiro (10 BDRs)
JPMC34.SA, BAC34.SA, WFC34.SA, GS34.SA, MS34.SA, V34.SA, MA34.SA, AXP34.SA, BRK34.SA, C34.SA

### Saúde (10 BDRs)
JNJ34.SA, PFE34.SA, UNH34.SA, ABBV34.SA, MRK34.SA, BMY34.SA, LLY34.SA, GILD34.SA, AMGN34.SA, BIIB34.SA

### Consumo (14 BDRs)
KO34.SA, PEP34.SA, WMT34.SA, MCD34.SA, SBUX34.SA, NKE34.SA, DIS34.SA, HD34.SA, LOW34.SA, TGT34.SA, COST34.SA, PG34.SA, UL34.SA, CL34.SA

### Energia (8 BDRs)
XOM34.SA, CVX34.SA, COP34.SA, SLB34.SA, HAL34.SA, FCX34.SA, NEM34.SA, GOLD34.SA

### Industriais (10 BDRs)
BA34.SA, CAT34.SA, GE34.SA, MMM34.SA, HON34.SA, UPS34.SA, FDX34.SA, LMT34.SA, RTX34.SA, NOC34.SA

### Outros Setores (18+ BDRs)
Telecomunicações, Utilidades, REITs, Semicondutores, ETFs

**Total: 80+ BDRs principais da B3**

## Integração com Carteiras

O sistema automaticamente:
1. Detecta BDRs nas carteiras dos usuários
2. Combina com lista principal de BDRs
3. Remove duplicatas
4. Processa todos os BDRs únicos
5. Salva dados no mesmo formato das ações brasileiras

Isso garante que qualquer BDR adicionado a uma carteira seja automaticamente processado com dados completos do Yahoo Finance.