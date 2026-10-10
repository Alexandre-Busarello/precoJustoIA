---
tags: [moc, inicio]
updated: 2026-10-09
---
# Preço Justo AI: segundo cérebro

> **Consulte antes de cada nova implementação.** Leia as [[Decisões do dono]], as [[Pendências]] e as notas da área que você vai tocar. O método de execução está em [[Harness]] (`docs/harness/README.md`).

Regras que nunca mudam:
- O `.env` é **produção**. Ver [[Banco de produção no .env]] e [[Build proibido]].
- O trial é de 1 dia. Os preços não mudam sem o dono.
- Dark mode completo, copy CVM-safe e números determinísticos.

## Produto
- [[Visão do produto]]
- [[Planos e preços]]
- [[Compliance CVM]]
- [[Decisões do dono]]

## Arquitetura
- [[Stack]]
- [[Fontes de dados]]
- [[Crons]]
- [[Caches]]
- [[Middleware e rate limit]]
- [[Tema e dark mode]]
- [[Design system]]
- [[Ambiente local e CI]]

## Finanças (fórmulas tiradas do código)
- **Base:** [[Margem de segurança e upside]] · [[Sinais financeiros]]
- **Ações, preço justo:** [[Graham]] · [[FCD]] · [[Gordon]]
- **Ações, dividendos:** [[Bazin]] · [[Barsi]] · [[Anti-armadilha]]
- **Ações, relativos e qualidade:** [[Lynch]] · [[P-VP bancos]] · [[Fórmula Mágica]] · [[P-L baixo]] · [[Estratégia 3+1]]
- **Scores:** [[Overall score]] · [[FII score e preço-teto]] · [[ETF score]]
- **Mercado:** [[IBOV faixas estatísticas]]

## Features
- [[Onde aportar]] (premissa central)
- [[Screening]]
- [[Ranking]]
- [[Backtest]]
- [[Agenda de proventos]]
- [[Alertas]]
- [[Ben]]
- [[Carteira]]
- [[Radar]]

## Ondas do programa 2026-09
| Onda | Tema |
|---|---|
| [[Onda 0]] | Fundação: tokens, dark mode, primitivos |
| [[Onda 1]] | 13 lotes de páginas |
| [[Onda 2]] | Correção financeira, modelos novos, plataforma |
| [[Onda 3]] | Onde aportar, screening, IBOV |
| [[Onda 4]] | Limpeza, CI, dark mode liberado |
| [[Onda 5]] | Consistência de dados, plataforma, BDR, mobile |
| [[Onda 6]] | Ben contextualizado e novo chat |

Status oficial: `docs/melhorias-2026-09/RESUME.md`.

## Harness
- [[Harness]]
- [[Revisão do coordenador]]
- [[Custo de tokens]]
- [[Limite de memória e watchdog]]
- [[Testes travados com Prisma]]
- Armadilhas: [[Espera com pgrep]] · [[SendMessage desanexa agente]] · [[Container do banco parado por outra sessão]] · [[Word-splitting no zsh]] · [[Crases no prompt do workflow]] · [[Matar processos de outros agentes]] · [[Proteção de preview da Vercel]]

## Pendências
- [[Pendências]] (lista viva)

## Como manter este vault
- Uma nota por conceito, com frontmatter (`tags`, `updated`, `fontes`) e links `[[...]]`.
- Toda fórmula ou limiar cita `arquivo:linha`. Nada de número sem fonte.
- Ao fim de cada onda:
  - crie a nota `Ondas/Onda N`;
  - atualize [[Pendências]];
  - transforme armadilhas novas em notas de `Harness/`;
  - atualize `updated:` nas notas tocadas.
