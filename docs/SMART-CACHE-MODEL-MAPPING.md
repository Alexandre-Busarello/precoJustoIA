# Smart Query Cache - Mapeamento de Models

## 📋 Visão Geral

Sistema de cache inteligente que automaticamente detecta tabelas afetadas por queries do Prisma e invalida o cache quando necessário. Esta documentação cobre as melhorias recentes para suportar corretamente o mapeamento de models do Prisma Client para nomes de tabelas no banco de dados.

## 🔧 Problema Resolvido

### Problema Original

O sistema não estava extraindo corretamente os nomes das tabelas devido a dois problemas:

1. **Formato Turbopack/Webpack**: O código transformado usa `["prisma"].model` ao invés de `prisma.model`
   ```typescript
   // Código original
   prisma.aIReport.findFirst({ ... })
   
   // Após build do Turbopack
   ["prisma"].aIReport.findFirst({ ... })
   ```

2. **Mapeamento Model → Tabela**: Models do Prisma usam camelCase (ex: `aIReport`), mas tabelas no banco usam snake_case (ex: `ai_reports`)
   ```typescript
   // Model no Prisma Client
   prisma.aIReport
   
   // Tabela no banco de dados
   ai_reports
   
   // Conversão automática camelToSnakeCase resultava em:
   a_i_report ❌ // Incorreto!
   ```

### Exemplo do Problema

```typescript
// Log do sistema (ANTES da correção)
operationString: ()=>["prisma"].aIReport.findFirst({ where: { companyId: 1 } })
tables: Set(0) {} // ❌ Nenhuma tabela extraída!

// Log do sistema (DEPOIS da correção)
operationString: ()=>["prisma"].aIReport.findFirst({ where: { companyId: 1 } })
tables: Set(1) { 'ai_reports' } // ✅ Tabela correta!
```

## ✅ Solução Implementada

### 1. Padrões Regex Atualizados

Adicionados padrões que capturam múltiplos formatos:

```typescript
const TABLE_PATTERNS = [
  /prisma\.(\w+)\./g,              // prisma.user. (tradicional)
  /\["prisma"\]\.(\w+)\./g,        // ["prisma"].user. (Turbopack/webpack)
  /prisma\[['"](\w+)['"]\]/g,      // prisma['user'] (acesso dinâmico)
  /FROM\s+(\w+)/gi,                // SQL: FROM tableName
  /UPDATE\s+(\w+)/gi,              // SQL: UPDATE tableName
  /INSERT\s+INTO\s+(\w+)/gi,       // SQL: INSERT INTO tableName
  /DELETE\s+FROM\s+(\w+)/gi,       // SQL: DELETE FROM tableName
  /JOIN\s+(\w+)/gi,                // SQL: JOIN tableName
]
```

### 2. Mapeamento Prisma Client → Tabelas

Criado mapeamento completo baseado no `schema.prisma` com `@@map`:

```typescript
const PRISMA_MODEL_TO_TABLE: Record<string, string> = {
  // Auth & Users
  'user': 'users',
  'session': 'Session',
  'passwordResetToken': 'password_reset_tokens',
  
  // Companies & Market Data
  'company': 'companies',
  'financialData': 'financial_data',
  'dailyQuote': 'daily_quotes',
  'historicalPrice': 'historical_prices',
  
  // AI Reports (o caso problema!)
  'aIReport': 'ai_reports',           // ✅ Correto!
  'aIReportFeedback': 'ai_report_feedbacks',
  
  // Backtest
  'backtestConfig': 'backtest_configs',
  'backtestAsset': 'backtest_assets',
  'backtestResult': 'backtest_results',
  
  // ... e mais 20+ mapeamentos
}
```

### 3. Lógica de Extração Melhorada

Atualizada para usar mapeamento com fallback:

