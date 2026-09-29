# Preço Justo AI — Auditoria de mercado financeiro, compliance e estratégia de produto

Data: 29/09/2026 · Branch: `melhorias/ux-ui-mobile` · Autor: análise de especialista (perfil CNPI + produto para varejo)

> **Método e limites.** Análise estática do código (strategies, serviços, schema Prisma, rotas, copy), sem nenhum acesso ao banco de produção. O banco local (Docker, `pja`) está com schema mas **vazio** (`companies = 0`), então os achados que dependem do dado real (unidades de BDR/Units) aparecem como **PLAUSÍVEL — validar** e trazem um teste de aceite. Nenhum build, script ou endpoint de pagamento, e-mail ou IA foi executado.
>
> Referências de mercado usadas (set/2026): Selic 13,75% a.a. (Copom de 16/09/2026); NTN-B 2035 ≈ IPCA + 7,68% (09/09/2026); JCP com IRRF de 17,5% desde 01/01/2026 (PLP 128/2025) e IRRF de 10% sobre dividendos acima de R$ 50 mil/mês por fonte (Lei 15.270/2025).

---

## 1. Resumo executivo

1. **O produto tem mais amplitude que qualquer concorrente do seu preço:** 8 modelos, score, IA (Ben), backtest, carteira, radar de dividendos, índices próprios, FIIs, ETFs e BDRs. O **núcleo de credibilidade, porém, é a matemática de valuation, e ela tem bugs que um analista percebe em minutos.** Os mais graves:
   - o **FCD não desconta a dívida líquida** (trata EV como valor do acionista);
   - o **Gordon usa o último provento avulso** (de uma parcela mensal ou trimestral) como se fosse o dividendo anual;
   - o **backtest conta dividendos duas vezes** (preço ajustado + dividendo sintético);
   - a **"Fórmula Mágica" usa 1/P/L** no lugar de EBIT/EV;
   - as **taxas de desconto (10–11% nominais) ficam abaixo da Selic (13,75%)**, o que dá prêmio de risco negativo;
   - o **filtro de "lucros consistentes em 8 anos" nunca funciona** nos rankings (o campo não é carregado);
   - o **ranking de dividendos exclui bancos e seguradoras**, que estão entre as maiores pagadoras da B3;
   - o **Sharpe usa taxa livre de risco zero**, um erro grave num país com CDI de dois dígitos.
2. **Risco regulatório real (CVM).** A UI mostra rótulos **"Compra"** e "Região segura para entrada" no Radar. Há também um texto de "Rentabilidade mínima **garantida**", "Análise **Preditiva**", "Somos os **únicos** no Brasil", e o prompt do Ben manda dar "a **recomendação**". Isso contradiz o disclaimer do rodapé e expõe a empresa à Res. CVM 20 (análise é atividade privativa de analista credenciado) e à Res. CVM 19 (consultoria automatizada). Corrigir é barato, questão de dias.
3. **Preço vs valor.** A R$ 19,90/mês ou R$ 189,90/ano, o PJA custa praticamente o mesmo que o **Investidor10 PRO (R$ 238,80/ano)**, que inclui **IR/DARF, carteira, alertas, preço-teto, app e cursos**. O Status Invest cobra R$ 262,80 (Essencial) e R$ 385,20 (Profissional) por ano; o Kinvo, R$ 179,90/ano. O PJA **não entrega o que faz o investidor renovar**: agenda de proventos personalizada, alertas de preço-teto, rentabilidade vs CDI/IPCA com proventos automáticos e IR. Em troca, entrega muitas features de "uma visita" (índices próprios, projeção do IBOV, P/L da bolsa, quiz, arbitragem de dívida).
4. **Oportunidade imediata com dados já no banco.** O banco já tem o que é preciso para:
   - filtro de liquidez (`HistoricalPrice.volume` diário, `PriceOscillations.tradedVolumePerDay`, `FiiData.liquidez`);
   - Bazin (`DividendHistory`);
   - Peter Lynch (`cagrLucros5a`, `pl`, `dy`);
   - Magic Formula correta (`evEbit`);
   - agenda de proventos (`DividendHistory.exDate/paymentDate`);
   - histórico de múltiplos (`FinancialData` anual + preços);
   - Selic/CDI/IPCA via BCB SGS (a série 12 já é consumida).

---

## 2. Entendimento do produto

**Rotas principais (App Router):**
- Análise de ativos: `/acao/[ticker]`, `/fii/[ticker]`, `/etf/[ticker]`, `/bdr/[ticker]`.
- Rankings e screening: `/ranking`, `/screening-acoes`, `/screening-fiis`.
- Comparadores: `/comparador` + `/compara-acoes`, `/comparador-etfs` + `/compara-etfs`.
- Backtest: `/backtest` + `/backtesting-carteiras`.
- Carteira e acompanhamento: `/carteira`, `/radar`, `/radar-dividendos`.
- Índices e mercado: `/indices` (índices próprios, IPJ), `/pl-bolsa`, `/projecoes-ibov`, `/analise-setorial`.
- Calculadoras e utilitários: `/calculadoras/dividend-yield`, `/calculadoras/recuperacao`, `/arbitragem-divida`, `/quiz`.
- Conta, conteúdo e comercial: `/conversas-ben`, `/blog`, `/planos`, `/checkout`, `/parceiros`.

**Modelos** (`src/lib/strategies`): Graham, Anti-Dividend Trap (DY), Low P/E, Magic Formula, FCD, Gordon, Fundamentalista 3+1, Barsi (exibido como "Bazin" no Radar), AI (Gemini), Screening, FII (ranking, score e preço-teto) e ETF. O **Overall Score** (`overall-score.ts`, 5.068 linhas) é uma média ponderada desses modelos, das demonstrações e de 10% de "sentimento YouTube".

**Preços e gating:**
- Fallback: R$ 19,90/mês e R$ 189,90/ano (`src/lib/price-utils.ts:85-86`), com 15% de desconto no PIX. O preço dinâmico vem da tabela `offers`.
- FREE: 3 visualizações completas de empresa/mês, 3 rankings, 3 comparações, 1 backtest, 3 screenings (`src/lib/usage-based-pricing-service.ts:29-37`), só Graham nos rankings (top 10), 1 carteira, 1 monitor.
- Anônimo: 1 uso por feature.
- Trial: 1 dia (`trial-service.ts`).
- PREMIUM: tudo ilimitado.

