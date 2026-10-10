---
tags: [harness, armadilha, vercel, deploy]
updated: 2026-10-09
---
# Proteção de preview da Vercel

> Nos deployments de preview, a *Deployment Protection* da Vercel responde **401 em HTML** a requisições sem cookie. Um `fetch` que funciona no local e em produção quebra no preview.

- Caso real: a prévia automática do [[Ranking]] chamava a API sem cookies, para não gravar histórico, e a página abria com erro. A correção (`93499c6`) tenta sem cookies e, se falhar, repete uma vez com a sessão.
- Ao testar um preview, autentique-se ou use o bypass de automação da Vercel. Não conclua que há bug de app sem checar a proteção.

Ver também: [[Middleware e rate limit]] · [[Harness]]
