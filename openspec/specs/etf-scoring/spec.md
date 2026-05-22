# Spec: ETF Scoring

## Purpose
Define o cálculo do ETF Score — score composto de 0 a 100 que permite comparar ETFs brasileiros de forma quantitativa e qualitativa. O score usa **6 dimensões** que cobrem custo, retorno, liquidez, solidez, qualidade dos ativos subjacentes e análise IA. O score é análogo ao score de FIIs e ações, adaptado às características específicas de ETFs. Armazenado em `EtfData.etfScore`, recalculado após cada ciclo de ingestão.

## Requirements

### Requirement: Cálculo do ETF Score Composto (6 Dimensões)
O sistema SHALL calcular um ETF Score de 0 a 100 para cada ETF ativo com dados suficientes, usando 6 dimensões ponderadas:

- **Custo** (18%): Taxa de administração anual (`netExpenseRatio`). Quanto menor, melhor. Taxa ≤ 0.10% = 100 pts; taxa ≥ 1.50% = 0 pts. Interpolação linear entre os extremos.
- **Retorno** (22%): Retorno de 1 ano (`return1y`), normalizado entre os ETFs do mesmo grupo de `benchmarkIndex`. ETF com maior retorno do grupo = 100 pts; menor = 0 pts. Quando `return1y` é null, `return6m` anualizado é usado como proxy (`(1 + return6m)^2 - 1`).
- **Liquidez** (18%): Volume médio diário (`regularMarketVolume`). Normalizado logaritmicamente entre todos os ETFs. ETF mais líquido = 100 pts.
- **Solidez** (12%): Patrimônio líquido (`netAssets`). Normalizado logaritmicamente. Maior patrimônio = 100 pts. Protege contra risco de fechamento do fundo.
- **Qualidade da Carteira** (18%): Média ponderada dos scores internos das empresas que compõem o ETF (via `EtfHolding.companyId`). Holdings sem `companyId` (ativos não rastreados) são ignorados no cálculo. Se nenhum holding for rastreado, a dimensão recebe escore neutro de 50 pts.
- **Análise IA** (12%): Score gerado pela análise de IA do ETF (`aiAnalysisScore`). Avalia qualidade da tese de investimento, gestão, e adequação ao perfil da classe. Se `aiAnalysisScore = null`, a dimensão recebe escore neutro de 50 pts.

ETFs sem `return1y` e sem `return6m` SHALL ter `etfScore = null`.
ETFs com holdings mas sem nenhum `companyId` resolvido calculam o score com Qualidade = 50 pts (neutro).

#### Scenario: Score calculado com dados completos (6 dimensões)
- **WHEN** `EtfData` tem `netExpenseRatio`, `return1y`, `regularMarketVolume`, `netAssets`, `aiAnalysisScore` preenchidos e `EtfHolding` contém ao menos um holding com `companyId` válido
- **THEN** `etfScore` é calculado entre 0 e 100 com todas as 6 dimensões ponderadas

#### Scenario: Score com return6m como proxy de retorno
- **WHEN** `EtfData.return1y` é null mas `return6m` está preenchido
- **THEN** o retorno anualizado estimado `(1 + return6m)^2 - 1` é usado na dimensão Retorno

#### Scenario: Score sem holdings rastreáveis (ETF internacional como IVVB11)
- **WHEN** nenhum holding do ETF tem `companyId` preenchido
- **THEN** a dimensão Qualidade da Carteira recebe 50 pts (neutro) e o score é calculado com as demais dimensões

#### Scenario: Score nulo por dados insuficientes
- **WHEN** `EtfData.return1y` e `return6m` são ambos null
- **THEN** `etfScore = null` e `scoreUpdatedAt` não é alterado

#### Scenario: ETF com taxa zero ou não declarada
- **WHEN** `netExpenseRatio = 0` ou null no etf1.com.br
- **THEN** a dimensão Custo recebe 100 pts (benefício da dúvida)

