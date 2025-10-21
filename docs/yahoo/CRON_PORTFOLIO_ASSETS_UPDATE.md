# Cron Job: Atualização Inteligente de Ativos de Carteira

## 📋 Visão Geral

Sistema de atualização periódica e inteligente de dados de ativos presentes em carteiras. Atualiza:

- ✅ **Histórico de preços** (incremental - apenas dados novos)
- ✅ **Histórico de dividendos** (incremental - apenas dados novos)
- ✅ **Dados gerais dos ativos** (atualização completa)

## 🎯 Objetivo

Manter os dados de ativos **sempre atualizados** sem sobrecarregar o sistema durante o uso da aplicação. O Analytics da carteira agora busca apenas 3 anos de dados, e o cron job mantém o histórico completo atualizado em background.

## 🏗️ Arquitetura

### Serviço Principal
**Arquivo**: `src/lib/portfolio-asset-update-service.ts`

#### Métodos Disponíveis:

1. **`updateAllPortfolioAssets()`**
   - Atualização completa: preços, dividendos e dados gerais
   - Recomendado: Executar **diariamente** após o fechamento do mercado

2. **`updateHistoricalPricesOnly()`**
   - Apenas preços históricos
   - Mais rápido
   - Recomendado: Executar **várias vezes ao dia** se necessário

3. **`updateDividendsOnly()`**
   - Apenas dividendos
   - Recomendado: Executar **semanalmente** ou **mensalmente**

### Endpoint da API
**URL**: `GET /api/cron/update-portfolio-assets`

#### Query Parameters:
- `mode=full` - Atualização completa (padrão)
- `mode=prices` - Apenas preços
- `mode=dividends` - Apenas dividendos

#### Headers Required:
```
Authorization: Bearer YOUR_CRON_SECRET
```
ou
```
x-cron-secret: YOUR_CRON_SECRET
```

## 🔒 Segurança

### 1. Configurar Secret

Adicionar ao arquivo `.env`:

```bash
CRON_SECRET=your-super-secret-random-string-here
```

**Gerar secret seguro**:
```bash
# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# OpenSSL
openssl rand -hex 32
```

### 2. Proteção

- ❌ **Sem secret configurado**: Funciona apenas em desenvolvimento
- ✅ **Com secret**: Requerido em produção
- 🔐 **Headers**: Suporta `Authorization: Bearer` ou `x-cron-secret`

## ⚙️ Configuração do Cron Job

### Opção 1: Vercel Cron Jobs (Recomendado para deploy Vercel)

Adicionar ao `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/update-portfolio-assets?mode=full",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Schedule**: `0 2 * * *` = Todo dia às 2h da manhã (UTC)

### Opção 2: cron-job.org (Gratuito)

1. Acessar https://cron-job.org
2. Criar nova tarefa:
   - **URL**: `https://seu-dominio.com/api/cron/update-portfolio-assets?mode=full`
   - **Schedule**: `0 2 * * *`
   - **Headers**: 
     ```
     x-cron-secret: seu_secret_aqui
     ```

### Opção 3: EasyCron

Similar ao cron-job.org, mas com mais opções de monitoramento.

### Opção 4: Servidor Linux com crontab

```bash
# Editar crontab
crontab -e

# Adicionar linha (diariamente às 2h)
0 2 * * * curl -X GET "https://seu-dominio.com/api/cron/update-portfolio-assets?mode=full" \
  -H "x-cron-secret: seu_secret_aqui"
```

## 📅 Frequências Recomendadas

### Produção

| Modo | Frequência | Schedule (cron) | Horário | Justificativa |
|------|-----------|-----------------|---------|---------------|
| **full** | Diário | `0 2 * * *` | 02:00 UTC | Após fechamento B3 |
| **prices** | 2x/dia | `0 2,14 * * *` | 02:00, 14:00 UTC | Manhã e tarde |
| **dividends** | Semanal | `0 3 * * 1` | Segunda 03:00 UTC | Menos frequente |

### Desenvolvimento

- **full**: Executar manualmente quando necessário
- Não agendar crons em dev

## 🚀 Como Executar Manualmente

### Via cURL

```bash
# Atualização completa
curl -X GET "http://localhost:3000/api/cron/update-portfolio-assets?mode=full" \
  -H "x-cron-secret: your_secret_here"

# Apenas preços
curl -X GET "http://localhost:3000/api/cron/update-portfolio-assets?mode=prices" \
  -H "x-cron-secret: your_secret_here"

# Apenas dividendos
curl -X GET "http://localhost:3000/api/cron/update-portfolio-assets?mode=dividends" \
  -H "x-cron-secret: your_secret_here"
```

### Via Navegador (Dev)

Em desenvolvimento sem CRON_SECRET configurado:

```
http://localhost:3000/api/cron/update-portfolio-assets?mode=full
```

## 📊 Response Format

### Sucesso

```json
{
  "success": true,
  "mode": "full",
  "summary": {
    "totalTickers": 25,
    "processedTickers": 25,
    "failedTickers": [],
    "updatedHistoricalPrices": 450,
    "updatedDividends": 120,
    "updatedAssets": 25,
    "duration": 125000,
    "errors": []
  },
  "timestamp": "2025-10-20T15:30:00.000Z"
}
```

### Erro

```json
{
  "success": false,
  "error": "Error message",
  "timestamp": "2025-10-20T15:30:00.000Z"
}
```

## 🧠 Inteligência do Sistema

### Atualização Incremental de Preços