**Inconsistências na página de planos** (`src/app/planos/page.tsx`):
- o metadata diz "economize **12%**" (l.37) e o FAQ diz "**20%**" (l.381), mas o real é 1 − 189,90/238,80 = **20,5%**;
- o bloco de custo diz "**+R$ 497** Custo do Premium Anual" (l.270), quando o preço é R$ 189,90;
- aparecem ora "8 modelos", ora "TODOS os **7** modelos" (l.286).

---

## 3. Auditoria de correção financeira (modelos e scores)

Gravidade: **P0** = número errado exibido ao usuário ou metodologia inválida; **P1** = viés relevante; **P2** = refinamento.

### 3.1 FCD — Fluxo de Caixa Descontado (P0)
Arquivos: `src/lib/strategies/base-strategy.ts:281-336`, `src/lib/strategies/fcd-strategy.ts:31-47, 125-214`, `src/lib/strategies/strategy-config.ts:41-49`.

| # | Problema | Por que está errado | Correção |
|---|---|---|---|
| a | `pricePerShare = enterpriseValue / sharesOutstanding`, sem subtrair a dívida líquida. O comentário diz que subtrair "seria dupla contagem". | FCFF descontado pelo WACC dá o **EV**. O valor do acionista é EV − dívida líquida (− minoritários + ativos não operacionais). Empresas alavancadas (utilities, varejo, incorporadoras) ficam superavaliadas; empresas com caixa líquido ficam subavaliadas. | `equity = EV − (totalDivida − caixa/totalCaixa)`; fallback `enterpriseValue − marketCap`, campos que já existem em `FinancialData`. Documentar a ponte EV→Equity na UI. |
| b | Base de caixa: `fluxoCaixaLivre` (Yahoo/Brapi, *levered*, pós-juros, ou seja, próximo do FCFE) **ou** `EBITDA × 0,6`. | Mistura FCFE com desconto a WACC. EBITDA×0,6 ignora IR, capex e capital de giro (em setores intensivos em capital, o FCFF é bem menor). | FCFF = EBIT×(1−34%) + D&A − Capex − ΔNCG, com dados da DFC/DRE que já estão no banco (`CashflowStatement`, `IncomeStatement`). Se só houver FCFE, descontar a **Ke** e **não** subtrair dívida. |
| c | Crescimento `g + 0,05·e^(−0,5t)`: +3% no ano 1, +1,8% no ano 2 etc., fixo para todas as empresas. | Prêmio de crescimento arbitrário, sem relação com a empresa. | Usar o CAGR de receita/lucro limitado (ex.: min(CAGR5a, 10%)) convergindo linearmente para o g terminal. |
| d | Taxa de desconto: **10% nominal (BR) e 12% (BDR)**. | Com Selic de 13,75% e NTN-B longa a IPCA+7,7% (≈ 12% nominal com IPCA de ~4%), a taxa livre de risco já supera o WACC usado, ou seja, prêmio de risco negativo. E o BDR com taxa **maior** que o Brasil é invertido (é fluxo em USD). | Ke = rf (NTN-B longa nominal, ou real + IPCA esperado Focus) + β×ERP (5–6%) ⇒ tipicamente 15–18% nominal para ações BR. WACC com Kd×(1−34%). Buscar as taxas automaticamente (§3.14). Para BDR: modelar em USD com UST 10y + ERP e converter pelo câmbio. |
| e | g terminal de 2,5% nominal em BRL. | Em BRL nominal, o g perpétuo deveria ficar em torno de inflação + crescimento real (≈ 4–6%). Isoladamente é conservador, mas, combinado ao item (d), o spread k−g fica errado dos dois lados. | Trabalhar em termos reais (k real ≈ 7,7% + ERP; g real 0–2%) ou em termos nominais coerentes. |
| f | Bancos e seguradoras: EBITDA nulo → excluídos (correto), mas sem alternativa. | Setor com ~25% do valor do IBOV fica sem valuation intrínseco. | Para financeiras: modelo de lucro residual / **P/VP justo = (ROE − g)/(Ke − g)** ou DDM. |

**Aceite:**
- teste unitário: empresa com EV = 100, dívida líquida = 40 e 10 ações ⇒ valor justo de 6,0 (hoje daria 10,0);
- o `terminalValueContribution` passa a ser exibido;
- o ranking FCD deixa de listar empresas com Dív.Líq./EBITDA > 3 no topo por puro efeito de alavancagem.

### 3.2 Gordon (DDM) (P0)
Arquivos: `src/lib/strategies/gordon-strategy.ts:155-170, 5-34, 42-73`, `strategy-config.ts:52-60`.

- **D1 = `ultimoDividendo`** (l.157-158): esse campo é o **último pagamento avulso** (há até um cron para atualizá-lo). Em pagadoras mensais ou trimestrais (ITSA4, BBAS3, TAEE11, BBSE3), isso é 1/12 a 1/4 do dividendo anual, e o valor justo sai 4–12× menor. O fallback `dividendYield12m × preço` só roda quando `ultimoDividendo` é nulo.
  **Correção:** D0 = soma dos proventos (dividendos + JCP) com ex-date nos últimos 12 meses (`DividendHistory`), removendo extraordinários (> 2× a mediana) ou usando a média de 3 anos; **D1 = D0 × (1+g)**.
- **k base = 11% nominal** (< Selic 13,75%) e **g base 4%**, somados a ajustes setoriais de até +6% (Tecnologia ⇒ g ≈ 10%) com piso k−g = 1pp (l.56, 64-66). Um spread de 1pp produz valores justos explosivos (D/0,01 = 100×D).
  **Correção:** k = Ke (§3.1d); g ≤ min(ROE×(1−payout), 6% nominal); exigir k − g ≥ 4pp.
