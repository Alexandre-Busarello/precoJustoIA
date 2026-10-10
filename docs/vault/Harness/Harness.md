---
tags: [harness, moc]
updated: 2026-10-09
fontes: [docs/harness/README.md]
---
# Harness

> Método multiagente usado nas ondas 0–6. O documento completo está em `docs/harness/README.md`; os scripts, em `docs/harness/scripts/`; os templates, em `docs/harness/templates/`.

## Em uma linha por papel
- **Coordenador:** divide em ondas e lotes disjuntos, revisa todo laudo e corrige riscos de produção. Ver [[Revisão do coordenador]].
- **Especialistas** (UX/UI, mobile, domínio, simplificação): auditoria só leitura.
- **Projetista:** consolida em strategy, backlog e specs.
- **Programador → QA adversarial → fixer** (até 2–3 ciclos) **→ committer** (`wip:` se não passou) **→ integrador** por onda.

## Segurança
- [[Banco de produção no .env]]
- [[Build proibido]]

## Máquina
- [[Limite de memória e watchdog]]
- [[Testes travados com Prisma]]

## Armadilhas
- [[Espera com pgrep]]
- [[SendMessage desanexa agente]]
- [[Container do banco parado por outra sessão]]
- [[Word-splitting no zsh]]
- [[Crases no prompt do workflow]]
- [[Matar processos de outros agentes]]
- [[Proteção de preview da Vercel]]

## Custo
- [[Custo de tokens]]

## Relacionadas
[[Ambiente local e CI]] · [[Onda 0]] … [[Onda 6]] · [[00 - Início]]
