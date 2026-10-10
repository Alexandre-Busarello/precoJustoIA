---
tags: [produto, decisoes, dono]
updated: 2026-10-09
fontes: [docs/melhorias-2026-09/RESUME.md, docs/melhorias-2026-09/strategy.md, memória persistente do Claude Code]
---
# Decisões do dono

> Valem sobre qualquer recomendação de especialista ou agente. Toda spec de lote deve respeitá-las.

## Permanentes
1. **Trial de 1 dia.** Trials de 7–14 dias geraram fazendas de contas sem conversão. Melhore a conversão dentro das 24 h. Ver [[Planos e preços]].
2. **Dark mode completo é requisito**, "desde que funcione em tudo e fique bom". O seletor só foi exposto depois que todas as rotas passaram no QA escuro ([[Onda 4]], `e0c3907`). O padrão é o tema do sistema. Ver [[Tema e dark mode]].
3. **Não alterar preços dos planos.** A proposta fica só na estratégia.
4. **"Onde aportar" é a premissa central**: números determinísticos e enquadramento CVM de calculadora. Ver [[Onde aportar]] e [[Compliance CVM]].
5. **Banco de produção intocável:** o `.env` é produção, e nada que escreva ou mude schema roda contra ele. Ver [[Banco de produção no .env]].
6. **Máquina de 15 GB:** serializar comandos pesados e vigiar o dev server. Ver [[Limite de memória e watchdog]].

## Do programa 2026-09
- Filtros novos no screening (liquidez visível, Bazin, PEG, DY 12m real, "queda com fundamentos intactos") usando `src/lib/finance/signals.ts`. Ver [[Screening]] e [[Sinais financeiros]].
- Análise técnica mantida, com `useTechnicalAnalysis = false` por padrão nos rankings.
- Bazin exclui extraordinários por padrão e mostra o valor retirado. O Barsi é um filtro de setores perenes sobre a mesma base do Bazin, sem petróleo. Lynch virou indicador relativo (PEG, sem preço-alvo). Decisão delegada pelo dono (`7d2503a`). Ver [[Bazin]], [[Barsi]] e [[Lynch]].
- Os conflitos entre especialistas foram resolvidos na strategy.md §3:
  - sem popup proativo do Ben;
  - ticker de índices só em /dashboard e /indices;
  - header de 56 px sem auto-hide;
  - bottom nav para quem está logado;
  - sem PWA offline (exigiria build).

## Ainda abertas
Ver [[Pendências]]:
- DY-alvo dos FIIs de tijolo;
- obrigatoriedade dos critérios do anti-armadilha;
- rótulo "Data ex";
- validação jurídica do modo "Todo o mercado".

## Relacionadas
[[Visão do produto]] · [[00 - Início]]
