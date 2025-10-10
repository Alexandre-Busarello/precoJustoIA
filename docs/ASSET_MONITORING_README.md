# 📊 Asset Monitoring System - Documentação Completa

Sistema de monitoramento de ativos que permite usuários se inscreverem em ações específicas para receberem notificações automáticas por email quando houver mudanças relevantes nos fundamentos.

---

## 📋 Índice

1. [Visão Geral](#visão-geral)
2. [Arquitetura](#arquitetura)
3. [Fluxo de Dados](#fluxo-de-dados)
4. [Componentes](#componentes)
5. [Configuração](#configuração)
6. [Como Usar](#como-usar)
7. [Troubleshooting](#troubleshooting)
8. [Manutenção](#manutenção)

---

## 🎯 Visão Geral

### Funcionalidades

- ✅ **Inscrição em Ativos**: Usuários podem se inscrever para monitorar ações específicas
- 📸 **Snapshots Automáticos**: Sistema cria "fotografias" periódicas dos fundamentos de cada ativo
- 🔍 **Detecção de Mudanças**: Compara Score Geral atual com snapshot anterior
- 🤖 **Relatórios com IA**: Gera análises comparativas usando Gemini AI
- 📧 **Notificações por Email**: Envia emails automáticos aos inscritos
- 📊 **Dashboard de Gestão**: Interface para gerenciar inscrições

### Como Funciona

1. Usuário se inscreve em um ativo (ex: BBSE3)
2. Cron job roda a cada 6 horas processando lote de empresas
3. Sistema calcula Score Geral atual e compara com snapshot anterior
4. Se mudança > 5 pontos: gera relatório com IA e notifica inscritos
5. Atualiza snapshot para próxima comparação

---

## 🏗️ Arquitetura

### Diagrama de Fluxo

```
User Interface (Subscription Button)
        ↓
API Endpoints (/api/asset-subscriptions)
        ↓
Database (UserAssetSubscription, AssetSnapshot)
        ↓
Vercel Cron Job (a cada 6 horas)
        ↓
Asset Monitoring Service → Company Analysis
        ↓
Score Comparison → Change Detection
        ↓
Monitoring Report Service → Gemini AI
        ↓
Email Service → User Notification
```

### Models no Banco de Dados

#### `UserAssetSubscription`
```prisma
model UserAssetSubscription {
  id        String   @id @default(cuid())
  userId    String
  companyId Int
  createdAt DateTime @default(now())
  
  user      User     @relation(...)
  company   Company  @relation(...)
  
  @@unique([userId, companyId])
}
```

#### `AssetSnapshot`
```prisma
model AssetSnapshot {
  id            String   @id @default(cuid())
  companyId     Int      @unique
  snapshotData  Json     // Dados completos do ativo
  overallScore  Decimal
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
}
```

#### `AIReport` (Modificado)
```prisma
model AIReport {
  // ... campos existentes
  type              AIReportType   @default(MONTHLY_OVERVIEW)
  changeDirection   String?        // 'positive', 'negative'
  previousScore     Decimal?
  currentScore      Decimal?
}
```

---

## 🔄 Fluxo de Dados

### 1. Inscrição do Usuário

**Frontend** → `AssetSubscriptionButton.tsx`
- Verifica autenticação
- Toggle de inscrição/cancelamento
- Feedback visual

**Backend** → `POST /api/asset-subscriptions/by-ticker/[ticker]`
- Valida usuário autenticado
- Verifica se empresa existe
- Cria `UserAssetSubscription` (unique constraint previne duplicatas)

### 2. Processamento em Background

**Cron Job** → `/api/cron/monitor-assets`

```typescript
// Executado a cada 6 horas
export const maxDuration = 300; // 5 minutos

1. Buscar próximo lote (20 empresas)
2. Para cada empresa:
   - Buscar dados atuais (company-analysis-service)
   - Calcular Overall Score
   - Verificar se existe snapshot
   - Se não existe: criar primeiro snapshot
   - Se existe: comparar scores
   - Se mudança > 5 pontos:
     * Gerar relatório via Gemini
     * Atualizar snapshot
     * Enviar emails aos inscritos
   - Atualizar lastCheckedAt
3. Retornar estatísticas da execução
```

### 3. Geração de Relatório

**Monitoring Report Service** → `monitoring-report-service.ts`

```typescript
generateChangeReport({
  ticker,
  name,
  previousData,      // Dados do snapshot
  currentData,       // Dados atuais
  previousScore,
  currentScore,
  changeDirection,   // 'positive' | 'negative'
})
```

**Prompt para Gemini:**
- Contexto comparativo (anterior vs atual)
- Estrutura: Resumo + Mudanças + Impacto + Recomendação
- Output: Markdown formatado

### 4. Notificação por Email

**Email Service** → `sendAssetChangeEmail()`

**Template inclui:**
- Badge de mudança (verde/vermelho)
- Comparação visual de scores (8.5 → 9.2)
- Resumo executivo do relatório
- CTA para ver relatório completo
- Link para página do ativo

---

## 🧩 Componentes

### Services

#### `AssetMonitoringService`
- `createOrUpdateSnapshot()`: Cria/atualiza snapshot
- `getSnapshot()`: Busca snapshot existente
- `compareScores()`: Detecta mudança significativa
- `getSubscribersForCompany()`: Lista emails de inscritos
- `getNextBatchToProcess()`: Busca próximo lote ordenado por `lastCheckedAt`
- `updateLastChecked()`: Atualiza timestamp após processamento

#### `MonitoringReportService`
- `generateChangeReport()`: Gera relatório com IA
- `buildComparisonPrompt()`: Constrói prompt para Gemini
- `saveReport()`: Salva no banco com type='FUNDAMENTAL_CHANGE'
- `getChangeReports()`: Lista relatórios de mudança
- `getReport()`: Busca relatório específico

### API Endpoints

| Endpoint | Method | Descrição |
|----------|--------|-----------|
| `/api/asset-subscriptions` | GET | Lista inscrições do usuário |
| `/api/asset-subscriptions` | POST | Cria nova inscrição |
| `/api/asset-subscriptions/[id]` | DELETE | Cancela inscrição por ID |
| `/api/asset-subscriptions/by-ticker/[ticker]` | GET | Verifica inscrição em ticker |
| `/api/asset-subscriptions/by-ticker/[ticker]` | POST | Inscreve em ticker |
| `/api/asset-subscriptions/by-ticker/[ticker]` | DELETE | Cancela inscrição em ticker |
| `/api/cron/monitor-assets` | GET | Cron job de monitoramento |

### UI Components

#### `AssetSubscriptionButton`
- Toggle de inscrição/cancelamento
- Estados: loading, subscribed, not subscribed
- Integrado na página `/acao/[ticker]`

#### `SubscriptionsList`
- Grid responsivo de cards
- Info da empresa com logo
- Ações: ver ativo, cancelar inscrição
- Estado vazio com CTA

### Pages

- `/dashboard/subscriptions`: Gestão de inscrições
- `/acao/[ticker]`: Botão de inscrição integrado

---

## ⚙️ Configuração

### Variáveis de Ambiente

Adicionar ao `.env`:

```bash
# Asset Monitoring Configuration
MONITORING_BATCH_SIZE="20"              # Empresas por execução
MONITORING_SCORE_THRESHOLD="5"          # Delta mínimo de score
NEXT_PUBLIC_BASE_URL="https://..."     # URL base para links
```

### Cron Job Schedule

Configurado em `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/monitor-assets",
      "schedule": "0 */6 * * *"  // A cada 6 horas
    }
  ],
  "functions": {
    "src/app/api/cron/monitor-assets/route.ts": {
      "maxDuration": 300  // 5 minutos
    }
  }
}
```

### Configuração do Prisma

Após atualizar schema:

```bash
npx prisma db push
npx prisma generate
```

### Smart Query Cache

Já configurado em `smart-query-cache.ts`:

```typescript
PRISMA_MODEL_TO_TABLE: {
  'userAssetSubscription': 'user_asset_subscriptions',
  'assetSnapshot': 'asset_snapshots',
}

TABLE_DEPENDENCIES: {
  'user_asset_subscriptions': ['users', 'companies', 'user_asset_subscriptions'],
  'asset_snapshots': ['companies', 'asset_snapshots'],
}
```

---

## 💡 Como Usar

### Para Usuários

1. **Inscrever-se:**
   - Acessar página de um ativo (ex: `/acao/bbse3`)
   - Clicar em "Receber Atualizações"
   - Sistema confirma inscrição

2. **Gerenciar:**
   - Acessar `/dashboard/subscriptions`
   - Visualizar todos os ativos monitorados
   - Cancelar inscrições individualmente

3. **Receber Notificações:**
   - Email automático quando houver mudança > 5 pontos no Score
   - Relatório detalhado com análise comparativa
   - Link direto para relatório completo

### Para Desenvolvedores

#### Testar Localmente

```bash
# 1. Inscrever-se em um ativo via UI
# 2. Simular processamento manual
curl -X GET http://localhost:3000/api/cron/monitor-assets \
  -H "Authorization: Bearer $CRON_SECRET"
```

#### Monitorar Logs

```bash
# Vercel CLI
vercel logs --follow

# Filtrar por função
vercel logs --function=api/cron/monitor-assets
```

#### Criar Teste Manual

Ver `/scripts/test-asset-monitoring.ts` (a ser criado)

---

## 🔧 Troubleshooting

### Problemas Comuns

#### 1. Emails não estão sendo enviados

**Possíveis causas:**
- `EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASS` não configurados
- Firewall bloqueando porta 587
- Gmail requer App Password (não senha normal)

**Solução:**
```bash
# Verificar configuração
echo $EMAIL_HOST
echo $EMAIL_USER

# Testar envio manual (criar script de teste)
```

#### 2. Cron job não executa

**Possíveis causas:**
- `CRON_SECRET` incorreto
- Configuração no `vercel.json` incorreta
- Deploy não enviou alterações

**Solução:**
```bash
# Verificar deploy
vercel ls

# Verificar crons
vercel cron ls

# Testar manualmente
curl -X GET https://seu-dominio.vercel.app/api/cron/monitor-assets \
  -H "Authorization: Bearer $CRON_SECRET"
```

#### 3. Timeout no Cron Job

**Sintoma:** Job termina antes de processar todas empresas

**Solução:**
- Reduzir `MONITORING_BATCH_SIZE` (padrão: 20)
- Job já tem controle de tempo (270s de 300s disponíveis)
- Próxima execução pegará empresas não processadas

#### 4. Relatórios não são gerados

**Possíveis causas:**
- `GEMINI_API_KEY` não configurada
- Rate limit da API Gemini
- Dados insuficientes para análise

**Solução:**
```bash
# Verificar key
echo $GEMINI_API_KEY

# Ver logs de erro
vercel logs | grep "Erro ao gerar relatório"
```

#### 5. Snapshots não atualizam

**Possível causa:** `lastCheckedAt` não atualiza por erro

**Solução:**
- Sistema já tem proteção: atualiza `lastCheckedAt` mesmo com erro
- Verificar logs para identificar erro específico

---

## 🛠️ Manutenção

### Monitoramento

#### Métricas Importantes

- **Empresas processadas por execução**: Deve ser ~20 (batch size)
- **Taxa de mudanças detectadas**: Varia (depende do mercado)
- **Tempo de execução**: Deve ser < 5 minutos
- **Taxa de erro**: Deve ser < 5%

#### Logs a Observar

```typescript
// Início
🕐 Iniciando cron job de monitoramento de ativos...

// Processamento
🔍 Processando BBSE3 (ID: 123)...
📈 BBSE3: Score atual = 8.5
🔄 BBSE3: Score anterior = 7.2, Delta = 1.3
🚨 BBSE3: Mudança positive detectada!
📝 BBSE3: Relatório gerado
📧 BBSE3: Enviando emails para 5 inscritos

// Resumo
✅ Empresas processadas: 20
📸 Snapshots criados: 3
🔔 Mudanças detectadas: 2
📝 Relatórios gerados: 2
📧 Emails enviados: 8
⏱️  Tempo total: 4m 23s
```

### Otimizações Futuras

1. **Cache de Análises**: Cachear análises estratégicas por 1h
2. **Rate Limiting Gemini**: Implementar fila para evitar rate limit
3. **Webhook para Snapshots**: Trigger imediato quando dados atualizados
4. **Digest Diário**: Opção de receber resumo diário em vez de notificações imediatas
5. **Níveis de Alerta**: Permitir usuário configurar threshold personalizado

### Limpeza de Dados

```sql
-- Remover snapshots antigos (> 90 dias)
DELETE FROM asset_snapshots 
WHERE updated_at < NOW() - INTERVAL '90 days';

-- Remover relatórios antigos não visualizados
DELETE FROM ai_reports 
WHERE type = 'FUNDAMENTAL_CHANGE' 
AND created_at < NOW() - INTERVAL '180 days';
```

### Backup

Importante fazer backup de:
- `user_asset_subscriptions`: Preservar inscrições dos usuários
- `asset_snapshots`: Histórico de mudanças
- `ai_reports`: Relatórios gerados

---

## 📊 Estatísticas e Análise

### Queries Úteis

```sql
-- Total de inscrições ativas
SELECT COUNT(*) FROM user_asset_subscriptions;

-- Empresas mais monitoradas
SELECT c.ticker, c.name, COUNT(*) as subscribers
FROM user_asset_subscriptions uas
JOIN companies c ON c.id = uas.company_id
GROUP BY c.ticker, c.name
ORDER BY subscribers DESC
LIMIT 10;

-- Relatórios gerados por tipo de mudança
SELECT change_direction, COUNT(*) 
FROM ai_reports 
WHERE type = 'FUNDAMENTAL_CHANGE'
GROUP BY change_direction;

-- Taxa de engajamento (emails enviados vs abertos)
-- Requer integração com serviço de email analytics
```

---

## 🚀 Próximos Passos

### Fase 1 (Implementado)
- ✅ Database schema
- ✅ API endpoints
- ✅ UI components
- ✅ Background processing
- ✅ Email notifications

### Fase 2 (Planejado)
- [ ] Páginas de visualização de relatórios
- [ ] Histórico de mudanças por ativo
- [ ] Filtros e busca na lista de inscrições
- [ ] Configurações de notificação (frequência, threshold)

### Fase 3 (Futuro)
- [ ] Notificações push (web push)
- [ ] Telegram/WhatsApp notifications
- [ ] Análise preditiva (ML)
- [ ] Alertas personalizados por indicador

---

## 📞 Suporte

Para questões ou problemas:
- Email: busamar@gmail.com
- Criar issue no repositório
- Consultar logs no Vercel Dashboard

---

**Última atualização:** 10/10/2025
**Versão:** 1.0.0

