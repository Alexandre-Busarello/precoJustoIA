# Spec: ETF Detail Page

## Purpose
Define the individual ETF analysis page, including score display, holdings table, global search integration, intelligent comparator shortcut, and technical analysis sub-route.

## Requirements

### Requirement: ETF Individual Page (/etf/[ticker])
O sistema SHALL fornecer uma página de análise individual para cada ETF ativo em `/etf/[ticker]`.
A página SHALL exibir: nome, ticker, score geral (etfScore), as 6 dimensões do score (custo, retorno, liquidez, solidez, qualidade da carteira, análise IA), retornos históricos (6m, 1a, 3a, 5a), taxa de administração (netExpenseRatio), benchmark, patrimônio líquido (netAssets), concentração top 5 (holdingsConcentrationTop5), e cotação atual.
Acesso: FREE para dados principais; holdings completas PREMIUM.

#### Scenario: ETF com score completo
- **WHEN** usuário navega para `/etf/BOVA11`
- **THEN** a página exibe score=69, dimensões do score, taxa=0,10%, retorno 1a=~30%, benchmark=Ibovespa e cotação atual do BOVA11

#### Scenario: ETF sem score (dados insuficientes)
- **WHEN** usuário navega para `/etf/POSB11` (sem return1y nem return6m)
- **THEN** a página exibe os dados disponíveis (taxa, benchmark) e exibe aviso "Score indisponível — histórico de retorno insuficiente" sem quebrar a renderização

#### Scenario: ETF não encontrado
- **WHEN** usuário navega para `/etf/INVALIDO`
- **THEN** a página retorna 404

#### Scenario: ETF é FII ou ação (tipo errado)
- **WHEN** usuário navega para `/etf/MXRF11` (que é FII, não ETF)
- **THEN** a página retorna 404 ou redireciona para `/fii/MXRF11`

---

### Requirement: Holdings do ETF na página individual
A página SHALL exibir a tabela de participações (EtfHolding) do ETF.
Usuários FREE SHALL ver até as 5 maiores participações.
Usuários PREMIUM SHALL ver todas as participações disponíveis.
Participações com `companyId` vinculado SHALL exibir link para a página da empresa (`/acoes/[ticker]`).
Participações sem `companyId` SHALL exibir nome/ticker sem link.

#### Scenario: Holdings com empresa vinculada (FREE)
- **WHEN** usuário FREE vê a página do BOVA11
- **THEN** são exibidas as top 5 holdings com peso (%), nome da empresa e link clicável para `/acoes/VALE3`

#### Scenario: Holdings completas (PREMIUM)
- **WHEN** usuário PREMIUM vê a página do BOVA11
- **THEN** todas as holdings disponíveis são exibidas na tabela, não apenas as 5 primeiras

#### Scenario: Holdings sem empresa cadastrada
- **WHEN** uma holding do ETF não tem `companyId` mapeado
- **THEN** a linha exibe o ticker/nome do ativo sem link, sem erro

---

### Requirement: ETFs na Busca Global
O sistema SHALL incluir ETFs ativos (assetType=ETF, isActive=true) nos resultados da busca global (`GET /api/search-companies?q=`).
O resultado SHALL exibir badge "ETF" para distinguir de ações e FIIs.
Ao clicar em um resultado ETF, o usuário SHALL ser navegado para `/etf/[ticker]`.
Acesso: FREE.

#### Scenario: Busca retorna ETF
- **WHEN** usuário digita "BOVA" na busca global
- **THEN** BOVA11 aparece nos resultados com badge "ETF" e link para `/etf/BOVA11`

#### Scenario: Busca mista (ação + ETF com ticker similar)
- **WHEN** usuário digita "ITUB"
- **THEN** ITUB4 (STOCK) e ITUB11 (ETF, se existir) aparecem, cada um com seu badge correto e link correto

---

### Requirement: Comparador Inteligente na Página do ETF
A página `/etf/[ticker]` SHALL exibir um botão "Comparador Inteligente" dentro do card principal de informações do ETF, posicionado abaixo das métricas de Taxa de Administração / Patrimônio Líquido / Concentração Top 5.
O botão SHALL ser exibido apenas quando o ETF possui `etfClass` definido e há ao menos 1 ETF peer disponível.
Ao clicar, o usuário SHALL ser navegado para `/compara-etfs/[ticker]+[peers]` com até 5 peers do mesmo `etfClass` ordenados por `etfScore` decrescente.
O botão SHALL exibir a classe do ETF e o total de ETFs incluídos na comparação.

