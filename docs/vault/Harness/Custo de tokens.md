---
tags: [harness, custo, tokens]
updated: 2026-10-09
fontes: [token-ledger.tsv no scratch da sessão a849a1b4]
---
# Custo de tokens

> Cada lote custou **~0,4–0,9 mi tokens** de subagentes. As **ondas 3–6 somaram ≈ 6,39 mi**.

| Onda | Tokens | Observação |
|---|---|---|
| 3 | 1,92 mi | Onde aportar sozinho: 878 mil (2 ciclos) |
| 4 | 1,00 mi | |
| 5 | 2,06 mi | |
| 6 | 1,41 mi | `w6-ben-ui`: 799 mil, wip |

- Lote aprovado no 1º ciclo = 3 agentes (programador, QA, committer): 360–500 mil.
- Com 1 ciclo de correção = 5 agentes: 435–880 mil.
- Integração: 86–188 mil.
- Relógio: ~40–100 min por lote rodando um a um.
- As ondas 0–2 não foram medidas por lote. A onda 2 levou ~7,2 h com 50 agentes.

## Como medir
1. Cada resultado de agente no Workflow informa os tokens. Some por lote.
2. Registre em `<scratch>/token-ledger.tsv` com as colunas `lote, inicio, fim, tokens_subagentes, agentes, resultado`.
3. Para economizar: `concurrency: 1`, `skipIntegration`, `maxCycles: 2`, specs estreitas e um contexto obrigatório curto.

Ver também: [[Harness]] · [[Onda 3]] · [[Onda 6]]