- **Mapa setorial com match exato** (`SECTORAL_PARAMETERS[sector]`, l.44), com chaves no padrão B3 ("Energia Elétrica", "Saneamento"). O setor no banco vem do Yahoo **traduzido por LLM** (`scripts/fetch-data-ward.ts:22-60`, ex.: "Serviços Financeiros", "Utilidades Públicas"). O ajuste setorial vira praticamente sempre `default`, e de forma não determinística. **PLAUSÍVEL — validar** com `SELECT DISTINCT sector`.
  **Correção:** adotar a classificação setorial oficial da B3 (setor/subsetor/segmento) como coluna própria, com mapeamento determinístico.
- `runRanking` recalcula métricas com `financials.dy/roe` atuais, enquanto a análise usa médias de 7 anos (l.295-299). Critérios e score ficam inconsistentes.

**Aceite:** para um ticker que paga 12 proventos/ano de R$ 0,10, D0 = R$ 1,20 (e não R$ 0,10); valor justo = 1,20×1,04/(k−g).

### 3.3 Backtest — dupla contagem de dividendos e look-ahead (P0)
Arquivos: `src/lib/adaptive-backtest-service.ts:327-328, 445-530`, `src/app/api/backtest/configs/route.ts:92-97`.

- O preço usado é `adjustedClose` (Yahoo/Brapi: **já ajustado por dividendos e desdobramentos**) e, **além disso**, credita um dividendo sintético = `preço × averageDividendYield`, dividido em março, agosto e outubro. Resultado: **o retorno total fica inflado em ≈ DY ao ano** (6–10% a.a. em carteiras de dividendos). É o número que o usuário vai comparar com o CDI.
- `averageDividendYield` é um DY médio **atual**, aplicado ao passado (look-ahead), e limitado a 10%.
- **Correção:** (1) usar `close` ajustado **apenas por eventos de capital** (desdobramento/grupamento) e creditar os **proventos reais** de `DividendHistory` na data-com/pagamento, líquidos de 17,5% IRRF no JCP (2026+; 15% antes) — opção recomendada, porque a mesma lógica já existe no `index-engine.ts:107-194`; ou (2) usar `adjustedClose` e **não** creditar dividendos.
- Exibir custos (corretagem/emolumentos 0,03%) e o benchmark CDI+IBOV no mesmo gráfico.

**Aceite:** um backtest de 1 ativo, sem aportes, com `adjustedClose`, reproduz o retorno total do Yahoo com erro < 0,5pp/ano; com reinvestimento desligado, os proventos somados batem com `DividendHistory`.

### 3.4 Magic Formula (Greenblatt) (P0)
Arquivos: `src/lib/strategies/magic-formula-strategy.ts:19, 57-63, 108-122`; ingestão `scripts/fetch-data-ward.ts:890-893, 1306-1310`.

- `earningsYield = 1/P/L` (LPA/preço). Greenblatt define **EY = EBIT / EV** e **ROC = EBIT / (NCG + Imobilizado líquido)**. O P/L ignora dívida e resultado financeiro. O campo `evEbit` já existe em `FinancialData`: basta usar **EY = 1/evEbit**.
- Não há ordenação por **soma de rankings** (rank ROIC + rank EY), que é a essência do método. O código usa um score linear.
- Greenblatt exclui **financeiras e utilities**; o código não exclui.
- `minEY = 0.8` (80%) como default em `runAnalysis` (l.19). Na prática o config sobrescreve para 0,08, mas é um bug latente.
- A descrição no overall score diz "Combina **ROE** elevado com **P/L** baixo" (`overall-score.ts` ~l.4259), o que está errado.

**Aceite:** ranking = ordenação crescente de (posição ROIC + posição EBIT/EV) entre não financeiras com liquidez mínima; teste com 5 empresas sintéticas.

### 3.5 Filtro de liquidez (PRIORIDADES.md) (P0 — produto e credibilidade)
Hoje **não existe** filtro de liquidez nos rankings de ações. Só o motor de índices usa volume (`index-screening-engine.ts:391-400`). Ações como SOND3 aparecem com "preço justo" altíssimo e são inegociáveis na prática.
- **Implementar em** `AbstractStrategy` (novo `filterByLiquidity`) chamado em todos os `runRanking`, e no screening:
  - fonte primária: `getAverageDailyVolume()` já pronto em `src/lib/index-strategy-integration.ts:245-320` (volume financeiro médio de 21–60 pregões a partir de `HistoricalPrice` com `interval='1d'`);
  - fallback: `PriceOscillations.tradedVolumePerDay`;
  - para FIIs: `FiiData.liquidez`.
- **Defaults:** ações ≥ R$ 1 milhão/dia (opção "incluir baixa liquidez" desligada por padrão, com opções de R$ 500 mil/2 mi/10 mi); FIIs ≥ R$ 500 mil/dia; BDRs ≥ R$ 200 mil/dia (BDRs são naturalmente ilíquidos, então exibir alerta em vez de excluir).
- **Pré-computar** o volume no `AssetSnapshot` (cron diário) para não pesar o rank-builder.
- **Badge "Baixa liquidez"** nas páginas de ativo, também com impacto no score (penalidade ou flag).

**Aceite:** SOND3 (e qualquer ativo abaixo de R$ 1 mi/dia) some de todos os rankings padrão e aparece com badge na página própria.

### 3.6 Filtro "lucros consistentes em 8 anos" inoperante (P0)
- `rank-builder-service.ts:142-163` monta `historicalFinancials` **sem `lucroLiquido`**. Com isso, `hasConsistentProfits` (`base-strategy.ts:493-544`) lê sempre `null`, fica com `profitData.length === 1 < 3` e só exige lucro atual > 0. A regra documentada (máx. 2 anos de prejuízo em 8) **nunca é aplicada** nos rankings.
- **Correção:** incluir `lucroLiquido` (e `receitaTotal`, `ebitda`, `fluxoCaixaOperacional`) no mapeamento. O teste é `hasConsistentProfits` com 8 anos e 3 prejuízos ⇒ exclui.

