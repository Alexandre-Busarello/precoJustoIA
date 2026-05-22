# Spec: ETF Ranking

## Purpose
Define the ETF ranking system including specialized strategy presets, asset-type selector integration, and ETF result display conventions on the /ranking page.

## Requirements

### Requirement: Ranking de ETFs com Estratégias Especializadas
O sistema SHALL fornecer rankings de ETFs baseados no `etfScore` e campos de `EtfData`.
Os rankings SHALL estar disponíveis como presets selecionáveis na página `/ranking` (ou sub-aba dedicada a ETFs).
Apenas ETFs com `etfScore IS NOT NULL` SHALL aparecer nos resultados.
FREE users SHALL ver os top 10 resultados; PREMIUM users SHALL ver todos.

#### Scenario: Preset Melhor Score Geral
- **WHEN** usuário seleciona preset "ETFs: Melhor Score Geral"
- **THEN** ETFs são ordenados por etfScore decrescente, exibindo ticker, score, taxa, retorno 1a e benchmark

#### Scenario: Preset Menor Taxa
- **WHEN** usuário seleciona preset "ETFs: Menor Taxa de Administração"
- **THEN** ETFs com etfScore ≥ 40 são ordenados por netExpenseRatio crescente

#### Scenario: Preset Maior Retorno 1A
- **WHEN** usuário seleciona preset "ETFs: Maior Retorno no Ano"
- **THEN** ETFs são ordenados por return1y decrescente (usando return6m anualizado como fallback), exibindo o retorno utilizado

#### Scenario: Preset Renda Fixa
- **WHEN** usuário seleciona preset "ETFs: Renda Fixa (Selic/IPCA)"
- **THEN** apenas ETFs cujo benchmark contém "Selic", "IPCA", "IRF-M" ou "IMA" são exibidos, ordenados por etfScore

#### Scenario: Free user vê top 10
- **WHEN** usuário FREE seleciona qualquer preset de ETF
- **THEN** apenas os 10 primeiros ETFs são exibidos, com prompt de upgrade para ver todos

---

### Requirement: Seletor de Tipo de Ativo na Página de Ranking
A página `/ranking` SHALL exibir um seletor de tipo de ativo (Ações | FIIs | ETFs) que alterna o conjunto de presets e estratégias exibidos.
ETFs SHALL ter seus próprios presets sem interferir nos presets de ações e FIIs.

#### Scenario: Alternando para aba ETFs
- **WHEN** usuário clica em "ETFs" no seletor de tipo de ativo
- **THEN** os presets de ações/FIIs são ocultados e os 4 presets de ETF são exibidos

#### Scenario: Retornando para ações
- **WHEN** usuário estava na aba ETFs e clica em "Ações"
- **THEN** os presets de ações retornam ao estado anterior sem perda de seleção

---

### Requirement: Exibição de Resultados ETF no Ranking
Cada ETF no resultado do ranking SHALL exibir: posição, ticker, nome, score, taxa de administração (em %), retorno 1a (em %), benchmark.
Resultados SHALL ser clicáveis, navegando para `/etf/[ticker]`.

#### Scenario: Clique em resultado de ranking ETF
- **WHEN** usuário clica em BOVA11 no ranking de ETFs
- **THEN** é navegado para `/etf/BOVA11`

#### Scenario: ETF com return6m como fallback no ranking
- **WHEN** ETF tem return6m mas não return1y
- **THEN** o retorno exibido é marcado como estimativa (ex: "~13,4% (est. 6m)" ou ícone de aviso)
