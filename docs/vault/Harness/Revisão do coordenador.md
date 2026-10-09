---
tags: [harness, coordenador, riscos]
updated: 2026-10-09
---
# Revisão do coordenador

> QA aprovado não é suficiente. O coordenador leu todo laudo e corrigiu riscos de produção que passaram pelos agentes.

| Risco | Correção |
|---|---|
| O dedupe de proventos de FII **apagava** linhas do Yahoo por heurística (podia remover um extraordinário legítimo) | `f15d22f`: não apaga; o dedupe passa a ser só na leitura (`dedupeDividends`) |
| O rate limit da API nascia em `enforce` sem nunca ter rodado em produção | `86ffed8`: `API_RATE_LIMIT_MODE` padrão `log` |
| Prompts de IA pediam "a recomendação" | `85eeb53`, `57fc0f1` |
| Build de produção quebrando no prerender | `b10e34d`, validado com `next build` no banco local |
| Testes travando o lock | `3743315`, `9680fb4` |
| Lote `wip` só com escopo pendente | `w5-data-consistency` aprovado pelo coordenador |

**Regra:** tudo que apaga dados, muda um padrão de produção, fala em nome da empresa ou mexe com dinheiro passa pelo coordenador antes do push.

Ver também: [[Harness]] · [[Compliance CVM]]
