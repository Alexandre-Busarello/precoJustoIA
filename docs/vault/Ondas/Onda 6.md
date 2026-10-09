---
tags: [onda, onda-6, ben]
updated: 2026-10-09
fontes: [docs/melhorias-2026-09/RESUME.md, docs/melhorias-2026-09/batches/w6-*.md, token-ledger.tsv (scratch)]
---
# Onda 6: Ben contextualizado e novo chat (09–10/10/2026)

> Dois lotes **em sequência**: o segundo depende do primeiro, e o primeiro deixou notas para ele (`93d3c1f`).

## Lotes
| Lote | Ciclos | Agentes | Tokens | Commit |
|---|---|---|---|---|
| `w6-ben-context` | 1 | 3 | 481.685 | `87a519a` + `d683517` |
| `w6-ben-ui` | wip (3 bloqueantes) | 5 | 798.768 | `d926413` |
| Integração (corrige os 3 bloqueantes) | — | 1 | 132.098 | `10df504` |

**Total ≈ 1,41 mi tokens.** 405 testes.

## Entregas
- Contexto de cada tela, atalhos "Perguntar ao Ben" e links nas respostas.
- Painel lateral no desktop e folha no mobile, com sugestões por tela, streaming, limites e histórico.
- Correções finais:
  - foco após parar;
  - layout do aviso;
  - conversa excluída;
  - ticker com `%` solto (`d683517`).

Ver [[Ben]].

## Pendências
- `section-header.tsx` mudou: as ações quebram linha em todos os usos.
- Conversas vazias continuam no banco. Ver [[Pendências]].

## Fechamento
- `ddc59dc`: docs de deploy e gasto.
- 29 commits locais à frente do GitHub.
- **O schema do Prisma não mudou em nenhuma onda.**
- `next build` validado contra o banco local em 10/10.

## Relacionadas
[[Onda 5]] · [[Custo de tokens]] · [[00 - Início]]
