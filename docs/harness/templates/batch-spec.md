# BATCH <id> (wave <N> — <roda sozinho | em paralelo com <ids>, arquivos disjuntos>): <título curto>

<!--
Como usar este template:
- Um arquivo por lote em docs/<programa>/batches/<id>.md. O id segue "w<onda>-<tema>" (ex.: w3-screening-filters).
- O mesmo id, o título e os ownedPaths vão para backlog.json.
- Escreva em inglês ou pt-BR, mas seja concreto: rotas, arquivos, números, nomes de componentes.
- Cada TASK tem prioridade (P0 obrigatório, P1 desejável, P2 se sobrar).
- Tudo o que o QA vai checar precisa estar em ACCEPTANCE ou TEST PLAN. O que não estiver lá, o QA não cobra.
-->

<Uma linha de motivação. Cite a decisão do dono se houver: "Owner decision (AAAA-MM-DD): ...">

## OWNED PATHS (edit only these; importing from anywhere is fine)
- src/components/<área>/**
- src/app/<rota>/**
- src/lib/<módulo>.ts
- src/lib/__tests__/<módulo>*.test.ts
- <arquivo compartilhado> (<ESCOPO RESTRITO: só o caminho X — não mexer em Y>)

MECHANICAL-ONLY (opcional; pode tocar só para ajustes mecânicos como trocar um import):
- <arquivo>

<!-- Regra de ouro: nenhum caminho aqui pode aparecer em OWNED PATHS de outro lote da MESMA onda.
     Verifique antes de disparar (ver docs/harness/README.md, "Conferir disjunção"). -->

## CONTEXT YOU MUST READ FIRST
- docs/<programa>/backlog-rules.md (global rules).
- docs/vault/00 - Início.md e as notas: [[<nota 1>]], [[<nota 2>]].
- O que ondas anteriores já fizeram aqui: git log -- <caminhos>.
- <Helpers que DEVEM ser reutilizados, com caminho; "import it; do not re-implement".>
- <Seção do relatório do especialista: reports/<x>.md §<n>.>

## TASKS
1) <Nome> (P0). <O que muda, para quem, em qual rota. Valores padrão, rótulos exatos da UI, unidades.>
2) <Nome> (P0). <...>
3) <Desempenho / dados> (P1). <Ex.: uma query por tipo de dado, cache por dia; p95 < 2 s no banco local.>
4) Compliance copy (P0). <Termos proibidos e o aviso exato a exibir.>
5) SEO (P1). <metadata, canonical, sitemap, se aplicável.>

## ACCEPTANCE
- <Comportamento verificável 1, com valores.>
- <URLs antigas continuam 200 / dados salvos continuam válidos.>
- Unit tests for <lógica pura> pass (timeout 300; sem Prisma/DB/rede nos testes).
- tsc clean, eslint clean on changed files, check-ui and check-compliance pass; no horizontal scroll at 320/360; dark legible.

## TEST PLAN
- <rota>: <passo> → <resultado esperado> (anon | free | premium).
- <conferência numérica à mão contra o banco local para 1–2 tickers>.
- Screenshots mobile + desktop, light + dark, <modos de auth>; gating de plano inalterado.

## Carry-over (preencher antes de disparar a onda)
- <Pendências de ondas anteriores que caem neste lote, decisões do dono tomadas depois da spec, comportamentos que NÃO podem quebrar.>
- Run every test with timeout 300; unit tests must not import Prisma/DB modules.
