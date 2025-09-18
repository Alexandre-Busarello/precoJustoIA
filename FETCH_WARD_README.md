# 📊 Fetch Ward Data - Guia de Execução

Este guia explica como executar o script de fetch de dados da Ward API tanto localmente quanto na Vercel.

## 🏠 Execução Local

### Comandos Disponíveis:

```bash
# Executar localmente (método tradicional)
npm run fetch:data:ward

# Executar localmente via helper
npm run fetch:ward:local

# Executar empresa específica
npm run fetch:data:ward PETR4

# Executar múltiplas empresas
npm run fetch:data:ward PETR4 BBAS3 VALE3

# Executar sem complemento da Brapi
npm run fetch:data:ward PETR4 --no-brapi

# Forçar atualização completa
npm run fetch:data:ward PETR4 --force-full
```

## ☁️ Execução na Vercel

### 1. Configurar Variáveis de Ambiente na Vercel:

```bash
# Variáveis necessárias (adicionar no dashboard da Vercel):
DATABASE_URL="sua-database-url"
DIRECT_URL="sua-direct-url"
BACKGROUND_PROCESS_POSTGRES="sua-background-url"
BRAPI_TOKEN="seu-brapi-token"
GEMINI_API_KEY="sua-gemini-key"
WARD_JWT_TOKEN="seu-ward-jwt-token"
FETCH_API_SECRET="seu-secret-para-api"
CRON_SECRET="seu-secret-para-cron"
```

### 2. Execução Manual via API:

```bash
# Executar remotamente via API
npm run fetch:ward:remote

# Ou via curl diretamente:
curl -X POST https://seu-dominio.vercel.app/api/fetch-ward-data \
  -H "Authorization: Bearer SEU_FETCH_API_SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "tickers": ["PETR4", "BBAS3"],
    "noBrapi": false,
    "forceFullUpdate": false
  }'
```

### 3. Execução Automática via Cron:

O cron job está configurado para executar **diariamente às 2:00 AM** (UTC).

- **Endpoint**: `/api/cron/fetch-ward`
- **Frequência**: `0 2 * * *` (2:00 AM todos os dias)
- **Timeout**: 5 minutos (máximo da Vercel)

## 📋 Endpoints da API

### POST `/api/fetch-ward-data`
Execução manual com parâmetros customizados.

**Headers:**
```
Authorization: Bearer SEU_FETCH_API_SECRET
Content-Type: application/json
```

**Body:**
```json
{
  "tickers": ["PETR4", "BBAS3"],  // Opcional: empresas específicas
  "noBrapi": false,               // Opcional: desabilitar Brapi
  "forceFullUpdate": false        // Opcional: forçar atualização completa
}
```

### GET `/api/cron/fetch-ward`
Execução automática via cron (processa todas as empresas).

**Headers:**
```
Authorization: Bearer SEU_CRON_SECRET
```

## ⏱️ Medição de Tempo

O script agora inclui medição automática de tempo:

```
🚀 Iniciando fetch de dados da Ward API... [18/09/2025 14:30:00]
...
✅ Fetch de dados da Ward concluído!
⏱️  Tempo total de processamento: 15m 32s
📅 Finalizado em: 18/09/2025 14:45:32
```

## 🔧 Configuração do Cron na Vercel

O arquivo `vercel.json` já está configurado:

```json
{
  "crons": [
    {
      "path": "/api/cron/fetch-ward",
      "schedule": "0 2 * * *"
    }
  ],
  "functions": {
    "src/app/api/fetch-ward-data/route.ts": {
      "maxDuration": 300
    },
    "src/app/api/cron/fetch-ward/route.ts": {
      "maxDuration": 300
    }
  }
}
```

## 🚨 Limitações da Vercel

- **Timeout máximo**: 5 minutos (300 segundos)
- **Memória**: Limitada pelo plano
- **Execuções simultâneas**: Limitadas

Para processamento de muitas empresas, considere:
1. Dividir em lotes menores
2. Usar processamento sequencial (já implementado)
3. Monitorar logs para identificar gargalos

## 📊 Monitoramento

### Logs na Vercel:
1. Acesse o dashboard da Vercel
2. Vá em "Functions" → "View Function Logs"
3. Filtre por `/api/cron/fetch-ward` ou `/api/fetch-ward-data`

### Logs Locais:
Os logs incluem:
- Progresso detalhado por empresa
- Estatísticas de processamento
- Tempo total de execução
- Erros detalhados

## 🔐 Segurança

- **FETCH_API_SECRET**: Para execução manual via API
- **CRON_SECRET**: Para execução automática via cron
- **Tokens de API**: Mantenha seguros e rodem periodicamente

## 🆘 Troubleshooting

### Erro de Timeout:
- Reduza o número de empresas processadas
- Use `--no-brapi` para acelerar
- Verifique conexão com banco de dados

### Erro de Autenticação:
- Verifique se as variáveis de ambiente estão configuradas
- Confirme se os secrets estão corretos

### Erro de Conexão com Banco:
- Verifique `DATABASE_URL` e `DIRECT_URL`
- Confirme se o banco está acessível da Vercel
