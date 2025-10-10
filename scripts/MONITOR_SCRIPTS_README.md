# 🧪 Scripts de Monitoramento de Ativos

Scripts para testar e executar o sistema de monitoramento de ativos localmente.

---

## 📋 Scripts Disponíveis

### 1. `npm run monitor:run`

Executa o cron job completo de monitoramento localmente.

**Uso:**
```bash
# Executar localmente (requer servidor Next.js rodando)
npm run monitor:run

# Executar em produção
npm run monitor:run -- --production
```

**Pré-requisitos:**
- Servidor Next.js rodando: `npm run dev`
- Variável `CRON_SECRET` configurada no `.env`

**O que faz:**
- Processa lote de empresas (20 por padrão)
- Cria/atualiza snapshots
- Detecta mudanças significativas
- Gera relatórios com IA
- Simula envio de emails (ou envia de verdade se configurado)
- Retorna estatísticas completas

**Saída esperada:**
```
🚀 Executando monitoramento de ativos...
📍 Ambiente: LOCAL
🔗 URL: http://localhost:3000/api/cron/monitor-assets

⏳ Executando... (isso pode levar alguns minutos)

📊 ===== RESULTADO =====

✅ Status: Sucesso
⏱️  Tempo de execução: 245.32s

📈 Estatísticas:
  • Empresas processadas: 20
  • Snapshots criados: 3
  • Mudanças detectadas: 2
  • Relatórios gerados: 2
  • Emails enviados: 5

📅 Timestamp: 2025-10-10T14:32:15.123Z
```

---

### 2. `npm run monitor:test <TICKER>`

**⚠️  ATENÇÃO: Este script ENVIA EMAILS DE VERDADE para usuários inscritos!**

Executa um teste de ponta a ponta completo do sistema de monitoramento para um ticker específico.

**Uso:**
```bash
# Teste simples
npm run monitor:test BBSE3

# Forçar mudança para testar geração de relatório
npm run monitor:test PETR4 -- --force-change

# Simular score específico
npm run monitor:test VALE3 -- --simulate-score 85

# Ver ajuda
npm run monitor:test -- --help
```

**O que faz:**
1. Busca empresa no banco
2. Verifica inscritos
3. Busca dados fundamentais
4. Executa análises estratégicas
5. Calcula Overall Score
6. Compara com snapshot anterior (se existir)
7. Gera relatório com IA (se mudança significativa)
8. Salva relatório no banco
9. Atualiza snapshot
10. **📧 ENVIA EMAILS REAIS** para todos os inscritos no ativo

**⚠️  Use com cuidado em produção!** Os emails são enviados de verdade usando o serviço configurado no `.env`.

**Saída esperada:**
```
🧪 ===== TESTE DE MONITORAMENTO DE ATIVO =====

📊 Ticker: BBSE3
🔧 Forçar mudança: NÃO

1️⃣ Buscando empresa no banco...
   ✅ Empresa encontrada: BB Seguridade (ID: 123)

2️⃣ Verificando inscritos...
   📧 Inscritos: 2
      - user1@email.com (João Silva)
      - user2@email.com (Maria Santos)

3️⃣ Buscando dados fundamentais...
   💰 Preço atual: R$ 32.45

4️⃣ Executando análises estratégicas...
   ✅ Análises concluídas

5️⃣ Calculando Overall Score...
   📊 Score atual: 82.3
   📈 Classificação: Muito Bom

6️⃣ Verificando snapshot existente...
   📸 Snapshot encontrado
   📊 Score anterior: 75.8
   📅 Última atualização: 08/10/2025 14:32:15

7️⃣ Comparando scores...
   📊 Delta: 6.5 pontos
   🔔 Mudança significativa: SIM
   📈 Direção: ↑ POSITIVA

8️⃣ Gerando relatório com IA...
   ⏳ Aguarde, isso pode levar alguns segundos...
   ✅ Relatório gerado (2453 caracteres)

📝 ===== PREVIEW DO RELATÓRIO =====

# Análise de Mudança Fundamental: BB Seguridade (BBSE3)

## Resumo Executivo

A BB Seguridade apresentou uma melhora significativa em seus fundamentos...

... (relatório completo omitido para brevidade) ...

9️⃣ Salvando relatório...
   ✅ Relatório salvo (ID: clx123abc456)

🔟 Atualizando snapshot...
   ✅ Snapshot atualizado

1️⃣1️⃣ Enviando emails aos inscritos...
   📧 Enviando emails para 2 inscritos...
      ✅ Email enviado para user1@email.com
      ✅ Email enviado para user2@email.com

   📊 Resultado: 2 enviados, 0 falharam

✅ ===== TESTE CONCLUÍDO COM SUCESSO =====
```

---

## 🎯 Casos de Uso

### Desenvolvimento

```bash
# Testar integração completa
npm run monitor:test BBSE3

# Testar geração de relatório (forçando mudança)
npm run monitor:test PETR4 -- --force-change

# Testar com score específico
npm run monitor:test VALE3 -- --simulate-score 85
```

### Debug

```bash
# Ver logs completos do cron job
npm run monitor:run

# Testar com um ticker que você sabe que tem problema
npm run monitor:test TICKER_PROBLEMA
```

### Validação

```bash
# Validar que o cron job está funcionando
npm run monitor:run

# Validar geração de relatório para ticker específico
npm run monitor:test TICKER -- --force-change
```

---

## 🔧 Troubleshooting

### Erro: CRON_SECRET não configurado

```bash
# Adicionar ao .env
CRON_SECRET="seu-secret-aqui"
```

### Erro: Connection refused

```bash
# Certifique-se de que o servidor está rodando
npm run dev
```

### Erro: Empresa não encontrada

```bash
# Verificar se ticker existe no banco
psql $DATABASE_URL -c "SELECT ticker, name FROM companies WHERE ticker = 'TICKER';"
```

### Erro: GEMINI_API_KEY não configurada

```bash
# Adicionar ao .env
GEMINI_API_KEY="sua-api-key-aqui"
```

### Timeout no relatório

- Gemini API pode estar lenta
- Tentar novamente em alguns minutos
- Verificar quota da API

---

## 📝 Notas

### Primeira Execução

Na primeira execução para um ticker:
- Sistema cria o primeiro snapshot
- Nenhum relatório é gerado (nada para comparar)
- Próximas execuções compararão com este snapshot

### Snapshots

- Armazenados no banco (tabela `asset_snapshots`)
- Um por empresa (campo `companyId` é unique)
- Atualizado apenas quando há mudança significativa
- Contém todos os dados necessários para comparação

### Relatórios

- Gerados apenas se mudança > 5 pontos (configurável)
- Salvos no banco (tabela `ai_reports` com `type='FUNDAMENTAL_CHANGE'`)
- Incluem scores anterior e atual
- Incluem direção da mudança (positive/negative)

### Emails

- No ambiente local, emails podem não ser enviados (depende da config)
- O script mostra quem receberia emails (simulação)
- Em produção, emails são enviados de verdade

---

## 🚀 Próximos Passos

Após testar localmente:

1. ✅ Verificar que snapshots são criados corretamente
2. ✅ Verificar que comparação funciona
3. ✅ Verificar que relatórios são gerados
4. ✅ Verificar integração com email
5. 🚀 Deploy para produção
6. 📊 Monitorar primeiras execuções do cron

---

## 📚 Referências

- **Documentação completa**: `/docs/ASSET_MONITORING_README.md`
- **Especificação**: `/FEAT-MONITOR-ATIVOS.md`
- **Resumo de implementação**: `/IMPLEMENTATION_SUMMARY.md`

