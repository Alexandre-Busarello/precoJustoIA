# Auditoria de coerência — onda 7 (09/10/2026)

Base:
- 86 capturas full-page:
  - premium: 19 rotas × mobile 390/desktop 1440 × claro/escuro;
  - free: 10 rotas mobile;
  - anônimo: 7 rotas mobile + desktop;
  - home e /planos nos 3 modos.
- 1 roteiro Playwright dos fluxos de backtest como premium.
- Capturas do painel do Ben e do resultado do backtest.
- Leitura de código.

Tudo no dev server local (`:3100`, banco Docker). A config de teste criada no roteiro ("Teste fluxo PETR4") foi apagada do banco local.

Evidências (as capturas brutas foram apagadas; ficaram 16): `<scratchpad da sessão>/shots/w7-keep/NN-*.jpg`. O número entre colchetes nas tabelas é o arquivo.

**O que está bem:**
- 0 px de rolagem horizontal de página em todas as capturas;
- nenhum erro de console ou de página;
- dark mode legível em todas as rotas amostradas;
- gradientes e glass só sobram em `src/app/admin/**`;
- os números usam `@/lib/format` em quase todo lugar.

Os problemas abaixo são de **coerência entre telas** e de **fluxo**, não de acabamento visual.

## Achados

| ID | Rota | Viewport/tema | Evidência | Impacto | Achado | Correção (arquivos) | Lote |
|---|---|---|---|---|---|---|---|
| B-01 | /acao/petr4, /bdr, /ranking, /compara-acoes, /carteira | todos | [13][14][15][16], `flow.log` | **P0** | Backtest "rápido" nunca chega ao resultado: diálogo → formulário com nome obrigatório → toast → o usuário fica na página. Em /backtest abre a carteira de exemplo, não a config criada (ver mapa abaixo) | `/api/backtest/quick` + `QuickBacktestButton` + pouso em `/backtest?view=results&configId=…` | w7-backtest-flow |
| C-01 | /planos, / (preços), /backtest | todos | [10][02] | **P0** | O plano grátis promete "1 backtest por mês" (`plan-comparison.tsx:24`, `landing-pricing-section.tsx:38`), mas /backtest e `/api/backtest/run` exigem Premium; o limite `backtest_run` (`usage-based-pricing-service.ts:34`) não é usado em lugar nenhum | Alinhar a copy à realidade (padrão) ou liberar 1 backtest rápido/mês (decisão do dono) | w7-ux-coherence |
| C-02 | /screening-acoes, /radar-dividendos × /acao/petr4, /ranking | mobile/desktop | [07][12][03] | **P0** | Mesmo ativo e mesmo modelo, duas métricas: o screening mostra "Upside +11,9%" (VJ/P−1) e a página mostra "Margem de segurança +10,6%" (1−P/VJ). Com Graham, 6,4% × 6,0%. "Upside" em inglês no screening, no blur e no radar | Card/tabela com margem de segurança; "Upside X" → "Potencial X" | w7-ux-coherence |
| C-07 | /ranking, /screening-acoes, /acao/petr4, /bdr/aapl34, /comparador, /onde-aportar, /carteira/[id] | mobile 390 (e desktop na carteira) | [02][03][06][12][05] | **P0** | O botão flutuante do Ben cobre "Backtest do ranking", valores de card, a célula de margem do Graham, títulos e o segmento "Equilíbrio" | FAB some ao rolar para baixo, evita `table`/`data-ben-fab-avoid` e fica na calha à direita no desktop (`ben-chat-fab.tsx`) | w7-mobile-polish |
| B-02 | /ranking (Backtest do ranking) | desktop | [16] | P1 | Com 2 resultados, o diálogo diz "Continuar com 5 empresas", "20,0% cada" e "5 empresas: CMIG4, BBAS3 e mais 2" | Componente substituído pelo botão rápido (top N limitado aos resultados) | w7-backtest-flow |
| B-03 | diálogos × /backtest | todos | [14][15] | P1 | Padrões diferentes: o diálogo usa início fixo em 01/01/2020 e aporte de R$ 1.000; a ferramenta usa 5 anos e sem aporte. Capital "10000" sem máscara no diálogo. Ainda busca `/api/dividend-yield-average` (legado desde w5) | Um padrão único em `lib/backtest/quick-backtest.ts` | w7-backtest-flow |
| B-04 | /carteira/[id], resultado do backtest | desktop | [05][11] | P1 | `/api/portfolio/[id]/to-backtest` existe sem UI; a carteira não tem "Simular no backtest". O resultado não tem "Ajustar configuração", "Criar carteira com estes ativos" nem as datas do período (só "61 meses") | Ação na carteira + faixa de cabeçalho no resultado | w7-backtest-flow |
| C-03 | /dashboard (Radar) | desktop/mobile | [04] | P1 | WEGE3 "−307,2%" de margem; em outras telas o mesmo caso mostra "< −100%" | `formatMarginOfSafety` em `valuation-metrics.ts`, usado no radar do dashboard, em empresas relacionadas, no radar-grid e no screening | w7-ux-coherence |
| C-04 | /acao/*/analise-tecnica, semáforo técnico | todos | código | P1 | "Preço justo técnico" usa o termo reservado aos modelos de valuation para uma faixa técnica | "Referência técnica" (`technical-analysis-traffic-light.tsx`) | w7-ux-coherence |
| C-05 | menu do app, /perfil | todos | `navigation.ts`, [08] | P1 | "Agenda de proventos" está em Carteiras e em Alertas; "Índices" aparece em Descobrir e como "Índices teóricos" em Carteiras; Backtest fica em "Ferramentas" no marketing e em "Carteiras" no app; /perfil chama de "Minhas inscrições" e "Monitoramentos customizados" o que o menu chama de "Alertas de preço" e "Monitoramentos" | Uma entrada e um nome por rota; teste de hrefs únicos | w7-ux-coherence |
| C-08 | /carteira/[id] | desktop 1440 claro/escuro | [05] | P1 | A tabela de posições corta "Alocação · meta" e rola na horizontal; o Ben cobre a borda | Fundir as colunas de retorno; caber em ≥ 1280 | w7-mobile-polish |
| C-10 | /acao/petr4 (free/anon) | mobile | [01] | P1 | 5 botões primários de upgrade na mesma página (score, modelos, relatório IA, sentimento, técnica) | 1 primário (cabeçalho); os demais viram linha "Disponível no Premium · Ver planos" | w7-mobile-polish |
| C-13 | /dashboard (Histórico de rankings) | todos | [04] | P1 | 5 linhas iguais "Screening de ações · Parâmetros personalizados · 25 ativos · há 3 horas" (41 salvos) | Título a partir dos parâmetros; repetidos agrupados "×3" | w7-mobile-polish |
| C-14 | / (home) | desktop/mobile | [09] | P1 | As capturas do produto mostram UI antiga: card LREN3 com "+79.9% upside", decimais com ponto e "Graham Quality Model"; backtest com "87.47%" sem período nem método (afirmação de rentabilidade sem datas) | Backtest: substituir pela vitrine real. Ranking: refazer a captura (claro + escuro), ver pendências | w7-backtest-showcase (backtest) / backlog |
| C-15 | /onde-aportar (free) | mobile | [02] | P1 (decisão) | "Minha carteira" com cadeado para free (`onde-aportar-client.tsx:239`), embora o free tenha 1 carteira; contradiz a premissa central "onde aportar" | Decisão do dono: liberar a fonte "Minha carteira" para free | — (dono) |
| C-06 | /screening-acoes, /analise-setorial, /radar-dividendos, /comparador, /pl-bolsa | todos | [03] | P2 | Breadcrumb inconsistente: "Ferramentas" leva a /ranking; outras telas de topo usam "Início >"; ranking, onde aportar e carteiras não têm nenhum | Topo de menu sem breadcrumb; páginas aninhadas com "Pai > Página" | w7-ux-coherence |
| C-09 | /etf/bova11 | mobile 390 | [06] | P2 | A 3ª ação ("Comparar ETFs") fica cortada numa linha rolável sem indicação | Quebrar em 2 linhas ou mostrar 2 + menu | w7-mobile-polish |
| C-11 | /acao/petr4 (free) | mobile | [01] | P2 | O "Tom predominante" está borrado, mas a prévia do resumo começa com "Sentimento predominantemente positivo…" | Prévia neutra para não-premium | w7-mobile-polish |
| C-12 | /carteira (free, vazia) | mobile | [03] | P2 | "Criar a partir de um backtest" para quem não tem backtest (beco sem saída) | Esconder para não-premium | w7-ux-coherence |
| B-05 | /backtest | mobile 390 | [07] | P2 | Abas cortadas ("Minhas c…") | Rótulos curtos no mobile | w7-backtest-flow |
| C-16 | /dashboard (Radar) | todos | [04] | P2 | FII no radar com margem "—" e status "—", embora o FII tenha preço-teto | Usar preço-teto/margem do FII no radar | backlog |
| C-17 | cabeçalho de ativo | todos | [12] | P2 | "Muito Bom" em title case (vem das uniões de tipo em `lib/strategies/overall-score.ts`) | Rótulo de exibição em sentence case | backlog |
| C-18 | /acao/petr4 com o painel do Ben aberto | desktop 1440 | [11] | P2 | O painel cobre a coluna "Status" da tabela de valuation ("Abaixo do pre…") | Reflow do conteúdo quando o painel abre em < 1600 px | backlog (w6) |
| C-19 | /carteira/[id] | desktop | [05] | P2 | 3 sinais para a mesma coisa: badge "Rebalanceamento sugerido", "Há sugestões para a carteira" e "Conclua as sugestões de aporte primeiro" | Um aviso só, com contagem | backlog |
| C-20 | /metodologia | desktop | código | P2 | Não há seção de backtest; o índice lateral não lista "Onde aportar" | Seção `#backtest` (vitrine) | w7-backtest-showcase |
| C-21 | /acao, /ranking, /dashboard | — | código | P2 | Só 2 rotas têm `loading.tsx` (onde-aportar, carteira/[id]); a navegação para páginas SSR pesadas não dá retorno visual | Skeleton por rota (medir antes em produção) | backlog |
| C-22 | app logado, mobile | mobile | [03] | P2 | Rodapé de marketing completo (≈ 1 tela) abaixo de cada página do app, com a navegação inferior presente | Rodapé compacto no app | backlog |

Pendências conhecidas, que continuam valendo e não são achados novos:
- HGLG11 com score 91 e "−74% acima do preço-teto" (fórmula do DY-alvo de tijolo, decisão do dono);
- AAPL34 com preço justo de R$ 6,59 e margens "< −100%" (moeda/paridade de BDR).

## Backtest: mapa do fluxo atual

| Entrada | Arquivo | O que acontece hoje | Onde o usuário termina |
|---|---|---|---|
| Página do ativo: ação "Backtest" (ações e BDR) | `strategic-analysis-client.tsx:237-254` → `backtest-config-selector.tsx` | Diálogo "Adicionar PETR4 ao backtest": aba "Configurações existentes" (escolher e "Adicionar à configuração", que redistribui os pesos da config salva) ou "Nova configuração" (nome obrigatório, datas, capital, aporte) → POST `/api/backtest/configs` → toast → fecha | Na mesma página do ativo. O botão vira "No backtest". Nada foi executado |
| Ranking: linha da tabela | `ranking-wizard/ranking-results-table.tsx:154` → `add-to-backtest-button.tsx` → o mesmo seletor | Igual ao anterior | No ranking |
| Ranking: "Backtest do ranking" | `quick-ranker.tsx:373,528,632` → `batch-backtest-selector.tsx` | Passo 1 (top N, slider) → passo 2 (config existente ou nova, com nome obrigatório) → POST → toast → fecha | No ranking |
| Comparador de ações | `compara-acoes/[...tickers]/page.tsx:601` → `add-to-backtest-button.tsx` | Igual ao seletor por ativo | No comparador |
| Carteira → backtest | `/api/portfolio/[id]/to-backtest` (sem UI) | Não existe botão | — |
| Backtest → carteira | `portfolio-empty-state.tsx` → `convert-backtest-modal.tsx` → `/api/portfolio/from-backtest` | Só na lista de carteiras vazia; não aparece no resultado do backtest | /carteira |
| Menu, rodapé, home, landing | `navigation.ts`, `page.tsx:101`, `backtest-landing.tsx` | `/backtest` sem `configId` | A carteira de exemplo na aba Configurar |
| Ben (links nas respostas) | `ben-context/answer-links.ts`, `ben-tools.ts` | Link para `/backtest` | A carteira de exemplo |

Restos:
- `localStorage['backtest-preconfigured-assets']` ainda é lido por `backtest-page-client.tsx:288-323`, mas só os ramos mortos de `add-to-backtest-button.tsx` escrevem nele;
- a URL já sabe pousar no resultado (`?view=results&configId=…` carrega o último resultado), mas nenhuma entrada usa;
- `/api/backtest/run` aceita `{ configId }` sozinho (`run/route.ts:105`), ou seja, "executar a config salva" já existe.

Caminho mínimo atual até ver um resultado a partir da página do ativo:
1. abrir o diálogo;
2. trocar para "Nova";
3. digitar um nome;
4. criar;
5. ir ao menu Backtest;
6. abrir "Minhas configurações";
7. abrir a config;
8. conferir o formulário;
9. "Executar backtest" (fim de uma página de ~1.700 px no desktop);
10. a aba "Resultados".

São 9–10 passos, e o 5 não é óbvio.

**Fluxo proposto** (lote `w7-backtest-flow`):
1. Clique em "Backtest" (ou "Simular no backtest" na carteira; "Backtest do ranking" com top 3/5/10).
2. Estado ocupado no próprio botão ("Simulando 5 anos…").
3. `POST /api/backtest/quick`. Padrões: últimos 5 anos completos, R$ 10.000 + R$ 1.000/mês, pesos iguais (ou os pesos da carteira), rebalanceamento mensal, nome automático. Faz upsert de config, ajusta o período se faltar histórico e executa.
4. Pouso em `/backtest?view=results&configId=…&from=<origem>`, com a faixa "Simulação rápida de PETR4 · out. 2021 a set. 2026 · R$ 10.000 + R$ 1.000/mês · mensal", **Ajustar configuração** (primário), "Voltar para PETR4", aviso de período ajustado e, no resultado, "Criar carteira com estes ativos".
5. "Personalizar antes" continua como ação secundária (abre Configurar já preenchido, sem executar).

Free e anônimo mantêm o caminho de upgrade/login. FII continua indisponível.

## Vitrine de backtests: avaliação

**Valor.**
- Confiança: alto. Hoje o único "resultado" que o visitante vê é uma captura estática com "87.47%", sem período, método nem custos, o que é pior para a confiança e para a CVM do que não mostrar nada. Um resultado real, datado, reprodutível pelo próprio usuário (o "Abrir no backtest" mostra o mesmo número), com drawdown e custos ao lado, demonstra o produto sem prometer nada.
- Conversão: moderado. Backtest é recurso Premium e não é a premissa central (Onde aportar). Por isso a vitrine vai na landing do backtest, no card de upgrade e no bloco "Backtest" da home, e não no hero.

**Riscos e como neutralizar:**
- *Cherry-picking:* definições fixas no código, escolhidas por regra antes de olhar resultado e mostradas sempre juntas e na mesma ordem, inclusive quando perdem do CDI. Se uma falhar, o bloco inteiro some. Mudança de definição só com nota datada em /metodologia.
- *Viés de sobrevivência e de olhar para trás:* **não** fazer "Top Graham rebalanceado" nem nada derivado do ranking de hoje. O motor não tem fundamentos *point-in-time*, então isso seria look-ahead puro. A evidência de estratégia já existe nos índices IPJ (/indices), que são track record a partir da data de criação; basta linkar com a data real de início.
- *Benchmark favorável:* o Ibovespa do motor é o índice de preço (`^BVSP`, sem proventos), o que favorece carteiras de dividendos. Isso precisa ser dito no card e na metodologia.
- *Promessa:* nada de "ganhe", "bata o CDI" ou "melhor". O card mostra período exato, aportes, custo de 0,03% e total em R$, que IR e spread não entram, "Calculado em", "Rentabilidade passada não garante resultados futuros" e o link para `/metodologia#backtest`.

**Cálculo honesto:**
- determinístico, com o mesmo `BacktestService.runBacktest`;
- dados reais (`HistoricalPrice` mensal e `DividendHistory`);
- janela = últimos 5 anos completos (muda 1×/mês);
- `unstable_cache` de 7 dias com tag e um cron `/api/cron/backtest-showcase` que revalida;
- sem gravar no banco e sem mudar o schema.

**Veredito: GO, com escopo pequeno.** Três vitrines sem escolha de ações:
1. BOVA11 com R$ 1.000/mês;
2. DIVO11 com os mesmos aportes;
3. a carteira de exemplo da ferramenta, declarada como "não escolhida pelo desempenho".

Só depois de `w7-backtest-flow`, porque o CTA "Abrir no backtest" usa o endpoint rápido. Antes de divulgar fora do produto (e-mail, anúncios), passar pelo mesmo advogado/CNPI do modo "Todo o mercado".

## Lotes da onda 7 (ordem de valor)

1. `w7-backtest-flow`: um clique de qualquer tela até o resultado; "Ajustar configuração"; carteira → backtest; limpeza dos seletores legados. (B-01…B-05)
2. `w7-ux-coherence`: copy do plano grátis honesta; uma métrica e um vocabulário (margem de segurança, potencial, referência técnica); piso de margem; menu sem duplicatas; breadcrumbs. (C-01…C-06, C-12)
3. `w7-backtest-showcase`: vitrine real e datada na landing do backtest, no card de upgrade e na home; seção `#backtest` na metodologia; cron de revalidação. (C-14, C-20)
4. `w7-mobile-polish`: o Ben nunca cobre conteúdo; tabela da carteira cabe a 1440; 1 upsell por página; histórico de rankings legível; ações do ETF. (C-07…C-11, C-13)

Os lotes 1, 2 e 4 não compartilham arquivos e rodam em paralelo; o 3 roda depois do 1. Os P2 sem lote ficam no backlog: C-14 (captura do ranking claro/escuro), C-16, C-17, C-18, C-19, C-21, C-22.
