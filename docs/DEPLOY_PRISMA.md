# Configuração de Deploy com Prisma na Vercel

Este documento explica como o projeto está configurado para executar automaticamente as migrations do Prisma durante o build na Vercel.

## Configuração Implementada

### 1. Scripts no package.json

```json
{
  "scripts": {
    "build": "node scripts/build-with-migrations.js",
    "build:vercel": "node scripts/build-with-migrations.js",
    "postinstall": "prisma generate",
    "db:migrate": "prisma migrate deploy",
    "db:push": "prisma db push",
    "db:generate": "prisma generate"
  }
}
```

### 2. Arquivo vercel.json

```json
{
  "buildCommand": "npm run build:vercel",
  "installCommand": "npm install",
  "env": {
    "PRISMA_GENERATE_DATAPROXY": "true"
  },
  "functions": {
    "app/api/**/*.ts": {
      "maxDuration": 30
    }
  },
  "regions": ["gru1"]
}
```

### 3. Script de Build Personalizado

O arquivo `scripts/build-with-migrations.js` executa:

1. **Prisma Generate**: Gera o cliente Prisma
2. **DB Push**: Aplica mudanças do schema ao banco
3. **Migrate Deploy**: Executa migrations pendentes (se existirem)
4. **Next Build**: Constrói a aplicação

## Como Funciona

### Durante o Deploy na Vercel:

1. A Vercel executa `npm install`
2. O hook `postinstall` executa `prisma generate`
3. A Vercel executa o `buildCommand` definido no `vercel.json`
4. O script personalizado executa as migrations e o build

### Quando o schema.prisma é modificado:

1. **Desenvolvimento Local**: Execute `npm run db:push` para aplicar mudanças
2. **Deploy**: As mudanças são aplicadas automaticamente durante o build
3. **Migrations**: Se você criou migrations com `prisma migrate dev`, elas serão aplicadas com `prisma migrate deploy`

## Variáveis de Ambiente Necessárias

Configure estas variáveis no painel da Vercel:

```bash
DATABASE_URL="sua-connection-string-do-banco"
DIRECT_URL="sua-direct-connection-string" # Se usando Supabase/PgBouncer
PRISMA_GENERATE_DATAPROXY="true"
NEXTAUTH_SECRET="seu-secret-key"
# ... outras variáveis do seu projeto
```

## Comandos Úteis

```bash
# Desenvolvimento local
npm run dev                    # Inicia o servidor de desenvolvimento
npm run db:push               # Aplica mudanças do schema ao banco
npm run db:generate           # Gera o cliente Prisma

# Migrations
npx prisma migrate dev        # Cria e aplica migration em desenvolvimento
npm run db:migrate            # Aplica migrations em produção

# Build local (simula o processo da Vercel)
npm run build                 # Executa o processo completo de build
```

## Troubleshooting

### Erro de Migration
Se houver erro durante a migration, o script tentará usar `db push` como fallback.

### Timeout na Vercel
As funções API têm timeout de 30 segundos. Se precisar de mais tempo, ajuste no `vercel.json`.

### Problemas de Conexão
Verifique se as variáveis `DATABASE_URL` e `DIRECT_URL` estão corretas no painel da Vercel.

## Fluxo Recomendado

1. **Desenvolvimento**: Faça mudanças no `schema.prisma`
2. **Local**: Execute `npm run db:push` para testar
3. **Commit**: Faça commit das mudanças
4. **Deploy**: Push para o GitHub - a Vercel executará automaticamente as migrations

## Observações Importantes

- O `db push` é usado em vez de migrations para mudanças simples de schema
- Para mudanças complexas, use `prisma migrate dev` localmente e depois faça deploy
- O script é tolerante a falhas - se uma etapa falhar, tenta alternativas
- Logs detalhados são exibidos durante o build para facilitar debugging
