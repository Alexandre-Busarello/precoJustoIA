# Script de Atualização da Tabela financial_data

Este script foi criado para atualizar a tabela `financial_data` com dados históricos da API da Brapi, complementando ou preenchendo campos que estão NULL no banco de dados.

## Funcionalidades

- **Busca dados históricos desde 2010** da API da Brapi PRO
- **Atualiza apenas campos NULL** no banco (preserva dados existentes da Ward)
- **Cria novos registros** para anos que não existem na tabela
- **Processa todas as empresas** do banco ou tickers específicos
- **Paralelismo controlado** (3 empresas simultâneas)
- **Timeout e retry** para robustez
- **Logs detalhados** do progresso

## Pré-requisitos

1. **Token da Brapi PRO**: Configure `BRAPI_TOKEN` no arquivo `.env`
2. **Dependências**: Instale as dependências do projeto (`npm install`)
3. **Banco de dados**: Certifique-se que o Prisma está configurado

## Como usar

### 1. Processar todas as empresas

```bash
# Usando npm script (recomendado)
npm run update:financial-data

# Usando o script de execução
./scripts/run-update-financial-data.js

# Ou diretamente com tsx
npx tsx scripts/update-financial-data-brapi.ts
```

### 2. Processar tickers específicos

```bash
# Usando npm script
npm run update:financial-data PETR4 VALE3 ITUB4

# Usando o script de execução
./scripts/run-update-financial-data.js PETR4 VALE3 ITUB4

# Ou diretamente com tsx
npx tsx scripts/update-financial-data-brapi.ts PETR4 VALE3 ITUB4
```

## O que o script faz

### 1. **Busca dados da Brapi PRO**
- Balanços patrimoniais (anuais)
- Demonstrações de resultado (anuais)
- Fluxos de caixa (anuais)
- Estatísticas-chave (anuais e TTM)
- Dados financeiros (anuais e TTM)
- Dados de dividendos (apenas ano atual)

### 2. **Calcula indicadores derivados**
- P/Ativos, PSR, P/EBIT
- Earnings Yield
- Passivo/Ativos, Giro de Ativos
- ROIC aproximado
- Dívida Líquida/PL

### 3. **Atualiza a tabela financial_data**
- **Campos NULL**: Sempre atualiza se estiver NULL no banco
- **Campos específicos**: Sempre atualiza (forwardPE, trailingEps, variações)
- **Preserva dados da Ward**: Mantém `dataSource` como 'ward+brapi' se já existir
- **Cria novos anos**: Se não existir registro para o ano

## Campos atualizados

### Indicadores de Valuation
- `pl`, `forwardPE`, `earningsYield`, `pvp`, `dy`
- `evEbitda`, `evEbit`, `evRevenue`, `psr`, `pAtivos`
- `pCapGiro`, `pEbit`, `lpa`, `trailingEps`, `vpa`

### Dados de Mercado
- `marketCap`, `enterpriseValue`, `sharesOutstanding`, `totalAssets`

### Indicadores de Endividamento
- `dividaLiquidaPl`, `liquidezCorrente`, `liquidezRapida`
- `passivoAtivos`, `debtToEquity`

### Indicadores de Rentabilidade
- `roe`, `roic`, `roa`, `margemBruta`, `margemEbitda`
- `margemLiquida`, `giroAtivos`

### Crescimento
- `cagrLucros5a`, `crescimentoLucros`, `crescimentoReceitas`

### Dividendos
- `dividendYield12m`, `ultimoDividendo`, `dataUltimoDividendo`
- `dividendoMaisRecente`, `dataDividendoMaisRecente`, `historicoUltimosDividendos`

### Performance
- `variacao52Semanas`, `retornoAnoAtual`

### Dados Financeiros
- `ebitda`, `receitaTotal`, `lucroLiquido`
- `fluxoCaixaOperacional`, `fluxoCaixaInvestimento`, `fluxoCaixaFinanciamento`
- `fluxoCaixaLivre`, `totalCaixa`, `totalDivida`
- `receitaPorAcao`, `caixaPorAcao`

### Balanço Patrimonial
- `ativoCirculante`, `ativoTotal`, `passivoCirculante`
- `passivoTotal`, `patrimonioLiquido`, `caixa`

## Logs e Monitoramento

O script fornece logs detalhados:

```
🏢 Processando PETR4 (ID: 123)...
  📅 Anos encontrados: 2024, 2023, 2022, 2021, 2020 (5 anos)
  📊 Processando dados de 2024 para PETR4...
    ✅ 2024: 15 campos atualizados
  📊 Processando dados de 2023 para PETR4...
    ⏭️  2023: Nenhum campo NULL para atualizar
✅ PETR4: 5 anos processados
```

## Configurações

### Paralelismo
- **3 empresas simultâneas** por padrão
- **Timeout de 3 minutos** por empresa
- **Delay de 2 segundos** entre lotes

### Estratégia de atualização
- **Preserva dados existentes**: Só atualiza campos NULL
- **Campos sempre atualizados**: forwardPE, trailingEps, variações de preço
- **Prioriza Ward**: Se já tem dados da Ward, mantém como 'ward+brapi'

## Tratamento de erros

- **Retry automático**: 2 tentativas com delay crescente
- **Timeout por empresa**: 3 minutos máximo
- **Logs de erro detalhados**: Mostra exatamente o que falhou
- **Continua processamento**: Erro em uma empresa não para as outras

## Exemplo de execução

```bash
$ ./scripts/run-update-financial-data.js PETR4 VALE3

🚀 Iniciando atualização da tabela financial_data com dados da Brapi...
📋 Processando tickers específicos: PETR4, VALE3
📊 Encontradas 2 empresas para processar

📦 Lote 1/1: PETR4, VALE3

🏢 [1/2] Processando PETR4...
🔍 Buscando dados completos da Brapi PRO para PETR4...
✅ Dados completos da Brapi PRO obtidos para PETR4
  📅 Anos encontrados: 2024, 2023, 2022, 2021, 2020, 2019, 2018 (7 anos)
    ✅ 2024: 18 campos atualizados
    ✅ 2023: 12 campos atualizados
    ⏭️  2022: Nenhum campo NULL para atualizar
✅ PETR4: 7 anos processados

🏢 [2/2] Processando VALE3...
✅ VALE3 processado em 45s
📦 Lote processado em 67s: 2 sucessos, 0 falhas

✅ Execução concluída!
📊 Resumo:
   ✅ Empresas processadas: 2
   ❌ Erros: 0
⏱️  Tempo total: 1m 7s
```

## Troubleshooting

### Token da Brapi não configurado
```
❌ BRAPI_TOKEN não configurado no arquivo .env
```
**Solução**: Configure o token no arquivo `.env`

### Empresa não encontrada
```
❌ Nenhuma empresa encontrada com os tickers especificados
```
**Solução**: Verifique se os tickers estão corretos e existem no banco

### Timeout na API
```
❌ Erro ao processar PETR4: timeout of 30000ms exceeded
```
**Solução**: A API da Brapi pode estar lenta, tente novamente

### Erro de conexão com banco
```
❌ Erro geral: Can't reach database server
```
**Solução**: Verifique se o banco está rodando e as credenciais estão corretas
