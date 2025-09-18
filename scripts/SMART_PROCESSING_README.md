# Sistema de Processamento Inteligente com Gerenciamento de Estado

## Problema Resolvido

O processamento completo de dados da Ward pode demorar **horas**, mas a Vercel tem limite de **5 minutos** por função serverless. O sistema inteligente resolve isso usando **gerenciamento de estado persistente no banco de dados** para continuar exatamente de onde parou.

## Como Funciona

### 1. **Gerenciamento de Estado Persistente**
- Estado salvo no banco de dados (`processing_state` table)
- Rastreia última empresa processada, fase atual, progresso
- Continua automaticamente de onde parou na próxima execução

### 2. **Fases Inteligentes de Processamento**
- **DISCOVERING**: Analisa quais empresas precisam de processamento
- **PROCESSING_HISTORICAL**: Processa dados históricos faltantes
- **PROCESSING_TTM**: Atualiza apenas dados TTM (últimos 12 meses)
- **COMPLETED**: Processamento completo

### 3. **Otimização Temporal**
- Máximo 4.5 minutos por execução (margem de segurança)
- Calcula quantas empresas cabem no tempo disponível
- Para automaticamente antes do timeout da Vercel

## Comandos Disponíveis

### **Processamento Inteligente (Recomendado)**
```bash
npm run fetch:ward:smart
```
- Continua automaticamente de onde parou
- Primeira execução: descobre todas as empresas
- Execuções seguintes: processa incrementalmente
- **Nunca atinge timeout da Vercel**

### **Reset Completo**
```bash
npm run fetch:ward:reset
```
- Reseta estado e inicia do zero
- Use quando quiser reprocessar tudo
- Útil após mudanças no código

### **Processamento Local**
```bash
npm run fetch:ward:local
```
- Executa localmente (sem limite de tempo)
- Útil para desenvolvimento e debug

### **Tickers Específicos**
```bash
npm run fetch:ward:smart PETR4 VALE3
```
- Processa apenas tickers especificados
- Não afeta o estado global

## Monitoramento em Tempo Real

O sistema fornece feedback detalhado sobre o estado:

```
🚀 Iniciando fetch de dados da Ward API...

📊 Estado atual do processamento:
   📊 Fase: PROCESSING_HISTORICAL
   📈 Progresso: 45/500 (9%)
   🏢 Com histórico completo: 23
   📅 Última execução: hoje
   ✅ Completo: Não

⚡ Continuando processamento de onde parou
⏱️  Tempo máximo de processamento: 4.5 minutos
📊 Fase atual: PROCESSING_HISTORICAL

📦 Processando lote de 3 empresas:
   1. ABEV3 (histórico)
   2. AZUL4 (histórico, TTM)
   3. B3SA3 (TTM)

🏢 [46] Processando ABEV3...
✅ ABEV3 processado em 28s
🏢 [47] Processando AZUL4...
✅ AZUL4 processado em 31s
⏰ Tempo insuficiente para próxima empresa (25s restantes)

📊 Resumo da execução:
   ✅ Empresas processadas: 2
   ❌ Erros: 0
   ⏱️  Tempo total: 245s
```

## Estratégias de Processamento

### **1. Primeira Execução**
```
Fase: DISCOVERING → PROCESSING_HISTORICAL
- Descobre todas as empresas no banco
- Identifica quais precisam de dados históricos
- Processa em lotes que cabem em 4.5 minutos
```

### **2. Execuções Subsequentes**
```
Fase: PROCESSING_HISTORICAL → PROCESSING_TTM → COMPLETED
- Continua processando dados históricos faltantes
- Quando terminar histórico, atualiza dados TTM
- Marca como completo quando tudo estiver atualizado
```

### **3. Execuções Diárias**
```
Fase: COMPLETED → PROCESSING_TTM → COMPLETED
- Se passou 1+ dia desde última execução completa
- Atualiza apenas dados TTM (muito mais rápido)
- Mantém dados históricos intactos
```

## Vantagens do Sistema Inteligente

### ✅ **Nunca Atinge Timeout**
- Cada execução respeita limite de 4.5 minutos
- Para automaticamente com margem de segurança
- Continua na próxima execução

### ✅ **Processamento Incremental**
- Não reprocessa dados que já existem
- Otimiza baseado no que cada empresa precisa
- Máxima eficiência de tempo e recursos

### ✅ **Resiliente a Falhas**
- Estado persistente no banco de dados
- Se uma execução falha, próxima continua de onde parou
- Não perde progresso por erros pontuais

### ✅ **Visibilidade Completa**
- Acompanha progresso em tempo real
- Mostra exatamente o que está sendo processado
- Estatísticas detalhadas de cada execução

### ✅ **Flexível**
- Suporta todos os parâmetros originais
- Pode processar tickers específicos
- Permite reset quando necessário

## Comparação de Performance

| Método | Tempo por Execução | Chance de Timeout | Progresso Perdido |
|--------|-------------------|-------------------|-------------------|
| **Antigo** | 2-4 horas | 100% (timeout garantido) | ✅ Todo progresso |
| **Inteligente** | 4.5 minutos | 0% | ❌ Nenhum progresso |

## Configuração Automática

O sistema é **100% automático**:

1. **Primeira execução**: Descobre empresas e inicia processamento
2. **Execuções seguintes**: Continua de onde parou automaticamente
3. **Execuções diárias**: Atualiza apenas dados TTM
4. **Sem configuração manual necessária**

## Uso Recomendado

### **Para Produção (Vercel)**
```bash
# Configurar cron job ou executar manualmente
npm run fetch:ward:smart
```

### **Para Desenvolvimento**
```bash
# Testar localmente sem limite de tempo
npm run fetch:ward:local

# Resetar estado para testes
npm run fetch:ward:reset
```

### **Para Debug**
```bash
# Processar empresa específica
npm run fetch:ward:smart PETR4

# Ver estado atual (sem processar)
npm run test:db:background
```

## Troubleshooting

### **Script Não Continua de Onde Parou**
- Verifique se a migração foi executada: `npm run db:migrate`
- Verifique conexão com banco: `npm run test:db:background`

### **Processamento Muito Lento**
- Sistema otimiza automaticamente baseado no tempo disponível
- Se ainda assim for lento, pode ser problema de conexão com APIs

### **Erro de Estado**
- Reset manual: `npm run fetch:ward:reset`
- Verificar logs da Vercel para detalhes do erro

## Migração do Sistema Antigo

**Antes** (timeout garantido):
```bash
npm run fetch:ward:remote  # ❌ Sempre falha após 5min
```

**Agora** (nunca falha):
```bash
npm run fetch:ward:smart   # ✅ Sempre funciona
```

O sistema inteligente é **100% compatível** e **não requer mudanças** no uso diário.