1. **Verifica última data no banco**:
   ```sql
   SELECT MAX(date) FROM historical_prices WHERE company_id = X AND interval = '1mo'
   ```

2. **Busca apenas dados novos**:
   - Se última data: 2025-01-01
   - Busca: 2025-02-01 até hoje
   - Economiza: ~99% das requisições

3. **Primeira vez**:
   - Busca últimos 10 anos
   - Execuções futuras serão incrementais

### Atualização Incremental de Dividendos

1. **Usa `upsert`** para evitar duplicatas
2. **Atualiza `ultimoDividendo` e `dataUltimoDividendo`** na Company
3. **Ignora dividendos já cadastrados**

### Deduplicação de Tickers

- Busca `DISTINCT` de todas as carteiras ativas
- Cada ticker é processado apenas 1 vez
- Se ticker está em 10 carteiras, atualiza apenas 1 vez

## ⚡ Performance

### Otimizações

| Feature | Benefício |
|---------|-----------|
| **Batch processing** | Evita connection pool exhaustion |
| **Incremental updates** | 99% menos dados buscados |
| **Rate limiting** | 1s delay entre tickers |
| **Deduplication** | 1 update por ticker único |
| **Sequential processing** | Estável e confiável |

### Tempo Estimado

| Quantidade de Ativos | Tempo Estimado (full) |
|---------------------|----------------------|
| 10 ativos | ~30 segundos |
| 25 ativos | ~1-2 minutos |
| 50 ativos | ~3-4 minutos |
| 100 ativos | ~6-8 minutos |

## 📝 Logs

### Formato

```
=============================================================
🕐 [CRON JOB] Iniciando atualização de ativos - Modo: full
   Timestamp: 2025-10-20T02:00:00.000Z
=============================================================

🚀 [PORTFOLIO ASSETS UPDATE] Iniciando atualização de ativos...
📊 [UPDATE] Encontrados 25 ativos distintos em carteiras

[1/25] 🔄 Processando PETR4...
📅 [PETR4] Última data no banco: 2025-09-01
📊 [YAHOO] PETR4: 3 pontos encontrados
✅ [DB] Salvos 3 pontos históricos no banco
📊 [DIVIDENDS] Buscando dividendos para PETR4...
✅ [DIVIDENDS] PETR4: 2 dividendos salvos
✅ [PETR4] Atualizado: 3 preços, 2 dividendos

[2/25] 🔄 Processando VALE3...
...

✅ [PORTFOLIO ASSETS UPDATE] Atualização concluída!
📊 Resumo:
   - Total de ativos: 25
   - Processados: 25
   - Falharam: 0
   - Preços atualizados: 75
   - Dividendos atualizados: 50
   - Tempo total: 125.45s

=============================================================
✅ [CRON JOB] Atualização concluída com sucesso
=============================================================
```

## 🐛 Troubleshooting

### Erro: "Unauthorized"

**Causa**: CRON_SECRET incorreto ou ausente

**Solução**:
1. Verificar `.env` tem `CRON_SECRET` configurado
2. Verificar header está correto: `x-cron-secret: seu_secret`
3. Em dev sem secret, endpoint funciona normalmente

### Erro: "Connection pool timeout"

**Causa**: Muitos ativos sendo processados simultaneamente

**Solução**: Já implementado batch processing. Se persistir:
1. Reduzir `BATCH_SIZE` em `historical-data-service.ts`
2. Aumentar delay entre tickers em `portfolio-asset-update-service.ts`

### Alguns tickers falhando

**Normal**: Alguns ativos podem não estar disponíveis no Yahoo Finance

**Solução**: 
- Sistema continua com próximo ticker
- Verifica array `failedTickers` no response
- Logs mostram quais tickers falharam

## 🔄 Integração com Analytics

### Antes (Lento)

```
Analytics solicita dados
  ↓
Busca 20 anos de histórico para cada ativo
  ↓
Timeout / Lento
```

### Depois (Rápido)

```
Analytics solicita dados
  ↓
Busca apenas 3 anos (rápido)
  ↓
Cron mantém histórico completo atualizado em background
  ↓
Dados sempre disponíveis
```

## 📈 Monitoramento

### Métricas Importantes

1. **Duration**: Tempo total de execução
2. **ProcessedTickers**: Quantos foram atualizados
3. **FailedTickers**: Quantos falharam
4. **UpdatedHistoricalPrices**: Quantos pontos de preço novos
5. **UpdatedDividends**: Quantos dividendos novos

### Alertas Sugeridos

- ⚠️ **Se failedTickers > 20%**: Investigar problema com Yahoo Finance API
- ⚠️ **Se duration > 15 minutos**: Muitos ativos ou problema de performance
- ⚠️ **Se updatedHistoricalPrices = 0**: Pode ser fim de semana ou feriado

## 📚 Arquivos Relacionados

| Arquivo | Propósito |
|---------|-----------|
| `src/lib/portfolio-asset-update-service.ts` | Serviço principal |
| `src/app/api/cron/update-portfolio-assets/route.ts` | Endpoint API |
| `src/lib/historical-data-service.ts` | Busca dados históricos |
| `src/lib/dividend-service.ts` | Busca dividendos |
| `src/lib/asset-registration-service.ts` | Registra ativos |
| `src/lib/portfolio-analytics-service.ts` | Usa dados atualizados |

---

**Data de Criação**: 20 de Outubro de 2025  
**Versão**: 1.0  
**Status**: ✅ Pronto para Produção