### 3.7 Ranking de dividendos exclui bancos e seguradoras (P0 para o público de dividendos)
- `dividend-yield-strategy.ts:222-230` exige `liquidezCorrente ≥ 1,2` **e** `dividaLiquidaPl ≤ 1` como pré-filtro rígido (sem o "benefício da dúvida" que a análise individual concede). Bancos e seguradoras não têm liquidez corrente (campo nulo), então BBAS3, ITUB4, BBDC4, SANB11, BBSE3, CXSE3, ITSA4 e ABCB4 (**o núcleo das carteiras de dividendos do varejo**) ficam de fora ou entram de forma aleatória.
- O mesmo vale para Magic Formula, Low P/E e Graham (critérios de LC/Dív.Líq/PL para financeiras). O `overall-score.ts` já detecta `isBankOrFinancial` (l.2112), mas as strategies não usam.
- **Correção:** perfil de critérios por tipo de negócio. Para **financeiras**: ROE ≥ 12% (média de 5a), P/VP, payout 25–80%, consistência de lucro, sem LC/Dív/PL. Para **utilities**: Dív.Líq./EBITDA ≤ 3,5 em vez de Dív/PL ≤ 1.
- **Bug de exibição (l.264):** `DY ${dy.toFixed(1)}%`, `ROE ${roe.toFixed(1)}%` e `Margem ${margemLiquida.toFixed(1)}%` imprimem decimais como percentuais. Aparece "DY 0.1%" quando o correto é 8,5%. Trocar por `formatPercent`.

### 3.8 "Margem de segurança" definida errado (P1 — terminologia técnica)
- Graham, FCD e `convertToRankingResult` (`graham-strategy.ts:166, 211`; `fcd-strategy.ts:217, 245`; `base-strategy.ts:431`) chamam de **margem de segurança** o valor `VJ/P − 1`, que é **upside/potencial**.
- Margem de segurança (Graham/Klarman) é **1 − P/VJ**. Exemplo: VJ = 100 e P = 75 dá margem de 25% e upside de 33%. Um filtro de "margem ≥ 20%" hoje aceita descontos de apenas 16,7%.
- O Barsi usa `(teto − P)/teto` (correto). Unificar: exibir **"Desconto vs valor intrínseco"** (1 − P/VJ) e **"Potencial"** (VJ/P − 1) com rótulos distintos.

### 3.9 Graham (P1)
Arquivos: `graham-strategy.ts:21-31, 164-166`; `base-strategy.ts:210-213`.
- √(22,5×LPA×VPA) é o **"Graham Number"** (preço **máximo** para o investidor defensivo: P/L 15 × P/VP 1,5), calibrado para os juros dos EUA dos anos 1970. Ele não é uma estimativa de valor justo. Com a Selic em 13,75%, 22,5 é generoso. Recomendações:
  1. Rotular como "Número de Graham (preço máximo defensivo)".
  2. Usar **LPA normalizado** (média de 5 anos do histórico já carregado), essencial para cíclicas como PETR4, VALE3, CSNA3, SUZB3 e USIM5, que parecem baratíssimas no pico de lucro.
  3. Opcional: fórmula revisada V = LPA×(8,5+2g)×4,4/Y, com Y = taxa IPCA+ longa nominal.
- **Units** (TAEE11, KLBN11, SANB11, ENGI11, ALUP11, BPAC11, TIET11…): se o LPA e o VPA da fonte forem por ação e o preço for por unit, o VJ sai subestimado ou superestimado por um fator 3–5×. **PLAUSÍVEL — validar**: TAEE11 deve ter P/L ≈ preço/LPA_unit; comparar com a composição da unit (1 ON + 2 PN, por exemplo).
- `filterTickerEndingDigits` (`base-strategy.ts:405-416`) exclui todos os tickers terminados em 5–9. Isso remove PNAs e PNBs **líquidas** (USIM5, BRKM5, CPLE6/CPLE5 conforme ano, ELET6) e BDRs de ETF (…39). Trocar pelo filtro de liquidez (§3.5) e manter só a deduplicação por empresa escolhendo a classe **mais líquida** (hoje fica a primeira do sort, `removeDuplicateCompanies` l.631-648).

### 3.10 BDRs — moeda e paridade (P0 se confirmado)
Arquivo: `src/lib/bdr-data-service.ts:748-754, 1271-1300, 1596-1602`.
- O LPA e o VPA vêm do Yahoo (`epsTrailingTwelveMonths`, `bookValue`, `netIncome/shareIssued`) na **moeda financeira** (USD) e **por ação subjacente**. O preço do BDR (ex.: AAPL34) está em **BRL por recibo**, com paridade própria. `financialCurrency` é declarado (l.239) e **nunca usado**. Graham, P/L e P/VP de BDR podem estar errados em uma ordem de grandeza. **PLAUSÍVEL — validar**: para AAPL34, P/L_calc deve ser ≈ P/L da AAPL na Nasdaq.
- **Correção:** LPA_BDR = LPA_USD × câmbio (PTAX) / razão de conversão (ações por BDR). Guardar `bdrRatio` e `financialCurrency` e validar contra o P/L do ativo-objeto.

### 3.11 Overall Score (P1)
Arquivo: `src/lib/strategies/overall-score.ts`.
- **Pesos somam 0,95** com dividendos (0,86 + 0,09) ou **0,962** sem dividendos (l.4144-4200), e não há normalização ("Não fazer normalização por totalWeight", l.4724-4730). A nota máxima teórica fica abaixo de 100 e empresas que não pagam dividendos levam +1,2pt estrutural. Corrigir para que os pesos somem 1.
- **"Benefício da dúvida"** em todos os critérios (`!roe || roe >= min`): dado faltante conta como aprovado. Empresas com cobertura ruim (small caps, BDRs) ganham nota maior. Correção: critério sem dado = neutro (excluído do denominador) e **cobertura de dados** exibida ("nota baseada em 6/9 critérios").
- **10% de "sentimento YouTube"** (l.4119, 4665-4720) dentro de uma nota "fundamentalista". É metodologicamente frágil e expõe a marca (influenciadores sem CNPI). Retirar do score e mostrar à parte como "O que o mercado está falando".
- Circularidade: o ranking Graham exige overall > 50 (`filterCompaniesByOverallScore`), mas o overall já inclui o próprio Graham. Isso é recalculado duas vezes (`shouldExcludeCompany`), o que custa CPU e mistura critérios.
- **Priorização técnica ligada por padrão** em todos os modelos (`strategy-config.ts: useTechnicalAnalysis: true`). Os rankings fundamentalistas são reordenados por RSI/estocástico ("sobrevenda primeiro" = comprar faca caindo). Desligar por padrão e rotular claramente.
- Descrições erradas (l.4255-4266): `lowPE` "abaixo da média do setor" (é P/L fixo ≤ 15) e `magicFormula` (ver §3.4).

