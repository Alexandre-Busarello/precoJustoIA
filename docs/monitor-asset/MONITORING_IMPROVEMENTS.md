# Melhorias no Sistema de Monitoramento de Ativos

## Visão Geral

Este documento descreve as melhorias implementadas no sistema de monitoramento de ativos para tornar os relatórios de mudança mais precisos, menos prolixos e com melhor rastreabilidade.

## Principais Melhorias

### 1. Histórico de Snapshots

**Antes**: Apenas um snapshot por empresa (sobrescrevia o anterior)
**Depois**: Histórico completo de snapshots com rastreabilidade

#### Mudanças no Schema
```sql
-- Removida constraint unique em companyId
-- Adicionado campo isLatest para marcar o snapshot mais recente
-- Adicionado scoreComposition para análise detalhada
```

#### Benefícios
- Rastreabilidade completa das mudanças
- Possibilidade de análise histórica
- Melhor debugging e auditoria
- Comparação precisa entre períodos

### 2. Composição Detalhada do Score

**Novo Serviço**: `score-composition-service.ts`

#### Funcionalidades
- Calcula contribuição individual de cada indicador
- Agrupa por categorias (Valuation, Quality, Growth, Dividend, Risk)
- Identifica mudanças significativas entre períodos
- Fornece base para relatórios mais precisos

#### Estrutura da Composição
```typescript
interface ScoreComposition {
  totalScore: number;
  components: ScoreComponent[];
  categoryBreakdown: {
    valuation: number;
    quality: number;
    growth: number;
    dividend: number;
    risk: number;
  };
  methodology: string;
}
```

### 3. Relatórios Mais Precisos e Acessíveis

#### Melhorias no Conteúdo
- **Linguagem simplificada**: Evita jargões técnicos
- **Foco nas mudanças significativas**: Ignora variações menores que 5%
- **Análise baseada em dados**: Usa composição do score para precisão
- **Limite de palavras**: Máximo 400 palavras para concisão

#### Novo Prompt da IA
```
- Seja conciso: máximo 400 palavras
- Use linguagem simples e direta
- NÃO mencione "snapshots", "dados internos" ou processos técnicos
- Foque apenas em mudanças significativas (>10% de variação)
- Se um indicador mudou pouco (<5%), não o mencione
```

### 4. Associação Relatório-Snapshot

**Nova Funcionalidade**: Cada relatório de mudança fica associado ao snapshot que o gerou

#### Benefícios
- Rastreabilidade completa
- Possibilidade de recriar análises
- Auditoria de relatórios
- Histórico de mudanças por período

## Fluxo Atualizado do Cron Job

### 1. Processamento de Empresa
```typescript
// 1. Calcular score atual
const scoreResult = await calculateCompanyOverallScore(ticker);

// 2. Calcular composição detalhada
const scoreComposition = calculateScoreComposition(financials, strategies, price);

// 3. Buscar snapshot mais recente
const existingSnapshot = await AssetMonitoringService.getLatestSnapshot(companyId);
```

### 2. Detecção de Mudanças
```typescript
// Comparar scores
const comparison = AssetMonitoringService.compareScores(
  currentScore,
  previousScore,
  SCORE_THRESHOLD
);

if (comparison.hasChange) {
  // Mudança significativa detectada
}
```

### 3. Geração de Relatório
```typescript
// 1. Criar novo snapshot
const snapshotId = await AssetMonitoringService.createSnapshot(
  companyId,
  snapshotData,
  currentScore,
  scoreComposition
);

// 2. Gerar relatório com composições anterior e atual
const reportContent = await MonitoringReportService.generateChangeReport({
  // ... dados básicos
  previousScoreComposition,
  currentScoreComposition: scoreComposition,
});

// 3. Salvar relatório associado ao snapshot
const reportId = await MonitoringReportService.saveReport({
  companyId,
  snapshotId, // 🆕 Associação com snapshot
  content: reportContent,
  // ... outros dados
});
```

## Estrutura de Dados

### AssetSnapshot (Atualizado)
```typescript
{
  id: string;
  companyId: number;
  snapshotData: Json;           // Dados completos do ativo
  overallScore: Decimal;        // Score geral
  scoreComposition: Json;       // 🆕 Composição detalhada
  isLatest: boolean;           // 🆕 Se é o mais recente
  createdAt: DateTime;
  updatedAt: DateTime;
}
```