#### Scenario: Comparador com peers disponíveis
- **WHEN** usuário acessa a página do BOVA11 (etfClass="Renda Variável BR") e existem peers da mesma classe
- **THEN** o botão "Comparador Inteligente" aparece mostrando "Renda Variável BR (5)" e navega para `/compara-etfs/bova11/xbov11/bovb11/...`

#### Scenario: Comparador sem peers
- **WHEN** o ETF não tem `etfClass` definido ou não há outros ETFs da mesma classe
- **THEN** o botão "Comparador Inteligente" não é exibido

---

### Requirement: Análise Técnica do ETF (/etf/[ticker]/analise-tecnica)
O sistema SHALL fornecer análise técnica para ETFs com histórico de preços mensais suficiente em `/etf/[ticker]/analise-tecnica`.
A análise técnica é calculada usando o mesmo serviço de ações (`getOrCalculateDailyTechnicalAnalysis`), com expiração de 30 dias.
A análise SHALL exibir: indicadores técnicos avançados, preço justo de entrada (aiFairEntryPrice), e previsão de tendência.
O botão "Análise Técnica" na página do ETF SHALL ser exibido apenas quando o ETF possui ≥ 50 registros de preço mensal histórico.
ETFs com menos de 50 meses de histórico SHALL exibir mensagem informativa ao acessar a rota diretamente.

#### Scenario: ETF com histórico suficiente
- **WHEN** usuário premium acessa `/etf/bova11/analise-tecnica` e BOVA11 tem ≥50 meses de histórico
- **THEN** a análise técnica completa é exibida usando o componente `TechnicalAnalysisPage`

#### Scenario: ETF com histórico insuficiente — botão oculto
- **WHEN** um ETF tem menos de 50 meses de histórico de preços mensais
- **THEN** o botão "Análise Técnica" não aparece na página principal do ETF

#### Scenario: ETF com histórico insuficiente — rota acessada diretamente
- **WHEN** usuário acessa `/etf/divd11/analise-tecnica` e DIVD11 tem apenas 39 meses de histórico
- **THEN** uma mensagem amber informa que são necessários ≥50 meses, quantos meses existem e quantos faltam

#### Scenario: Análise técnica gerada sob demanda
- **WHEN** usuário premium acessa a página do ETF e não há análise técnica em cache
- **THEN** a análise é calculada em background (fire-and-forget) na primeira visita

#### Scenario: Análise técnica expirada regenerada pelo cron
- **WHEN** o cron `/api/cron/refresh-etf-technical` executa mensalmente (dia 1 às 10h)
- **THEN** análises com `expiresAt` vencido são recalculadas para todos os ETFs elegíveis (≥50 meses)

#### Scenario: Usuário não logado vê análise limitada
- **WHEN** usuário não autenticado acessa a análise técnica de um ETF com histórico suficiente
- **THEN** é exibido o componente `TechnicalAnalysisPageLimited` sem necessidade de autenticação para a rota

#### Scenario: Usuário não-premium vê upgrade CTA
- **WHEN** usuário logado sem plano premium acessa a análise técnica
- **THEN** é exibido card de upgrade com call-to-action para Premium

---

### Requirement: ETF no Radar de Ativos
A página `/radar` SHALL incluir uma aba "ETFs" separada, com filtro exclusivo para assets do tipo ETF.
O grid do Radar para ETFs SHALL adaptar as colunas:
- **Estratégias**: exibe badge da `etfClass` e badge da taxa de administração (ex: "0,20%/a.a.")
- **Valuation (Upside)**: exibe o upside calculado via análise técnica (`aiFairEntryPrice`) quando disponível; exibe "N/A" em amarelo quando não há análise técnica
- **Entry (Entrada)**: exibe o status de entrada técnica quando disponível; exibe "N/A" em amarelo quando não há análise técnica
- **Sentimento**: exibe o `aiAnalysisScore` (não o YouTube score) com status: ≥70 verde, ≥50 amarelo, <50 vermelho; exibe "N/A" quando `aiAnalysisScore = null`

#### Scenario: ETF com análise técnica no Radar
- **WHEN** BOVA11 tem análise técnica calculada e `aiFairEntryPrice` definido
- **THEN** Upside exibe o percentual calculado e Entry exibe o status técnico

#### Scenario: ETF sem análise técnica no Radar
- **WHEN** NSDV11 não tem análise técnica (histórico insuficiente)
- **THEN** Upside e Entry exibem "N/A" em amarelo

#### Scenario: Sentimento do ETF usa aiAnalysisScore
- **WHEN** ETF tem `aiAnalysisScore = 78`
- **THEN** Sentimento exibe "78/100" com status verde (≥70)