### 3.12 Métricas de carteira (P0 — Sharpe)
- `portfolio-metrics-service.ts:993-996`: **Sharpe com rf = 0**. No Brasil, com CDI de ~13–15% a.a., isso infla o Sharpe de forma absurda: uma carteira que rende o CDI com 10% de vol aparece com Sharpe ≈ 1,4 quando o correto é ≈ 0. Usar o CDI acumulado do período (a série SGS 12 já é buscada em `benchmark-service.ts:21-60`).
- Rentabilidade "sobre capital investido" (l.369) não é TWR. Aceitável se rotulada, mas oferecer **TWR (cota)** e **TIR (XIRR)** como padrão de mercado, e incluir **IPCA** (SGS 433) e **IPCA+ (NTN-B)** como benchmarks.
- A simulação do CDI usa (1 + média diária)^21 por mês (l.656-684). Prefira capitalizar os fatores diários reais. É um erro pequeno, mas o dado está disponível.

### 3.13 FIIs (P1)
Arquivos: `src/lib/fii-listing-valuation.ts:52-68`, `src/lib/strategies/fii-overall-score.ts`.
- O preço-teto usa `último rendimento / 8%`. Em FIIs mensais isso dá 1/12 do valor, remendado pela heurística "< 55% ⇒ usar DY×cota". Correção: **soma dos 12 últimos rendimentos / DY-alvo**.
- **DY-alvo fixo de 8%**, com Selic a 13,75% e NTN-B a IPCA+7,7%. O mercado precifica FIIs por **spread sobre a NTN-B**. O alvo deveria ser `NTN-B real + IPCA esperado + spread` (tijolo ~2–3pp, papel IPCA ~2pp, papel CDI ~ CDI líquido). Deixar configurável na UI.
- `scoreDY` dá 100 para DY de 8–12% e penaliza acima de 12%. Com a Selic atual, FIIs de papel com 13–15% são normais: diferenciar papel de tijolo.
- O pilar **"gestão"** pontua pelo **segmento** (`segmentGestaoScore`: shopping/logística = 95), o que não tem relação com gestão. Renomear para "Segmento/Resiliência" ou medir gestão de verdade (taxa de adm., histórico de emissões abaixo do VP, alavancagem, inadimplência).
- Faltam métricas que o investidor de FII usa: **vacância física vs financeira** (o spec promete as duas; o schema só tem `vacanciaMedia`), inadimplência, LTV/alavancagem, prazo médio dos contratos (WALT), indexador (IPCA/IGP-M/CDI) para papel e **dividendo recorrente vs não recorrente**.

### 3.14 Insumos macro via "WEB_SEARCH" (P1)
- `economic-indicators-service.ts:72-74, 633-635`: CDI, SELIC e IPCA vêm de **busca web por LLM**. Isso é não determinístico e pode alucinar.
- **Correção:** BCB SGS (Selic meta 432, CDI 12, IPCA 433, expectativas Focus via API Olinda) e Tesouro Transparente (taxas de NTN-B em CSV). Um cron diário alimenta Ke/WACC (§3.1d) e o DY-alvo de FII (§3.13).

### 3.15 Barsi/Bazin (P1)
Arquivos: `barsi-strategy.ts:28-83`; rótulo "Bazin" em `src/components/radar-strategy-badges.tsx:24` e `src/app/api/radar/data/route.ts:302`.
- A média de dividendos agrupa por **ano calendário nos últimos 6 anos, incluindo o ano corrente parcial** (em set/2026, só ~9 meses) **e o ano inicial parcial**. Isso puxa a média para baixo. Usar **anos completos** (N−1 … N−5) ou janelas móveis de 12 meses.
- Sem separação entre JCP bruto e líquido. Rotular como "bruto" (padrão de mercado) e oferecer "líquido" (JCP − 17,5%).
- O config diz `minConsecutiveDividends: 3` com comentário "5 anos" e `maxDebtToEquity: 2.0` com comentário "100%" (`strategy-config.ts:103-104`); a UI ecoa o label errado.
- **Barsi ≠ Bazin.** O Radar chama o Barsi de "Bazin" e o JSON-LD da página de ação diz "método de Graham/Bazin" (`src/app/acao/[ticker]/page.tsx:558`). Ver a feature §7-F1.

### 3.16 Dividend Radar e projeções (P1)
- `dividend-radar-service.ts:4, 261-300`: **projeções de proventos geradas por LLM (gemini-flash-lite)**. Valores monetários "projetados" por LLM são um risco reputacional.
- **Correção:** projeção determinística (sazonalidade dos meses de data-com dos últimos 3 anos × valor mediano ajustado por LPA/payout), exibida como "estimativa estatística". A IA fica só para explicar.

### 3.17 Outros
- **Calculadora de arbitragem de dívida** (`rentability-service.ts:122-138, 191-208`): retorno esperado = DY + 0,5×CAGR de lucros, com piso de 5% e teto de 15–20%. A UI chama o piso de "Rentabilidade mínima **garantida**" (`rentability-selector.tsx:487`). Trocar o piso por "CDI líquido" como alternativa sem risco e remover "garantida".
- **AI Strategy** (`ai-strategy.ts:563-590`): o LLM devolve `fairValue` e `upside` numéricos ("ranking preditivo personalizado com base no seu perfil de risco", l.1078). Números de valuation inventados por LLM e personalização por perfil entram em consultoria (Res. CVM 19/30). Restringir a IA a **sintetizar** os números calculados pelos modelos determinísticos.
- **Yahoo `summaryDetail.dividendYield`** para B3 é *forward* (último pagamento × frequência) e erra muito com JCP irregular. Hoje é o 3º fallback (`fetch-data-ward.ts:929, 975, 1088`). Recomendado: calcular o **DY TTM próprio** a partir de `DividendHistory` (Σ proventos com data-com nos últimos 12m ÷ preço) e usar como fonte canônica em todas as telas.