#### Scenario: Dimensão IA ausente
- **WHEN** `aiAnalysisScore = null` (análise IA ainda não gerada)
- **THEN** a dimensão Análise IA recebe 50 pts (neutro) e o score é calculado normalmente

---

### Requirement: Classificação de ETF por Classe (etfClass)
O sistema SHALL classificar cada ETF em uma das seguintes classes com base no `benchmarkIndex` e `category` coletados na ingestão:
- Renda Variável BR, Internacional, Internacional BDR, Renda Fixa, Dividendos, Setorial, Multimercado, Commodities, Cripto, ESG

A classificação é armazenada em `EtfData.etfClass` e usada para:
- Agrupar ETFs no "Comparador Inteligente" da página do ETF (peers do mesmo `etfClass`)
- Exibir badge de classe no Radar de ETFs
- Normalização do Retorno por grupo (usando `etfClass` como fallback quando `benchmarkIndex` não distingue claramente)

#### Scenario: ETF classificado automaticamente
- **WHEN** o script de ingestão atualiza `benchmarkIndex = "IBOV"` para um ETF
- **THEN** `etfClass` é definido como "Renda Variável BR" automaticamente

#### Scenario: Comparador Inteligente por classe
- **WHEN** usuário acessa a página de um ETF com `etfClass = "Internacional"`
- **THEN** o botão "Comparador Inteligente" na página do ETF inclui os 5 ETFs com maior `etfScore` da mesma classe

---

### Requirement: Análise IA do ETF
O sistema SHALL gerar uma análise qualitativa de cada ETF usando IA (Claude), produzindo:
- `aiAnalysisScore` (0–100): nota geral de adequação ao perfil da classe e qualidade da tese
- `aiAnalysisSummary` (texto): resumo da análise para exibição premium
- `aiAnalysisUpdatedAt`: timestamp da última análise

A análise IA é gerada sob demanda (não bloqueia a ingestão) e renovada periodicamente.
O campo `aiConcentracaoPenaltyOverride` permite que a IA indique que um ETF concentrado por design (ex: ETFs setoriais) não deve receber a penalidade de concentração.

#### Scenario: Análise IA gerada para ETF com dados suficientes
- **WHEN** o cron de análise IA executa para um ETF com `etfScore IS NOT NULL`
- **THEN** `aiAnalysisScore`, `aiAnalysisSummary` e `aiAnalysisUpdatedAt` são atualizados no `EtfData`

#### Scenario: Penalidade de concentração desabilitada por IA
- **WHEN** a IA determina que a concentração do ETF é intrínseca ao seu design (ex: ETF setorial focado)
- **THEN** `aiConcentracaoPenaltyOverride = true` e a penalidade de concentração não é aplicada ao score

---

### Requirement: Qualidade da Carteira via Cruzamento de Holdings
A dimensão Qualidade da Carteira SHALL ser calculada cruzando os holdings do ETF com os scores das empresas cadastradas na plataforma.
Para cada `EtfHolding` com `companyId` não-nulo, o sistema SHALL buscar o score atual da empresa correspondente.
O score da dimensão é a **média ponderada** dos scores das empresas, usando `EtfHolding.weight` como peso.

#### Scenario: ETF de ações brasileiras com holdings rastreáveis
- **WHEN** BOVA11 tem holdings VALE3 (8%), ITUB4 (6%), PETR4 (5%) e todos têm scores cadastrados
- **THEN** a dimensão Qualidade = (score_VALE3 × 0.08 + score_ITUB4 × 0.06 + score_PETR4 × 0.05 + ...) / (0.08 + 0.06 + 0.05 + ...)

#### Scenario: ETF misto (alguns holdings rastreáveis, outros não)
- **WHEN** um ETF tem 10 holdings: 6 com `companyId` preenchido (somando 70% do portfólio) e 4 sem
- **THEN** a média ponderada usa apenas os 6 holdings rastreáveis, normalizando pelo peso total deles (70%)

---

