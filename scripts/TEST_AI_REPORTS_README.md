# Testes Ponta a Ponta: Sistema de Relatórios de IA Expandido

Este documento descreve os scripts de teste para validar o funcionamento completo do sistema de relatórios de IA expandido.

## 📋 Pré-requisitos

1. **Variáveis de Ambiente**: Configure `.env.local` com:
   ```bash
   DATABASE_URL="sua_connection_string"
   GEMINI_API_KEY="sua_chave_gemini"
   CRON_SECRET="seu_secret_cron"
   NEXT_PUBLIC_BASE_URL="http://localhost:3000"  # Para testes locais
   ```

2. **Banco de Dados**: Execute a migration do Prisma:
   ```bash
   npx prisma migrate dev --name add_ai_reports_expansion
   ```

3. **Servidor Rodando** (para testes de endpoints):
   ```bash
   npm run dev
   ```

## 🧪 Scripts de Teste

### 1. Teste: Price Variation Service

Testa a detecção de variações de preço e criação de entradas na fila.

```bash
# Testar um ticker específico
npx tsx scripts/test-price-variation-service.ts PETR4

# Testar múltiplos tickers
npx tsx scripts/test-price-variation-service.ts PETR4 VALE3 ITUB4
```

**O que testa:**
- Busca de preços históricos (1 dia, 30 dias, 365 dias)
- Cálculo de variações percentuais
- Detecção de gatilhos baseados em thresholds
- Criação de entradas na fila `ai_reports_queue`

**Saída esperada:**
- Variações calculadas para cada janela de tempo
- Indicação se algum gatilho foi disparado
- Detalhes da entrada criada na fila

---

### 2. Teste: Custom Trigger Service

Testa a criação e avaliação de gatilhos customizados.

```bash
# Testar avaliação de gatilhos existentes
npx tsx scripts/test-custom-trigger-service.ts PETR4

# Criar gatilho de teste e avaliar
npx tsx scripts/test-custom-trigger-service.ts PETR4 --create-trigger
```

**O que testa:**
- Criação de gatilhos customizados
- Avaliação de condições (P/L, P/VP, Score, Preço)
- Criação de entradas na fila quando gatilho é disparado

**Saída esperada:**
- Lista de gatilhos ativos
- Avaliação de cada gatilho
- Motivos de disparo (se houver)
- Detalhes da entrada criada na fila

---

### 3. Teste: AI Report Queue Service

Testa o sistema de fila e checkpointing.

```bash
# Testar funcionalidades da fila
npx tsx scripts/test-ai-report-queue.ts

# Criar entradas de teste e testar
npx tsx scripts/test-ai-report-queue.ts --create-test-entry
```

**O que testa:**
- Busca de próximos itens da fila
- Marcação como PROCESSING
- Determinação de próxima etapa
- Salvamento e recuperação de checkpoints
- Listagem de todas as entradas

**Saída esperada:**
- Lista de entradas na fila
- Status de processamento
- Checkpoints salvos por etapa
- Próxima etapa a ser processada

---

### 4. Teste: Price Variation Report Service

Testa a geração completa de relatório de variação de preço.

```bash
npx tsx scripts/test-price-variation-report.ts PETR4
```

**O que testa:**
- Pesquisa na internet sobre motivo da queda
- Análise de impacto fundamental (perda de fundamento ou não)
- Geração de relatório completo
- Criação de flag se necessário

**Saída esperada:**
- Resultado da pesquisa na internet
- Análise de impacto fundamental
- Relatório completo em markdown
- Flag criado (se for perda de fundamento)

**⚠️ Requer:** `GEMINI_API_KEY` configurada

---

### 5. Teste: Custom Trigger Report Service

Testa a geração de relatório de gatilho customizado.

```bash
npx tsx scripts/test-custom-trigger-report.ts PETR4
```

**O que testa:**
- Explicação do motivo do disparo
- Conteúdo educativo sobre os indicadores
- Geração de relatório completo

**Saída esperada:**
- Relatório completo explicando o gatilho
- Conteúdo educativo sobre indicadores
- Recomendações para o investidor

---

### 6. Teste: Cron Endpoints

Testa os endpoints de cron via HTTP.

```bash
# Testar todos os crons
npx tsx scripts/test-cron-endpoints.ts all

# Testar cron específico
npx tsx scripts/test-cron-endpoints.ts monitor-price-variations
npx tsx scripts/test-cron-endpoints.ts monitor-custom-triggers
npx tsx scripts/test-cron-endpoints.ts generate-ai-reports
```

**O que testa:**
- Endpoint de monitoramento de preços
- Endpoint de monitoramento de gatilhos customizados
- Endpoint de geração de relatórios

**⚠️ Requer:** Servidor rodando (`npm run dev`)

**Saída esperada:**
- Status HTTP da resposta
- Estatísticas de processamento
- Número de entradas criadas/processadas

