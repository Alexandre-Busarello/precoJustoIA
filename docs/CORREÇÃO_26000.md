# Correção do Erro 26000 - Prepared Statement Does Not Exist

## 🚨 Problema
Erro `26000: prepared statement "s1" does not exist` ao usar Prisma com PostgreSQL e connection pooling.

## ✅ Solução Padrão (SEM Gambiarras!)

### **Por que acontece?**
O PostgreSQL com connection pooling pode "perder" prepared statements entre requests, causando o erro 26000.

### **Solução Simples:**
Desabilitar prepared statements na URL de conexão.

### 1. **Schema Prisma Simples**
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 2. **URL com prepared_statements=false**
```bash
DATABASE_URL="postgres://usuario:senha@host:5432/database?prepared_statements=false&pgbouncer=true&connection_limit=1"
```

### 3. **Prisma Client Padrão**
```typescript
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error'] : [],
});
```

### **Parâmetros Importantes:**
- `prepared_statements=false` - **RESOLVE O PROBLEMA**
- `pgbouncer=true` - Otimização para pooling
- `connection_limit=1` - Evita múltiplas conexões

## 🔧 Passos para Aplicar

1. **Copie suas URLs reais**:
   ```bash
   cp env.local.example .env
   # Edite .env com suas credenciais reais
   ```

2. **Regenere o cliente Prisma**:
   ```bash
   npx prisma generate
   ```

3. **Teste a conexão**:
   ```bash
   npm run dev
   ```

## 🎯 Por que Funciona na Vercel?

Na Vercel, o Prisma usa **serverless functions** que:
- Não mantêm conexões persistentes
- Não sofrem com prepared statements órfãos
- Cada request é uma nova conexão

No localhost, as conexões são **persistentes**, causando conflitos de prepared statements.

## 🔍 Debug

Se o erro persistir, verifique os logs:
```
🔄 Erro de prepared statement detectado (tentativa 1/2). Limpando prepared statements...
✅ Prepared statements limpos com sucesso
```

## 📋 Checklist

- [ ] Schema atualizado com `url` e `directUrl` corretos
- [ ] Arquivo `.env` criado com URLs corretas
- [ ] `prepared_statements=false` nas URLs
- [ ] Cliente Prisma regenerado
- [ ] Aplicação testada localmente

## 🆘 Se Ainda Não Funcionar

1. **Teste sem Accelerate**: Use apenas `POSTGRES_URL` em ambos os campos
2. **Verifique conectividade**: `npx prisma db pull`
3. **Limpe cache**: `rm -rf node_modules/.prisma && npx prisma generate`
