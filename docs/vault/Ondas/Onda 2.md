---
tags: [onda, onda-2, financas, plataforma]
updated: 2026-10-09
fontes: [docs/melhorias-2026-09/RESUME.md, docs/melhorias-2026-09/batches/w2-*.md]
---
# Onda 2: correção financeira, features e plataforma (05/10/2026)

> 9 lotes em paralelo: o núcleo de valuation corrigido, modelos novos, retornos corretos, agenda de proventos, alertas e o middleware ativado. Levou ~7,2 h de relógio com 50 agentes.

## Lotes e commits
| Lote | Commit |
|---|---|
| `w2-score-compliance-fii` | `c463adb` |
| `w2-rankings-new-models` (liquidez, dedupe, Barsi, Bazin, Lynch, P/VP) | `986090d` **wip** → `1e188da` |
| `w2-valuation-core` (FCD EV→Equity, Gordon TTM, Graham, Fórmula Mágica) | `27fc167` |
| `w2-dividends-agenda` | `f77fd79` (+ `9680fb4` do coordenador) |
| `w2-returns` (backtest sem dupla contagem, Sharpe com CDI, TWR/XIRR, IPCA) | `47df9e2` |
| `w2-alerts` (Bazin, desconto ao preço justo, DY TTM) | `a16f330` |
| `w2-platform-seo-pwa` | `9e33c57` |
| `w2-ui-market-tools` | `5076daa` |
| `w2-ui-institutional-auth` | `5bc379d` |
| Correções do coordenador | `3743315`, `9680fb4` |
| Integração | `74f4774` |

## Depois da integração
- `7d2503a`: Bazin sem extraordinários, Barsi unificado ao Bazin, Lynch como PEG.
- `127bb16`: logo em SVG.
- `b10e34d`: build de produção validado no banco local; saiu `/comparador-etfs`.
- `93499c6`: [[Proteção de preview da Vercel]].
- `8783883`: Barsi sem petróleo; o Premium passa a valer na API.

## Decisões
Ver [[Decisões do dono]]: Bazin/Barsi/Lynch e o limite de alertas grátis de 1 para 3. O DY-alvo dos FIIs de tijolo ficou aberto. Ver [[FII score e preço-teto]].

## Lições
- Testes que importam Prisma travaram o lock duas vezes (`3743315`, `9680fb4`). Daí a regra "teste unitário sem Prisma". Ver [[Testes travados com Prisma]].
- O middleware da raiz sombreava `src/middleware.ts`, então rate limit, gate de `/admin` e 410 nunca tinham rodado. Ver [[Middleware e rate limit]].

## Relacionadas
[[Onda 1]] · [[Onda 3]] · [[Graham]] · [[FCD]] · [[Gordon]] · [[00 - Início]]
