---
tags: [pendencias, living]
updated: 2026-10-09
fontes: [docs/melhorias-2026-09/RESUME.md, notas do vault]
---
# Pendências

> Lista viva. Marque `[x]` quando resolver, com o commit, e acrescente o que surgir. A fonte de status oficial do programa 2026-09 é `docs/melhorias-2026-09/RESUME.md`.

## Deploy (fechamento da onda 6)
- [ ] Push da branch `melhorias/ux-ui-mobile` (29 commits das ondas 3–6 à frente do GitHub). O dono faz.
- [ ] Vercel: definir `API_RATE_LIMIT_MODE`. O padrão é `log`; mudar para `enforce` depois de olhar os logs. Ver [[Middleware e rate limit]].
- [ ] Agendador externo:
  - [ ] `/api/cron/aporte-mensal`;
  - [ ] `/api/cron/macro-indicators`;
  - [ ] `/api/cron/calculate-ibov-projections` (opcional, 1×/dia após 18h30).
  - Ver [[Crons]].
- [ ] Depois do deploy, testar:
  - [ ] login e rotas protegidas (middleware em `src/`);
  - [ ] `curl -I https://precojusto.ai/upgrade` → 301 para `/checkout`;
  - [ ] `/fundador` → 410;
  - [ ] seletor de tema;
  - [ ] painel do Ben no celular.

## Decisões do dono em aberto
- [ ] **DY-alvo de FII de tijolo:** NTN-B real + IPCA + spread de 2,5 p.p. dá 7,68% + 4,0% + 2,5% = **14,18%** com os fallbacks (`src/lib/fii-listing-valuation.ts:9,29`). Deixa HGLG11 a −68% do teto com score 93 (número do RESUME). Ver [[FII score e preço-teto]].
- [ ] **Anti-armadilha:** critérios por perfil toleram 2 falhas (banco pode falhar ROE e payout; TAEE11 passa com Dív. líq./EBITDA 3,6; B3SA3 cai no perfil "bancos e seguradoras"). Tornar obrigatórios? Ver [[Anti-armadilha]].
- [ ] Rótulo "Data ex" na agenda. É a data ex de fato, e o InfoHint explica a data-com. Ver [[Agenda de proventos]].
- [ ] Validar o modo "Todo o mercado" do [[Onde aportar]] com advogado ou CNPI antes de marketing pesado.
- [ ] Proposta de preços (Premium R$ 199/ano, Pro) e abertura do plano grátis. Ver [[Planos e preços]].

## Dados e finanças
- [ ] `NTNB_REAL_LONG` sem fonte automática. O símbolo só é lido (`src/lib/finance/macro.ts:239-240`), e o cron do BCB busca só Selic, CDI e IPCA (`macro.ts:44`). Na prática vale o fixo de 7,68%.
- [ ] A UI diz "IPCA esperado", mas o valor usado é o IPCA realizado em 12 meses (`macro.ts:17-20`).
- [ ] `dataCoverage` e `qualityLabel` do score não aparecem em nenhum componente. `src/components/compact-score.tsx:13` ainda usa os rótulos antigos ("Empresa Excelente…"). Ver [[Overall score]].
- [ ] Possível bug: em `refreshEtfAiAnalyses` (`src/lib/etf-scoring.ts:305-311`), com `forceAll` falso, a segunda chave `OR` sobrescreve a primeira. Não testado. Ver [[ETF score]].
- [ ] E-mail "Seu aporte do mês": não há tela para ativar a preferência `APORTE_MENSAL`, que só é lida no cron.

## Divergências de parâmetros nos modelos (encontradas ao escrever o vault, 09/10)
- [ ] Graham/FCD: a margem mínima do registro (0,20 / 0,15, `src/lib/ranking-models.ts:176,270`) difere do `STRATEGY_CONFIG` (0,1667 / 0,13). Valem os do registro. O Graham ainda mistura potencial ≥ 10% na análise (`graham-strategy.ts:108`) com desconto no ranking. Ver [[Graham]] e [[FCD]].
- [ ] P/L baixo: P/L máximo 15 na página do ativo e 12 no ranking; a análise usa médias de 7 anos e o ranking, valores atuais. Ver [[P-L baixo]].
- [ ] Fórmula Mágica no ranking: `minROIC`/`minEY` ficam em 0 porque `withRegistryDefaults` não traz o `STRATEGY_CONFIG`. Na página do ativo valem 15% e 8%. Ver [[Fórmula Mágica]].
- [ ] Barsi: os padrões da classe (5 anos / 2,0) diferem dos do registro (3 / 1,0). Valem os do registro. Ver [[Barsi]].
- [ ] FCD: o slider de taxa de desconto padrão (10%) fica abaixo do Ke calculado e, na prática, não muda o resultado. Ver [[FCD]].
- [ ] Bazin: a strategy.md previa Bazin no plano grátis, mas o registro está como `premium` (`src/components/asset/valuation-models.ts:93`). Decisão do dono. Ver [[Bazin]].
- [ ] Estratégia 3+1: detecta banco/seguradora por uma lista própria (`fundamentalist-strategy.ts:368-380`), não pela `sector-classification`. Ver [[Estratégia 3+1]].
- [ ] P/VP de bancos: o texto diz "IPCA esperado" (`bank-pvp-strategy.ts:157`), mas o código usa o IPCA de 12 meses. Ver [[P-VP bancos]].

## Produto e UI
- [ ] `src/components/ui/section-header.tsx` mudou (as ações quebram linha) e isso afeta todos os usos. Conferir as telas com cabeçalho de seção.
- [ ] Conversas vazias do [[Ben]] (pergunta interrompida antes da resposta) ficam no banco, só escondidas na UI. Falta a limpeza no servidor.
- [ ] Confirmar com o dono a frequência de atualização e as fontes exibidas (`src/lib/site-constants.ts`).
- [ ] Botão do Ben no BDR mobile ainda cobre a coluna: `src/components/asset/valuation-table.tsx` não tem `data-ben-fab-avoid`. Ver [[Ben]].
- [ ] `src/app/api/cron/auto-renewal/` e `cleanup-expired-premium/` são pastas vazias, sem `route.ts`. O `vercel.json` só agenda os 4 crons de ETF. Ver [[Crons]].
- [ ] PWA offline (Serwist): adiado porque exige build. Ver [[Build proibido]].

## Harness
- [ ] Seed local: `free@local.test` tem um trial já expirado, mas a janela ainda é de 7 dias (`scripts/local/seed-local.ts:1043`, de −200 a −193 dias). A regra do produto é 1 dia. Não afeta os testes, mas convém alinhar.
- [ ] `scripts/local/screenshots.ts` não trata `--help` (não há referência a `help` no arquivo em 09/10). Ele também continua gravando em `<cwd>/shots` quando `--out` não é passado.

## Relacionadas
[[Decisões do dono]] · [[00 - Início]]