---

### 7. Teste: API Endpoints

Testa os endpoints de API para gerenciar gatilhos e consultar flags.

```bash
npx tsx scripts/test-api-endpoints.ts
```

**O que testa:**
- Criação de gatilhos customizados
- Listagem de gatilhos
- Atualização de gatilhos
- Remoção de gatilhos
- Consulta de flags de empresa

**Saída esperada:**
- Gatilhos criados/listados
- Flags encontrados
- Operações de CRUD bem-sucedidas

---

### 8. Teste: Fluxo Completo End-to-End

Testa o fluxo completo desde detecção até geração de relatório.

```bash
npx tsx scripts/test-full-flow.ts PETR4
```

**O que testa:**
- Todas as etapas do fluxo completo:
  1. Detecção de variação de preço
  2. Criação de entrada na fila
  3. Pesquisa na internet (RESEARCH)
  4. Análise de impacto (ANALYSIS)
  5. Geração de relatório (COMPILATION)
  6. Criação de flag se necessário
  7. Finalização da fila

**Saída esperada:**
- Progresso de cada etapa
- Relatório final gerado
- Flag criado (se aplicável)
- Resumo completo do processamento

**⚠️ Requer:** `GEMINI_API_KEY` configurada

---

## 🔄 Ordem Recomendada de Testes

1. **Teste básico de serviços:**
   ```bash
   npx tsx scripts/test-price-variation-service.ts PETR4
   npx tsx scripts/test-custom-trigger-service.ts PETR4 --create-trigger
   npx tsx scripts/test-ai-report-queue.ts --create-test-entry
   ```

2. **Teste de geração de relatórios:**
   ```bash
   npx tsx scripts/test-price-variation-report.ts PETR4
   npx tsx scripts/test-custom-trigger-report.ts PETR4
   ```

3. **Teste de endpoints (requer servidor rodando):**
   ```bash
   # Em outro terminal
   npm run dev
   
   # No terminal de testes
   npx tsx scripts/test-cron-endpoints.ts all
   npx tsx scripts/test-api-endpoints.ts
   ```

4. **Teste completo end-to-end:**
   ```bash
   npx tsx scripts/test-full-flow.ts PETR4
   ```

## 🐛 Troubleshooting

### Erro: "Empresa não encontrada"
- Verifique se o ticker existe no banco de dados
- Use `npx tsx scripts/fetch-data.ts PETR4` para criar empresa

### Erro: "GEMINI_API_KEY não configurada"
- Configure a variável no `.env.local`
- Verifique se a chave é válida

### Erro: "Nenhuma variação significativa detectada"
- Use um ticker com queda recente
- Ou ajuste os thresholds no `.env.local`:
  ```bash
  PRICE_DROP_1D=1   # 1% para facilitar teste
  PRICE_DROP_30D=5  # 5% para facilitar teste
  ```

### Erro: "Connection refused" (testes de endpoints)
- Certifique-se de que o servidor está rodando (`npm run dev`)
- Verifique se `NEXT_PUBLIC_BASE_URL` está correto

### Erro: "Não autorizado" (cron endpoints)
- Verifique se `CRON_SECRET` está configurado corretamente
- O secret deve corresponder ao usado no servidor

## 📊 Validação de Resultados

Após executar os testes, verifique:

1. **Banco de Dados:**
   ```sql
   -- Verificar entradas na fila
   SELECT * FROM ai_reports_queue ORDER BY created_at DESC LIMIT 10;
   
   -- Verificar checkpoints
   SELECT * FROM ai_reports_queue_processing ORDER BY completed_at DESC LIMIT 10;
   
   -- Verificar relatórios gerados
   SELECT id, type, status, created_at FROM ai_reports WHERE type IN ('PRICE_VARIATION', 'CUSTOM_TRIGGER') ORDER BY created_at DESC LIMIT 10;
   
   -- Verificar flags criados
   SELECT * FROM company_flags ORDER BY created_at DESC LIMIT 10;
   
   -- Verificar gatilhos customizados
   SELECT * FROM user_asset_monitor WHERE is_active = true LIMIT 10;
   ```

2. **Logs do Servidor** (se testando endpoints):
   - Verificar logs de processamento
   - Verificar erros de timeout
   - Verificar criação de notificações/emails

## ✅ Checklist de Validação

- [ ] Price Variation Service detecta variações corretamente
- [ ] Custom Trigger Service avalia condições corretamente
- [ ] Queue Service gerencia fila e checkpointing
- [ ] Price Variation Report gera relatório com pesquisa
- [ ] Custom Trigger Report gera relatório explicativo
- [ ] Crons processam entradas corretamente
- [ ] API endpoints funcionam (CRUD de gatilhos)
- [ ] Flags são criados quando necessário
- [ ] Emails são adicionados à fila corretamente
- [ ] Fluxo completo funciona end-to-end