---

## 4. Compliance (CVM) e terminologia

**Enquadramento.** Pela Res. CVM 20/2021, elaborar e divulgar relatório de análise sobre valores mobiliários específicos, com recomendação, preço-alvo ou opinião de compra/venda, é **atividade privativa de analista credenciado** (APIMEC). Uma plataforma quantitativa pode publicar **métricas e resultados de modelos**, desde que (i) não emita opinião de compra ou venda, (ii) deixe explícitos a metodologia e os limites, e (iii) não personalize por perfil. Personalizar é consultoria (Res. CVM 19/2021 + suitability da Res. CVM 30). O PRIORIDADES.md já cogita um sócio CNPI; enquanto não houver, a UI precisa ficar do lado seguro.

**Achados (P0, correção barata):**

| Local | Texto hoje | Trocar por |
|---|---|---|
| `src/lib/radar-service.ts:165, 208` | label **"Compra"**; "Região segura para entrada" | "Abaixo do valor estimado" / "Dentro da faixa estimada" |
| `src/components/rentability-selector.tsx:487` | "Rentabilidade mínima **garantida**: 5% ao ano" | "Piso de simulação: 5% a.a. (hipótese, não garantia)" |
| `src/app/planos/page.tsx:189, 285-286` | "🤖 Análise **Preditiva** com IA"; "Somos os **únicos** no Brasil com análise preditiva real" | "Síntese dos modelos com IA"; remover a alegação de exclusividade (CDC art. 37) |
| `src/lib/ben-service.ts:1745, 1749` | "explique… **qual a recomendação** baseada na análise"; "Sempre mencione margem de segurança **ao recomendar investimentos**" | "Explique o que os modelos indicam, sem recomendar compra/venda; lembre que não é recomendação" (+ guardrail de recusa para "devo comprar X?") |
| `src/components/parceiros/clube-dos-dividendos/sections/features-ai.tsx:271` | "Os indicadores convergem para **sinal de compra**" | "Indicadores técnicos em zona de sobrevenda" |
| `src/components/portfolio-suggestions-page.tsx:670` | badge "Comprar/Vender" em sugestões de rebalanceamento | aceitável **só** para a carteira-alvo definida pelo próprio usuário; rotular "Ajuste para sua alocação-alvo" |
| `overall-score.ts:4928-4968`, `fii-overall-score.ts:176-188` | campo `recommendation` ("Empresa Excelente") | renomear para `qualityLabel` e exibir "Nota de qualidade: A" |
| `src/app/api/company-preview/[ticker]/route.ts:322`, `src/components/company-preview.tsx:479, 602` | "Compra" (mock) | remover |
| Landing (`src/app/page.tsx`) | "Encontre as **Melhores** Ações", "Único no mercado brasileiro!" | "Ranqueie ações por modelos consagrados"; remover "único" |

**Disclaimers.** Hoje só aparecem no rodapé, na IA e em alguns cards. Incluir um **disclaimer curto persistente junto de todo "preço justo", score e ranking**: *"Estimativa gerada por modelo quantitativo com dados públicos; não é recomendação de investimento. Rentabilidade passada não garante resultados futuros."* Incluir também um link para `/metodologia` com as fórmulas e premissas (taxa de desconto, g, data do dado).

**Terminologia pt-BR:**
- "Preço justo" é aceitável no mercado, desde que acompanhado do **nome do modelo** ("Preço justo (Graham)") e da data base. Nunca usar "preço-alvo" (termo de analista sell-side).
- "Liquidez corrente" é diferente de "liquidez de mercado" (volume): hoje o mesmo nome "liquidez" é usado nos dois sentidos em FIIs e ações.
- "Upside" pode ficar como "potencial"; "margem de segurança" segue o §3.8.
- "Dividend Yield" pode ficar como "DY (12m, bruto)".
- "Payout" pode ficar como "payout (% do lucro distribuído)".
- JCP deve aparecer sempre como "JCP (bruto; IRRF 17,5% desde 2026)".
- "WACC" só vale para o FCFF; para o FCFE, usar "custo do capital próprio (Ke)".
- Os nomes dos modelos misturam inglês e português ("Anti-Dividend Trap", "Low P/E"). Padronizar: "Anti-armadilha de dividendos", "P/L baixo com qualidade".

---

## 5. Valor vs preço — benchmark de concorrentes (set/2026)

| Plataforma | Preço | O que faz o usuário pagar/renovar |
|---|---|---|
| **Preço Justo AI** | R$ 19,90/mês · R$ 189,90/ano (PIX −15%) | 8 modelos de valuation, score, IA Ben, backtest, carteira, radar de dividendos, índices próprios, FIIs, ETFs e BDRs |
| **Investidor10 PRO** | **R$ 238,80/ano** (12× R$ 19,90); 3 anos por R$ 477,60; 5 anos por R$ 716,40 | Carteira, **IR/DARF automático**, **alertas de preço**, **preço-teto**, comparadores, relatórios, carteiras recomendadas, cursos, **app** |
| **Status Invest** | Bear grátis; Essencial R$ 21,90/mês (R$ 262,80/ano); Profissional R$ 32,10/mês (R$ 385,20/ano); Avançado R$ 99,75/mês (R$ 1.197/ano); IR +R$ 365/ano | **Conexão B3 (importação automática)**, dividendos futuros, consenso de analistas/preço-alvo, score de IA com 252 fatores, módulo IR/DARF |
| **Kinvo Premium** | R$ 179,90/ano (12× R$ 19,90), só anual | Consolidação de carteira multicorretora, rentabilidade vs benchmarks |
| **Fundamentus** | Grátis | Indicadores brutos e busca avançada |
| **Gorila** | Grátis para PF | Consolidação de carteira |

