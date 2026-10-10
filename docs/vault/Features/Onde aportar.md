---
tags: [feature, onde-aportar]
updated: 2026-10-09
fontes: [src/lib/allocation/engine.ts, src/lib/allocation/constants.ts, src/lib/allocation/fundamentals.ts, src/lib/allocation/load-context.ts, src/lib/allocation/service.ts, src/app/api/cron/aporte-mensal/route.ts]
---
# Onde aportar
> Premissa central do produto: "tenho R$ X, onde aporto?". Uma calculadora determinística, sem LLM, distribui o aporte em cotas inteiras segundo os critérios do usuário: desconto frente ao preço justo, qualidade e distância até o peso-alvo.

## Fórmula / como funciona
Motor puro (`src/lib/allocation/engine.ts:1-13`); `runAllocation` (`:452`) e `runMarketAllocation` (`:491`).
1. **Travas** (`evaluate`, `:107`). O ativo fica de fora com um motivo numérico se:
   - for BDR ou ETF (`:112-117`);
   - não tiver cotação;
   - a liquidez estiver abaixo do mínimo (`:120-125`);
   - não tiver nota ou tiver cobertura < mínimo ("nota baseada em X de Y critérios", `:127-136`);
   - a nota estiver abaixo do mínimo (`:137`);
   - os fundamentos estiverem em piora ou não houver histórico (`:146`);
   - o preço estiver acima do valor estimado em **todos** os modelos escolhidos (`:168`);
   - já estiver no peso-alvo, quando o usuário segue os pesos (`:175-189`).
2. **Fundamentos preservados** (`fundamentalsStatus`, `src/lib/allocation/fundamentals.ts:53`, sobre `fundamentalsIntact`): lucro 12m cai até 15%; ROE e margem caem até 3 p.p.; dívida líq./EBITDA sobe até 1,0x (`src/lib/finance/signals.ts:78-84`). Sem 8 trimestres, usa 2 anos consecutivos; em bancos, o critério de alavancagem é ignorado.
3. **Prioridade** = `(w_val × desconto + w_qual × nota/100 + w_alvo × gap/gap_máx) × penalidade` (`engine.ts:246-250`). O desconto é a mediana da margem `1 − P/VJ` nos modelos, mapeada de −50% (0) a +50% (1) (`constants.ts:91-92`). Os pesos são normalizados (`activeWeights`, `engine.ts:194`).
4. **Distribuição** (`distribute`, `:314`): cada ativo recebe uma parte proporcional à prioridade, em cotas inteiras ou em lote de 100 sem fracionário (`:268-270`), limitada por ativo, pela concentração na carteira, pelo setor e pelo alvo. O que sobra é distribuído em seguida. Desempate: maior desconto, depois maior liquidez, depois ticker (`compareScored`, `:206`). O resultado nunca passa do aporte e informa a sobra (`:423`).
5. **"Todo o mercado"**: mesmo motor, sem pesos-alvo (`:502`). Escolhe N ativos com limite por setor (`:506-528`). No modo "Complementar", o ativo ou setor que já passou do limite tem a prioridade ×0,5 (`:217-239`). A saída traz o funil de travas (`:468-485`) e os 20 primeiros candidatos (`MARKET_CANDIDATES_SHOWN`).