### Requirement: Penalidade de Concentração
ETFs com carteira altamente concentrada SHALL receber uma penalidade aplicada sobre o score final.
Se `holdingsConcentrationTop5 > 0.70` (top 5 holdings respondem por mais de 70% do portfólio), o score final SHALL ser reduzido em até 20 pts, proporcionalmente à concentração acima do limiar.
A penalidade pode ser desabilitada via `aiConcentracaoPenaltyOverride = true` para ETFs em que a concentração é intrínseca ao design.

#### Scenario: ETF bem diversificado sem penalidade
- **WHEN** `holdingsConcentrationTop5 = 0.45` (top 5 = 45% do portfólio)
- **THEN** nenhuma penalidade é aplicada; o score final é o calculado pelas 6 dimensões

#### Scenario: ETF concentrado com penalidade máxima
- **WHEN** `holdingsConcentrationTop5 = 0.90` (top 5 = 90% do portfólio) e `aiConcentracaoPenaltyOverride = false`
- **THEN** penalidade de até 20 pts é subtraída do score final

#### Scenario: Penalidade desabilitada por IA para ETF setorial
- **WHEN** `holdingsConcentrationTop5 = 0.85` e `aiConcentracaoPenaltyOverride = true`
- **THEN** nenhuma penalidade é aplicada

#### Scenario: ETF sem dados de holdings não é penalizado
- **WHEN** `holdingsConcentrationTop5 = null` (holdings ainda não coletados)
- **THEN** nenhuma penalidade é aplicada

---

### Requirement: Normalização por Grupo de Benchmark
A dimensão Retorno SHALL normalizar os ETFs dentro do mesmo grupo de `benchmarkIndex` para evitar comparação injusta entre segmentos distintos (ex: ações vs renda fixa vs internacional).

#### Scenario: ETFs do mesmo índice comparados entre si
- **WHEN** BOVA11 e XBOV11 seguem o mesmo benchmark "IBOV"
- **THEN** o retorno de ambos é normalizado entre si, não contra ETFs de outros benchmarks

#### Scenario: ETF sem benchmark definido
- **WHEN** `benchmarkIndex` é null
- **THEN** o ETF é agrupado em "Outros" para normalização do Retorno

---

### Requirement: Recálculo Automático após Atualização de Dados
O sistema SHALL recalcular o ETF Score após cada execução dos scripts de ingestão (fases 1 e 2) e após atualização dos scores das empresas que são holdings rastreáveis de algum ETF.
O recálculo SHALL processar apenas ETFs cujo `scoreUpdatedAt` é anterior ao `updatedAt` ou ao `holdingsUpdatedAt`.

#### Scenario: Recálculo após fase 1
- **WHEN** o script de fase 1 atualiza `regularMarketVolume` de um ETF
- **THEN** o score desse ETF é recalculado se os campos obrigatórios estiverem presentes

#### Scenario: Recálculo após fase 2 com holdings novos
- **WHEN** o script de fase 2 atualiza holdings e `netExpenseRatio`
- **THEN** o score é recalculado com todas as 6 dimensões e `scoreUpdatedAt` é atualizado

---

### Requirement: Acesso ao Score por Tier
O ETF Score SHALL ser acessível para usuários FREE apenas como valor numérico.
O detalhamento das 6 dimensões, a lista de holdings com scores, a penalidade de concentração, métricas de risco (`maxDrawdown`, `volatility12m`) e `aiAnalysisSummary` SHALL ser PREMIUM-only.

#### Scenario: Usuário FREE acessa score
- **WHEN** usuário FREE consulta dados de um ETF
- **THEN** apenas o valor numérico de `etfScore` é retornado (ex: 74)

#### Scenario: Usuário PREMIUM acessa detalhamento completo
- **WHEN** usuário PREMIUM consulta dados de um ETF
- **THEN** são retornados: score por dimensão (incluindo Análise IA), lista de top holdings com scores individuais, concentração top 5, penalidade aplicada, `maxDrawdown`, `volatility12m`, retornos de todos os períodos, `aiAnalysisSummary`