**Leitura:**
1. O PJA **não é caro**: está no piso do mercado. **O problema é o mix de valor.** O Investidor10, pelo mesmo ticket anual (~R$ 239), entrega os três hábitos que retêm (carteira + proventos, alertas e IR). O diferencial do PJA (multimodelo + IA + backtest) é forte na **aquisição**, mas é de uso episódico.
2. O **free tier é mais fechado que o dos concorrentes**: 3 páginas completas de empresa por mês, contra páginas de indicadores 100% abertas no Status Invest, Investidor10 e Fundamentus. Isso reduz SEO/engajamento e confiança antes da compra.
3. O que o varejo BR paga, por persona:
   - **dividendos** (maior base): agenda de proventos, preço-teto Bazin, alertas, projeção de renda mensal;
   - **value investor**: valuation transparente com premissas editáveis e histórico de múltiplos;
   - **FII**: P/VP histórico, spread vs NTN-B, vacância, recorrência de rendimentos;
   - **iniciante**: "o que tenho e está bom?", carteira com nota e alertas simples;
   - **todos**: **IR** (dor anual garantida em março/abril e mensal para quem vende acima de R$ 20 mil).

---

## 6. Estratégia de produto e preço

### 6.1 Posicionamento
**"O analista quantitativo do investidor pessoa física: valuation transparente de 8+ modelos, com premissas atualizadas pela Selic/NTN-B do dia e alertas quando o preço entra na sua zona."** O diferencial defensável é **transparência + premissas de mercado vivas + multimodelo** (ninguém no varejo mostra o FCD com WACC ligado à NTN-B). Isso só se sustenta **depois** das correções do §3. Prioridade zero é credibilidade.

### 6.2 Estrutura de planos proposta
| Plano | Preço sugerido | Conteúdo |
|---|---|---|
| **Grátis** | R$ 0 | Página de ativo com **todos os indicadores** (abrir o bloqueio atual de 3/mês), Graham e Bazin com resultado visível, ranking top 10, 1 carteira sem proventos automáticos, 3 alertas, agenda de proventos só da watchlist. *Objetivo: SEO, confiança e hábito.* |
| **Premium** (atual) | R$ 24,90/mês · **R$ 199/ano** (PIX −10%) | Todos os modelos com premissas editáveis, rankings e screening ilimitados, filtros de liquidez, histórico de múltiplos, **alertas ilimitados de preço-teto/valor justo/DY**, agenda de proventos completa, carteira com proventos automáticos + rentabilidade vs CDI/IBOV/IPCA (TWR), backtest, Ben com cota generosa. |
| **Pro** (novo) | R$ 44,90/mês · **R$ 399/ano** | Premium + **IR/DARF** (preço médio, isenção de R$ 20 mil, compensação de prejuízo, relatório anual), Ben ilimitado, exportações (CSV/Excel), backtest avançado (custos, rebalanceamento), relatórios mensais de carteira. |

**Justificativa:**
- O ticket anual do Premium continua abaixo do Investidor10 e do Status Essencial.
- O Pro captura quem paga pelo IR (o Status cobra R$ 365/ano só pelo módulo).
- O mensal mais caro que 1/12 do anual (hoje 20%, vai para ~33%) empurra para o anual, que tem churn muito menor.

**Trial:** DECISÃO DO DONO (não alterar): **manter o trial de 1 dia**. Trials longos (7–14 dias) já foram testados e geraram criação de múltiplas contas sem conversão; 1 dia fecha essa brecha. Não propor nem implementar mudança no prazo do trial. Para o valor aparecer dentro de 24h, o onboarding do trial deve levar o usuário direto às features premium de maior impacto.

**Renovação:** e-mail mensal "sua carteira vs CDI/IPCA + proventos recebidos e a receber + ativos que entraram na sua zona de preço-teto", que é o gatilho de valor recorrente. Adicionar um "extrato anual de valor" antes da renovação: nº de alertas disparados, proventos acompanhados, R$ de IR calculado.

**Corrigir já a página de planos:** 20% real, remover o "R$ 497", unificar em 8 modelos e remover "preditiva/única".

### 6.3 O que cortar ou juntar (ruído)
| Feature | Diagnóstico | Ação |
|---|---|---|
| `/comparador` + `/compara-acoes`, `/comparador-etfs` + `/compara-etfs`, `/backtest` + `/backtesting-carteiras`, `/analisar-acoes`, `/acompanhar-acoes-bolsa-de-valores` | Pares de ferramenta + landing SEO duplicados na navegação | Manter as landings só para SEO (fora do menu), com CTA para a ferramenta única |
| `/radar` (técnico com "preço justo técnico" por IA) vs `/radar-dividendos` | Dois "radares" confundem, e o técnico é o de maior risco CVM | Unificar em **Watchlist/Radar** (ativos acompanhados + alertas), com a aba técnica rebaixada a informação |
| Índices próprios (IPJ), `/projecoes-ibov`, `/pl-bolsa` | Conteúdo bom para SEO e mídia, pouco uso recorrente, custo de manutenção (crons) | Manter como conteúdo, sem destaque no menu logado; congelar evolução |
| AI Strategy "preditiva" no ranking | LLM gerando valor justo = risco de credibilidade e CVM | Remover como "modelo"; a IA passa a explicar os modelos |
| Sentimento YouTube no score | Frágil metodologicamente | Tirar do score e mostrar à parte |
| Priorização técnica nos rankings fundamentalistas | Mistura de horizontes | Desligar por padrão |
| `/quiz`, `/arbitragem-divida`, calculadora de recuperação | Ferramentas de topo de funil | Manter fora do menu principal, como landings |
| Fundamentalista 3+1 vs Anti-dividend trap vs Barsi vs Gordon | Três modelos de dividendos sobrepostos | Consolidar em **"Dividendos"**: Bazin (preço-teto), Gordon (valor) e filtro anti-armadilha (qualidade) como uma única tela com 3 lentes |

---

## 7. Features propostas — ranqueadas por (valor × diferenciação) / esforço

Escala de 1 a 5; esforço S = até 3 dias, M = 1–2 semanas, L = 3+ semanas. "Dado no banco" indica se dá para implementar agora.