```typescript
static extractTableNames(operationString: string): string[] {
  const tables = new Set<string>()
  
  TABLE_PATTERNS.forEach(pattern => {
    const matches = operationString.matchAll(pattern)
    for (const match of matches) {
      if (match[1]) {
        const modelName = match[1]
        
        // ✅ Primeiro tentar mapeamento direto
        if (PRISMA_MODEL_TO_TABLE[modelName]) {
          tables.add(PRISMA_MODEL_TO_TABLE[modelName])
        } else {
          // Fallback: converter camelCase para snake_case
          const tableName = this.camelToSnakeCase(modelName)
          tables.add(tableName)
        }
      }
    }
  })
  
  return Array.from(tables)
}
```

## 🧪 Como Testar

### Teste Rápido no Console

```typescript
import { SmartQueryCache } from '@/lib/smart-query-cache'

// Testar extração de tabela
const operation = `["prisma"].aIReport.findFirst({ where: { companyId: 1 } })`
const tables = SmartQueryCache.extractTableNames(operation)
console.log(tables) // ['ai_reports'] ✅

// Validar mapeamento de um model
const validation = SmartQueryCache.validateModelMapping('aIReport')
console.log(validation)
// {
//   isMapped: true,
//   tableName: 'ai_reports'
// }
```

### Teste Completo

Execute o arquivo de exemplos:

```bash
npx tsx examples/smart-cache-model-mapping.ts
```

Saída esperada:

```
🧪 INICIANDO TESTES DO SMART QUERY CACHE

=== VALIDAÇÃO DE MAPEAMENTOS ===

✅ aIReport              -> ai_reports
✅ aIReportFeedback      -> ai_report_feedbacks
✅ user                  -> users
✅ company               -> companies
✅ financialData         -> financial_data
✅ backtestConfig        -> backtest_configs

=== TESTE DE DIFERENTES FORMATOS ===

Formato 1: [ 'users' ]
Formato 2: [ 'users' ]
Formato 3: [ 'users' ]
Formato 4: [ 'users' ]

✅ TESTES CONCLUÍDOS
```

## 🔄 Como Funciona o Sistema

### 1. Query de Leitura (Cacheada)

```typescript
// Query de leitura
const report = await prisma.aIReport.findFirst({
  where: { companyId: 1 }
})

// O que acontece internamente:
// 1. Detecta que é query de leitura (findFirst)
// 2. Extrai tabela: aIReport -> ai_reports
// 3. Gera chave de cache: query-ai_reports-{hash}
// 4. Busca no cache (Redis/Memory)
//    - Se existe: retorna do cache ⚡
//    - Se não existe: executa query, cacheia por 1h, retorna
```

### 2. Query de Escrita (Invalida Cache)

```typescript
// Query de escrita
await prisma.aIReport.create({
  data: {
    companyId: 1,
    content: 'Novo relatório',
    status: 'GENERATING'
  }
})

// O que acontece internamente:
// 1. Detecta que é query de escrita (create)
// 2. Extrai tabela: aIReport -> ai_reports
// 3. Executa a operação
// 4. Invalida cache de ai_reports + dependências
//    - Limpa: query-ai_reports-*
//    - Limpa: query-companies-* (dependência)
//    - Limpa: query-ai_report_feedbacks-* (dependência)
```

### 3. Dependências Entre Tabelas

Quando uma tabela é modificada, o cache de tabelas relacionadas também é invalidado:

```typescript
const TABLE_DEPENDENCIES: Record<string, string[]> = {
  'ai_reports': ['companies', 'ai_reports', 'ai_report_feedbacks'],
  'companies': ['companies', 'financial_data', 'daily_quotes', 'key_statistics'],
  'users': ['users', 'portfolios', 'portfolio_assets', 'ranking_history'],
  // ... mais dependências
}
```

## 🚀 Como Usar no Código

### Uso com Prisma Wrapper

O sistema já está integrado no `prisma-wrapper.ts`:

```typescript
import { prisma } from '@/lib/prisma'

// Automaticamente cacheado!
const report = await prisma.aIReport.findFirst({
  where: { companyId: 1, status: 'GENERATING' }
})

// Automaticamente invalida cache!
await prisma.aIReport.update({
  where: { id: reportId },
  data: { status: 'COMPLETED' }
})
```

### Uso Direto do Smart Cache

