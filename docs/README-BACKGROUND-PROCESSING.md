# Sistema de Processamento em Background com Controle de Conexões

## Visão Geral

Este sistema foi criado para resolver o problema de esgotamento do pool de conexões do banco de dados durante a execução de scripts de background, especialmente o `fetch-data-ward.ts`.

## Problema Resolvido

- **Antes**: O script usava todas as 10 conexões disponíveis, deixando a aplicação offline
- **Agora**: O script usa no máximo 2-3 conexões, deixando 7-8 disponíveis para a aplicação

## Arquivos Principais

### `prisma-background.ts`
Cliente Prisma otimizado para processos em background com:
- Pool de conexões limitado (configurável via `BACKGROUND_PROCESS_POSTGRES`)
- Controle de operações simultâneas (máximo 2)
- Monitoramento de conexões ativas
- Fila de operações para evitar sobrecarga

### `fetch-data-ward.ts` (Atualizado)
Script principal com melhorias:
- Processamento sequencial ao invés de paralelo
- Controle rigoroso de conexões
- Monitoramento em tempo real
- Delays entre operações para evitar sobrecarga

## Configuração

### 1. Variável de Ambiente

Crie a variável `BACKGROUND_PROCESS_POSTGRES` no seu `.env`:

```bash
# String de conexão com pool limitado para background
BACKGROUND_PROCESS_POSTGRES="postgresql://usuario:senha@localhost:5432/analisador_acoes?connection_limit=3&pool_timeout=20"
```

### 2. Parâmetros da String de Conexão

- `connection_limit=3`: Máximo 3 conexões no pool
- `pool_timeout=20`: Timeout de 20 segundos para obter conexão

## Como Usar

### Executar o Script

```bash
# Processar todos os tickers
npm run fetch-ward

# Processar tickers específicos
npm run fetch-ward PETR4 VALE3 ITUB4

# Forçar atualização completa
npm run fetch-ward --force-full

# Desabilitar complemento Brapi
npm run fetch-ward --no-brapi

# Combinações
npm run fetch-ward PETR4 VALE3 --force-full --no-brapi
```

### Monitoramento

O script agora mostra informações detalhadas:

```
🔗 Conexões ativas: 2/2
📊 Stats de conexão: 1 ativas, 3 na fila, 2 conexões DB
📊 Progresso: 15/100 empresas processadas
```

## Características do Sistema

### Controle de Conexões
- **Máximo simultâneo**: 2 operações de banco
- **Fila inteligente**: Operações aguardam na fila quando limite atingido
- **Monitoramento**: Logs detalhados de uso de conexões

### Processamento Otimizado
- **Paralelo Controlado**: Processa em lotes de 3 empresas por vez
- **Fila Inteligente**: Sistema de conexões gerencia automaticamente
- **Delays**: Pausas entre lotes para dar tempo da fila processar
- **Progresso**: Logs detalhados de progresso por lote

### Cleanup Automático
- **Graceful shutdown**: Aguarda operações terminarem
- **Signal handling**: Responde a SIGINT/SIGTERM
- **Desconexão limpa**: Fecha todas as conexões adequadamente

## Benefícios

1. **Aplicação sempre online**: Nunca usa mais que 3 conexões
2. **Processamento confiável**: Controle rigoroso evita erros de conexão
3. **Monitoramento**: Visibilidade completa do processo
4. **Flexibilidade**: Configurável via variáveis de ambiente

## Troubleshooting

### Script não conecta
```bash
# Verificar se a variável está configurada
echo $BACKGROUND_PROCESS_POSTGRES

# Testar conexão manualmente
psql "$BACKGROUND_PROCESS_POSTGRES"
```

### Muitas conexões ainda
```bash
# Verificar conexões ativas no PostgreSQL
SELECT count(*) FROM pg_stat_activity WHERE datname = 'analisador_acoes';

# Reduzir limite se necessário
BACKGROUND_PROCESS_POSTGRES="...?connection_limit=2&pool_timeout=30"
```

### Performance lenta
```bash
# Aumentar delays entre operações
# Editar prisma-background.ts e aumentar delayBetweenBatches
```

## Configurações Avançadas

### Ajustar Limites

No arquivo `prisma-background.ts`:

```typescript
const MAX_CONCURRENT_CONNECTIONS = 2; // Alterar conforme necessário
```

### Ajustar Delays

No arquivo `fetch-data-ward.ts`:

```typescript
delayBetweenBatches: number = 200 // Aumentar para mais delay
```

## Logs e Debugging

O sistema produz logs detalhados:

- `🔗 Conexões ativas`: Status atual das conexões
- `⏳ Operação adicionada à fila`: Operação aguardando
- `📊 Stats de conexão`: Estatísticas completas
- `🔄 Aguardando operações terminarem`: Cleanup em andamento

## Compatibilidade

- ✅ Funciona com PostgreSQL
- ✅ Compatível com Prisma 5.x
- ✅ Suporta todas as funcionalidades existentes
- ✅ Não quebra código existente
