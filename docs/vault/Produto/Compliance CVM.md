---
tags: [produto, compliance, cvm]
updated: 2026-10-09
fontes: [docs/melhorias-2026-09/reports/mercado-financeiro.md, scripts/check-compliance.sh, src/lib/site-constants.ts]
---
# Compliance CVM

> A plataforma publica **métricas e resultados de modelos**, nunca opinião de compra ou venda nem conselho personalizado.

## Enquadramento (mercado-financeiro.md §4)
- **Res. CVM 20/2021:** relatório com recomendação, preço-alvo ou opinião de compra/venda é atividade privativa de analista credenciado.
- **Res. CVM 19/2021 + Res. 30 (suitability):** personalizar por perfil é consultoria.
- **CDC art. 37:** alegações de exclusividade ("único no Brasil") são publicidade enganosa.
- Permitido: métricas de modelos com metodologia e limites explícitos, sem personalização.
- [[Onde aportar]] é enquadrado como **calculadora com os critérios do usuário**. Validar o modo "Todo o mercado" com advogado/CNPI antes de marketing pesado.

## Vocabulário
| Nunca | Usar |
|---|---|
| Compra / Venda / Sinal de compra | Abaixo do preço justo / Acima do preço justo |
| Região segura | Dentro da faixa estimada |
| garantida, preditiva | estimativa, hipótese |
| único(s) no mercado/Brasil, melhores ações | (remover) / "Ranqueie ações por modelos consagrados" |
| recomendação | só dentro de "não é recomendação" |
| preço-alvo | "Preço justo (<modelo>)" com data base |

- Margem de segurança = 1 − P/VJ; potencial = VJ/P − 1. Ver [[Margem de segurança e upside]].
- O campo `recommendation` do score virou `qualityLabel`. Ver [[Overall score]].
- Aviso legal oficial: `LEGAL_NOTICE` em `src/lib/site-constants.ts`.

## Guardas
- `scripts/check-compliance.sh <arquivos>` reprova os termos acima. Ele trata negações ("não é recomendação"), comentários, testes, admin e o livro de transações da carteira, onde "compra" é o nome do lançamento.
- A CI (`.github/workflows/quality.yml`) roda a guarda nos arquivos alterados do PR.
- O guardrail do [[Ben]] recusa "devo comprar X?". Os prompts de IA foram reescritos sem pedir "recomendação" (`85eeb53`, `57fc0f1`, [[Onda 4]]).

## Relacionadas
[[Decisões do dono]] · [[Design system]] · [[Revisão do coordenador]] · [[00 - Início]]