```typescript
import { smartCache } from '@/lib/smart-query-cache'

// Executar query com cache
const result = await smartCache.execute(
  'minha-query-complexa',
  async () => {
    return await prisma.aIReport.findMany({ ... })
  }
)

// Invalidar cache manualmente
await smartCache.invalidate(['ai_reports'])

// Limpar todo o cache
await smartCache.clear()

// Ver estatísticas
const stats = await smartCache.stats()
```

## 📝 Manutenção

### Adicionar Novo Model no Prisma

Sempre que adicionar um novo model no `schema.prisma`:

1. **Atualizar `PRISMA_MODEL_TO_TABLE`** em `src/lib/smart-query-cache.ts`:

```typescript
const PRISMA_MODEL_TO_TABLE: Record<string, string> = {
  // ... models existentes
  'novoModel': 'nova_tabela',  // Adicionar aqui!
}
```

2. **Atualizar `TABLE_DEPENDENCIES`** se houver relações:

```typescript
const TABLE_DEPENDENCIES: Record<string, string[]> = {
  // ... dependências existentes
  'nova_tabela': ['nova_tabela', 'tabela_relacionada'],
}
```

3. **Testar o mapeamento**:

```typescript
const result = SmartQueryCache.validateModelMapping('novoModel')
console.log(result) // Deve retornar isMapped: true
```

### Descobrir Nome do Model no Client

Se não tiver certeza do nome do model no Prisma Client:

```typescript
// 1. Abra o arquivo gerado do Prisma Client
// node_modules/.prisma/client/index.d.ts

// 2. Procure pelo model
// Exemplo: AIReport vira aIReport no client

// 3. Teste no código
console.log(typeof prisma.aIReport) // 'object' se existe
```

## 🐛 Debugging

### Habilitar Logs Detalhados

Descomente a linha de debug em `extractTableNames()`:

```typescript
static extractTableNames(operationString: string): string[] {
  // ...
  
  // Debug: descomentar para ver tabelas extraídas
  if (tables.size > 0) {
    console.log(`📊 Tabelas extraídas (${tables.size}):`, Array.from(tables))
  }
  
  return Array.from(tables)
}
```

### Ver Logs de Cache

Os logs automáticos já mostram:

```
📦 Cache MISS: get-ai-report (query-ai_reports-a1b2c3d4)
💾 Query cacheada: get-ai-report (TTL: 3600s)
✍️ Query de escrita detectada: update-ai-report
🗑️ Invalidando cache assíncrono para tabelas: ai_reports, companies
✅ Cache invalidado assíncrono: 15 chaves para 2 tabelas
```

### Verificar Chaves no Redis

```bash
# Listar todas as chaves de cache
redis-cli KEYS "analisador-acoes:query-*"

# Ver chaves de uma tabela específica
redis-cli KEYS "analisador-acoes:query-ai_reports*"

# Limpar cache de uma tabela
redis-cli DEL $(redis-cli KEYS "analisador-acoes:query-ai_reports*")
```

## 📊 Performance

### Métricas Esperadas

- **Cache Hit Rate**: 70-90% para queries de leitura
- **Tempo de Resposta**:
  - Cache Hit: 5-10ms
  - Cache Miss: 50-500ms (depende da query)
- **Invalidação**: < 50ms (assíncrona, não bloqueia)

### Monitoramento

```typescript
// Ver estatísticas do cache
const stats = await smartCache.stats()
console.log(`Total de chaves: ${stats.totalKeys}`)
console.log(`Top tabelas: ${stats.topTables.join(', ')}`)
```

## 🔒 Segurança

- ✅ Queries user-specific não são cacheadas
- ✅ Queries com sessão não são cacheadas
- ✅ Invalidação automática em operações de escrita
- ✅ TTL de 1 hora para evitar dados desatualizados

## 📚 Referências

- [Prisma Client API](https://www.prisma.io/docs/concepts/components/prisma-client)
- [Redis Cache Patterns](https://redis.io/docs/manual/patterns/)
- [Turbopack Build](https://turbo.build/pack/docs)