| # | Feature | Valor | Dif. | Esforço | Score | Dado no banco |
|---|---|---|---|---|---|---|
| F1 | **Método Bazin explícito** (preço-teto = média de proventos dos 5 anos completos / 6%; DY-alvo editável; separar do Barsi) | 5 | 3 | S | 15 | Sim, `DividendHistory` |
| F2 | **Filtro de liquidez + badge** (§3.5) | 5 | 2 | S | 10 | Sim |
| F3 | **Peter Lynch**: PEG = P/L ÷ g(%) e "P/L justo = g + DY"; faixas <0,5 / 0,5–1 / >1; g = min(CAGR LPA 5a, 25%); excluir cíclicas | 4 | 3 | S | 12 | Sim, `cagrLucros5a`, `pl`, `dy` |
| F4 | **Alertas de preço-teto/valor justo/DY** (reusar `UserAssetMonitor`; gatilhos "preço ≤ teto Bazin", "desconto ≥ X% vs modelo Y", "DY 12m ≥ X%"), e-mail + push | 5 | 3 | M | 7,5 | Sim |
| F5 | **Agenda de proventos** (data-com, pagamento, valor, tipo JCP/Div, líquido/bruto), filtrada por watchlist/carteira + ICS/Google Calendar + resumo semanal | 5 | 2 | M | 5 | Sim, `exDate`, `paymentDate`, `type` |
| F6 | **Carteira com proventos automáticos** (a partir da posição na data-com) + rentabilidade **TWR/TIR vs CDI, IBOV, IPCA, IPCA+6%** + yield on cost | 5 | 2 | M | 5 | Sim (CDI já; IPCA via SGS 433) |
| F7 | **Histórico de múltiplos** (P/L, P/VP, EV/EBITDA, DY vs média e desvio de 5/10 anos; "está barata vs ela mesma?") | 4 | 3 | M | 6 | Sim, `FinancialData` anual + `HistoricalPrice` |
| F8 | **Premissas vivas** (Selic/IPCA/NTN-B diários via BCB/Tesouro) + **premissas editáveis pelo usuário** no FCD/Gordon com recálculo instantâneo e sensibilidade (tabela k × g) | 4 | 5 | M | 10 | Parcial (criar cron SGS/Tesouro) |
| F9 | **FII: spread DY vs NTN-B**, P/VP histórico, recorrência de rendimentos, vacância física/financeira | 4 | 4 | M | 8 | Parcial |
| F10 | **IR/DARF** (preço médio, vendas > R$ 20 mil/mês isentas em ações à vista, FII 20%, day trade 20%, compensação de prejuízo, DARF 6015, relatório anual "Bens e Direitos") | 5 | 2 | L | 3,3 | Sim, `PortfolioTransaction` |
| F11 | **Importação B3 / CEI (Área do Investidor)** ou planilha de nota de corretagem | 5 | 1 | L | 1,7 | Não |
| F12 | **Projeção de renda passiva mensal** (carteira × agenda × histórico) com meta "viver de dividendos" | 4 | 3 | S (após F5/F6) | 12 | Sim |
| F13 | **Valuation de bancos** (P/VP justo = (ROE−g)/(Ke−g); DDM) | 4 | 4 | S | 16 | Sim |
| F14 | **Página "Metodologia"** com fórmulas, premissas e data do dado, com link a partir de cada número | 4 | 3 | S | 12 | — |

**Ordem recomendada:** correções P0 (§3) e compliance (§4), depois F2, F1, F3, F13, F14, F8, F4, F5, F6, F12, F7, F9, F10, F11.

---

## 8. Critérios de aceite resumidos

- **Testes de unidade** em `src/lib/__tests__/strategies/*.test.ts` para Graham, FCD (ponte EV→Equity), Gordon (D0 = TTM), Magic Formula (rank-sum com EBIT/EV), Bazin (anos completos), Lynch (PEG), Sharpe (rf = CDI) e margem de segurança (1 − P/VJ).
- **Snapshot de regressão:** rodar os rankings no banco local com um fixture de ~30 empresas (bancos, utilities, cíclicas, units, 2 BDRs, 1 ilíquida) e comparar com valores de referência calculados à mão ou em planilha.
- **Nenhum texto com "Compra", "garantid", "preditiv", "únic", "melhores ações" nem "recomendação"** fora dos disclaimers. Dá para checar com um lint via `grep` no CI.

---

## 9. Fontes externas
- [Status Invest — planos e preços](https://lp.statusinvest.com.br/ao/planos/)
- [Investidor10 PRO — assinatura (set/2026)](https://investidor10.com.br/assine-agora-set-26/)
- [Kinvo — planos](https://consolidador.kinvo.com.br/planos/) · [Kinvo vale a pena? (2026)](https://renovainvest.com.br/blog/app-kinvo-vale-a-pena-conheca-a-plataforma/)
- [Copom reduz Selic para 13,75% (set/2026)](https://investalk.bb.com.br/noticias/economia/copom-setembro-2026) · [Selic hoje — Meelion](https://www.meelion.com/indicadores-financeiros/selic/)
- [NTN-B: taxa real por vencimento](https://fidcs.com.br/rendafixa-publico/ntn-b) · [Tesouro Direto — histórico de taxas](https://www.tesourodireto.com.br/en/produtos/dados-sobre-titulos/historico-de-precos-e-taxas)
- [Resolução CVM 20 (consolidada)](https://conteudo.cvm.gov.br/export/sites/cvm/legislacao/resolucoes/anexos/001/resol020consolid.pdf) · [Portal do Investidor — analista de valores mobiliários](https://www.gov.br/investidor/pt-br/investir/como-investir/profissionais-do-mercado/analista-de-valores-mobiliarios) · [Resolução CVM 19](https://conteudo.cvm.gov.br/export/sites/cvm/legislacao/resolucoes/anexos/001/resol019.pdf)
- [Lei 15.270 — tributação de dividendos 2026](https://dinai.capital/blog/tributacao-dividendos-2026-como-funciona-lc-15270) · [Receita Federal — IRRF sobre dividendos](https://www.gov.br/receitafederal/pt-br/assuntos/noticias/2025/dezembro/receita-federal-orienta-sobre-os-procedimentos-para-o-recolhimento-do-imposto-de-renda-retido-na-fonte-sobre-lucros-e-dividendos)
- [Método Bazin — preço-teto](https://investilize.com.br/blog/metodo-bazin-preco-teto/)
