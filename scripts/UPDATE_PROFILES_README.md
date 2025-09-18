# Script de Atualização de Perfis de Empresas

Este script atualiza os campos `sector`, `industry` e `description` das empresas que estão com valores nulos ou vazios no banco de dados.

## Funcionalidades

- 🔍 Busca empresas com campos faltantes no banco
- 📡 Obtém dados do `summaryProfile` da API Brapi
- 🌐 Traduz os textos usando Gemini AI
- 💾 Atualiza os registros no banco de dados
- 🔄 Processamento em lotes com paralelismo controlado
- ⚡ Sistema de retry e timeout para robustez

## Pré-requisitos

### Variáveis de Ambiente Necessárias

```bash
# Obrigatório para tradução
GEMINI_API_KEY=sua_chave_do_gemini

# Opcional para melhor acesso à Brapi
BRAPI_TOKEN=seu_token_da_brapi

# Configuração do banco (já deve estar configurada)
DATABASE_URL=sua_url_do_banco
```

## Como Usar

### 1. Executar para todas as empresas com campos faltantes

```bash
# Usando npm script (recomendado)
npm run update:profiles

# Usando o script de execução
node scripts/run-update-profiles.js

# Ou diretamente com tsx
npx tsx scripts/update-company-profiles.ts
```

### 2. Executar para tickers específicos

```bash
# Para empresas específicas (usando npm)
npm run update:profiles -- PETR4 VALE3 ITUB4

# Usando o script de execução
node scripts/run-update-profiles.js PETR4 VALE3 ITUB4

# Ou diretamente
npx tsx scripts/update-company-profiles.ts PETR4 VALE3 ITUB4
```

### 3. Modo dry-run (apenas visualizar, sem alterar)

```bash
# Ver quais empresas seriam processadas sem fazer alterações (usando npm)
npm run update:profiles:dry

# Usando o script de execução
node scripts/run-update-profiles.js --dry-run

# Com tickers específicos
npm run update:profiles -- PETR4 VALE3 --dry-run
node scripts/run-update-profiles.js PETR4 VALE3 --dry-run
```

### 4. Configurar paralelismo e tamanho dos lotes

```bash
# Processar 5 empresas por lote com 3 threads paralelas (usando npm)
npm run update:profiles -- --batch-size=5 --concurrency=3

# Usando o script de execução
node scripts/run-update-profiles.js --batch-size=5 --concurrency=3

# Configuração mais conservadora (padrão)
npm run update:profiles -- --batch-size=3 --concurrency=2
```

## Parâmetros Disponíveis

| Parâmetro | Descrição | Padrão |
|-----------|-----------|---------|
| `--dry-run` | Apenas simula, não faz alterações | false |
| `--batch-size=N` | Número de empresas por lote | 3 |
| `--concurrency=N` | Número de threads paralelas | 2 |
| `TICKER1 TICKER2` | Processar apenas tickers específicos | Todas |

## Exemplos de Uso

### Exemplo 1: Primeira execução completa
```bash
# Ver quantas empresas precisam de atualização
npm run update:profiles:dry

# Executar a atualização
npm run update:profiles
```

### Exemplo 2: Atualizar empresas específicas
```bash
# Verificar campos faltantes de empresas específicas
npm run update:profiles -- PETR4 VALE3 ITUB4 --dry-run

# Atualizar essas empresas
npm run update:profiles -- PETR4 VALE3 ITUB4
```

### Exemplo 3: Processamento rápido
```bash
# Usar mais paralelismo para processar mais rápido
npm run update:profiles -- --batch-size=5 --concurrency=4
```

## Saída do Script

O script fornece logs detalhados do progresso:

```
🚀 Iniciando atualização de perfis de empresas... [18/09/2025 14:30:00]

🔧 Configurações:
   📦 Tamanho do lote: 3
   🔄 Paralelismo: 2
   🧪 Modo dry-run: ❌ Desativado

🔍 Buscando empresas com campos faltantes...
📋 Encontradas 45 empresas com campos faltantes
   📊 Campos faltantes: 15 setores, 20 indústrias, 32 descrições

📦 Lote 1/15: PETR4, VALE3, ITUB4

🏢 Atualizando perfil de PETR4 - Petróleo Brasileiro S.A. - Petrobras
   📋 Campos faltantes: setor, descrição
   🔍 Buscando dados básicos da Brapi para PETR4...
   ✅ Dados básicos obtidos da Brapi para PETR4
   🏭 Traduzindo setor: "Energy"
   🌐 Traduzindo setor com Gemini AI...
   ✅ Setor traduzido com sucesso pelo Gemini
   ✅ Setor traduzido: "Energia"
   📝 Traduzindo descrição (1250 caracteres)
   🌐 Traduzindo descrição da empresa com Gemini AI...
   ✅ Descrição da empresa traduzida com sucesso pelo Gemini
   ✅ Descrição traduzida (1280 caracteres)
✅ Perfil atualizado para PETR4: sector, description

📦 Lote 1 concluído em 15s: 3 sucessos, 0 falhas
📊 Progresso geral: 3/45 empresas processadas (3 sucessos, 0 falhas)
```

## Campos Atualizados

O script atualiza os seguintes campos da tabela `Company`:

- **`sector`**: Setor da empresa (traduzido para português)
- **`industry`**: Indústria/ramo da empresa (traduzido para português)  
- **`description`**: Descrição detalhada da empresa (traduzida para português)

## Tratamento de Erros

- ✅ Retry automático para falhas de rede
- ✅ Timeout por empresa (60s) e por lote
- ✅ Continuação do processamento mesmo com falhas individuais
- ✅ Log detalhado de erros para debugging
- ✅ Fallback para texto original se tradução falhar

## Performance

- **Paralelismo**: Processa múltiplas empresas simultaneamente
- **Lotes**: Agrupa empresas para otimizar o processamento
- **Rate Limiting**: Delay entre lotes para não sobrecarregar APIs
- **Timeouts**: Evita travamentos em empresas problemáticas

## Monitoramento

O script fornece estatísticas em tempo real:
- Progresso por lote e geral
- Tempo de processamento
- Contadores de sucesso/falha
- Campos específicos atualizados por empresa

## Troubleshooting

### Erro: "GEMINI_API_KEY não configurado"
- Configure a variável de ambiente `GEMINI_API_KEY`
- Obtenha uma chave em: https://makersuite.google.com/app/apikey

### Erro: "Rate limit atingido"
- Reduza o paralelismo: `--concurrency=1`
- Aumente o tamanho do lote: `--batch-size=1`
- Aguarde alguns minutos antes de tentar novamente

### Erro: "Timeout"
- Verifique sua conexão com a internet
- Reduza o paralelismo para diminuir a carga
- Execute para tickers específicos primeiro

### Empresas não encontradas na Brapi
- Algumas empresas podem não ter dados na Brapi
- O script continua processando as outras empresas
- Verifique se o ticker está correto