### AIReport (Atualizado)
```typescript
{
  id: string;
  companyId: number;
  snapshotId: string;          // 🆕 FK para snapshot
  content: string;
  type: 'FUNDAMENTAL_CHANGE';
  changeDirection: 'positive' | 'negative';
  previousScore: Decimal;
  currentScore: Decimal;
  // ... outros campos
}
```

## APIs e Serviços Atualizados

### AssetMonitoringService
```typescript
// Novos métodos
static async createSnapshot(companyId, data, score, composition): Promise<string>
static async getLatestSnapshot(companyId)
static async getPreviousSnapshot(companyId)
static async getSnapshotHistory(companyId, limit)
```

### MonitoringReportService
```typescript
// Método atualizado
static async generateChangeReport({
  // ... parâmetros existentes
  previousScoreComposition?: ScoreComposition;
  currentScoreComposition?: ScoreComposition;
})

// Método atualizado
static async saveReport({
  // ... parâmetros existentes
  snapshotId?: string; // 🆕 Associação com snapshot
})
```

### ScoreCompositionService (Novo)
```typescript
// Principais funções
export function calculateScoreComposition(financials, strategies, price): ScoreComposition
export function compareScoreCompositions(previous, current, threshold)
```

## Migração do Banco de Dados

### Script de Migração
```sql
-- 1. Adicionar novas colunas
ALTER TABLE "asset_snapshots" 
ADD COLUMN "score_composition" JSONB,
ADD COLUMN "is_latest" BOOLEAN DEFAULT true;

ALTER TABLE "ai_reports" 
ADD COLUMN "snapshot_id" TEXT;

-- 2. Remover constraint unique
ALTER TABLE "asset_snapshots" DROP CONSTRAINT "asset_snapshots_company_id_key";

-- 3. Criar novos índices
CREATE INDEX "asset_snapshots_company_id_is_latest_idx" ON "asset_snapshots"("company_id", "is_latest");
CREATE INDEX "ai_reports_snapshot_id_idx" ON "ai_reports"("snapshot_id");

-- 4. Adicionar FK
ALTER TABLE "ai_reports" 
ADD CONSTRAINT "ai_reports_snapshot_id_fkey" 
FOREIGN KEY ("snapshot_id") REFERENCES "asset_snapshots"("id") ON DELETE SET NULL;
```

## Testes

### Script de Teste
Execute `node test-monitoring-improvements.js` para testar:

1. ✅ Criação de snapshots com histórico
2. ✅ Composição detalhada do score
3. ✅ Geração de relatórios associados
4. ✅ Consultas de histórico
5. ✅ Comparação entre snapshots

## Benefícios das Melhorias

### Para os Usuários
- **Relatórios mais claros**: Linguagem acessível e foco no essencial
- **Informações precisas**: Baseadas na composição real do score
- **Conteúdo conciso**: Máximo 400 palavras, direto ao ponto

### Para o Sistema
- **Rastreabilidade completa**: Histórico de todas as mudanças
- **Debugging facilitado**: Possibilidade de recriar análises
- **Auditoria**: Transparência no processo de geração
- **Escalabilidade**: Estrutura preparada para crescimento

### Para Manutenção
- **Código mais limpo**: Separação clara de responsabilidades
- **Testes automatizados**: Script de teste abrangente
- **Documentação completa**: Este documento e comentários no código

## Próximos Passos

1. **Deploy da migração**: Executar script SQL em produção
2. **Monitoramento**: Acompanhar performance do novo sistema
3. **Feedback dos usuários**: Coletar impressões sobre os novos relatórios
4. **Otimizações**: Ajustar baseado no uso real

## Configurações Recomendadas

### Variáveis de Ambiente
```env
MONITORING_BATCH_SIZE=20           # Empresas por execução
MONITORING_SCORE_THRESHOLD=5      # Threshold para mudança significativa
CRON_SECRET=your_secret_here      # Segurança do cron job
```

### Frequência de Execução
- **Recomendado**: A cada 6 horas
- **Mínimo**: A cada 12 horas
- **Máximo**: A cada 2 horas (para evitar spam)