## Parâmetros e limiares
| parâmetro | valor | onde |
|---|---|---|
| Presets (desconto / qualidade / alvo) | Mais desconto 0,7/0,3/0 · Equilíbrio 0,4/0,4/0,2 (padrão) · Seguir pesos 0,3/0,1/0,6 | `constants.ts:61-80` |
| Teto por ativo / concentração na carteira | 40% do aporte / 25% da carteira após o aporte | `constants.ts:103-104` |
| Nota mínima / cobertura mínima | 50 / 60% dos critérios | `constants.ts:108-109` |
| Liquidez mínima: ação / FII / BDR | R$ 1 mi / R$ 500 mil / R$ 200 mil por dia | `src/lib/finance/liquidity-rules.ts:12-16` |
| Mercado: nº de ativos / por setor | 5 (faixa 1–10) / 2 ativos e 35% do aporte | `constants.ts:114-119`, `engine.ts:506` |
| Penalidade "Complementar" | ×0,5 | `constants.ts:95` |
| Grátis/anônimo | até 3 tickers, só Graham | `constants.ts:44-47` |
| Premium | até 40 tickers, todos os modelos | `constants.ts:49` |
| Aporte | R$ 10 a R$ 10 mi | `constants.ts:51-52` |
| Modelos | ação: Graham, FCD, Gordon, Bazin, P/VP justo; FII: preço-teto | `constants.ts:34-39` |
| Rate limit da simulação | 12/min, 60/15 min, 150/h, 600/dia por IP | `src/lib/allocation/rate-limit.ts:4-12` |
| Cache do contexto por ativo | 4 h (por dia) | `load-context.ts:26` |

## Quando não se aplica
- ETF e BDR: sem preço justo aplicável ([[ETF score]]). Lynch e Barsi não entram, porque não têm preço justo próprio (`load-context.ts:10`).
- O modo "Todo o mercado" é só Premium. Grátis e anônimo veem uma prévia mascarada, sem tickers (`service.ts:135-159`, `maskResult` em `engine.ts:565`).

## Saídas na UI
- `/onde-aportar`, com componentes em `src/components/allocation/*`. Três passos (valor, universo, critério); a tabela tem Ativo · Qtd · Preço · Valor · % · Por quê, mais "Ficaram de fora", premissas e link para `/metodologia#onde-aportar` (`src/app/metodologia/page.tsx:391`).
- O Premium pode registrar as compras na carteira como transações PENDENTES (`service.ts:232`, `/api/allocation/register`).
- [[Carteira]]: as sugestões de aporte usam o motor no preset "pesos" com `respectTargets` (`src/lib/portfolio-transaction-service.ts:748`).
- Dashboard: bloco `DashboardAporteBlock` (`src/app/dashboard/page.tsx:10`). Home: CTA "Calcular onde aportar" (`src/app/page.tsx:154`). Navegação: `src/lib/navigation.ts:46`.
- E-mail "Seu aporte do mês": `GET /api/cron/aporte-mensal` com `Bearer CRON_SECRET`. Vai para Premium com carteira ativa e `reportPreferences.APORTE_MENSAL = true`. Usa os 3 ativos de maior prioridade e R$ 1.000 quando a carteira não tem aporte configurado. Aceita `dryRun=1` (`route.ts:12-42`).
- Avisos obrigatórios: `ALLOCATION_DISCLAIMER` e `MARKET_DISCLAIMER` (`constants.ts:131-135`).

## Decisões e histórico / pendências
- Decisão do dono: premissa central, números determinísticos e enquadramento de "calculadora com os critérios do usuário" ([[Compliance CVM]]). Onda 3 (`407e805`; spec em `docs/melhorias-2026-09/batches/w3-onde-aportar.md`).
- **Validar o modo "Todo o mercado" com advogado ou CNPI** (Res. CVM 19/20) antes de divulgar com força.
- Agendar `/api/cron/aporte-mensal` no agendador externo. No código não achei UI de opt-in para `APORTE_MENSAL`: a flag só é lida no cron.
- Pendências da onda 3:
  - as sugestões da carteira ficaram mais rigorosas e podem deixar caixa parado;
  - compras pendentes do Onde aportar não entram nas sugestões;
  - descartar uma compra deixa o "Aporte registrado" órfão;
  - visitantes disparam o cálculo pesado do mercado;
  - os checkboxes de ETF e BDR do filtro de mercado nunca retornam resultado (consequência das travas `:112-117`).

## Relacionadas
[[Graham]] · [[FCD]] · [[Gordon]] · [[Bazin]] · [[P-VP bancos]] · [[FII score e preço-teto]] · [[Overall score]] · [[Margem de segurança e upside]] · [[Sinais financeiros]] · [[Carteira]] · [[Crons]] · [[Compliance CVM]] · [[Decisões do dono]] · [[Onda 3]] · [[Pendências]]
