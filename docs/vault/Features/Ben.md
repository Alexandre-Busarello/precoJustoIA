---
tags: [feature, ben, ia]
updated: 2026-10-09
fontes: [src/lib/ben-service.ts, src/lib/ben-tools.ts, src/lib/ben-context/, src/lib/ben-message-limit-service.ts, src/components/ben/, src/components/ben-chat-fab.tsx, src/hooks/use-ben-chat.ts, src/app/api/ben/, src/app/conversas-ben/page.tsx]
---
# Ben
> Assistente de IA (Gemini) que explica e calcula com os dados da plataforma e sabe o que o usuário está vendo. Não recomenda: "Ben consulta os dados da plataforma; não é recomendação".

## Como funciona
- **Modelo e ferramentas:** `src/lib/ben-service.ts` (`gemini-flash-lite-latest`) com ferramentas de dados em `src/lib/ben-tools.ts` (inclui BRAPI). A API `src/app/api/ben/chat/route.ts` responde em streaming SSE (`ReadableStream` + `processBenMessageStream`).
- **Contexto por tela (onda 6):** `src/lib/ben-context/`
  - `types.ts`: união tipada com ativo, carteira, ranking, screening, comparador, onde-aportar, backtest, agenda, alertas, dashboard e genérico;
  - `builders.ts` monta o contexto e `store.ts` o guarda;
  - `serializer.ts` limita a `BEN_CONTEXT_MAX_CHARS` (~1,5 mil caracteres);
  - `prompt.ts`/`system-prompt.ts` injetam a seção "O usuário está vendo: …";
  - `questions.ts` dá as sugestões por tela;
  - `answer-links.ts` liga tickers e seções (ex.: `/metodologia#fcd`) na resposta, sem HTML cru do LLM.
  - As páginas registram o contexto com `page-context-registrar.tsx` e `use-ben-page-context.ts`.
- **"Perguntar ao Ben":** `src/components/ben/ask-ben-button.tsx` abre o chat com pergunta pronta na tabela de valuation, nas posições da carteira, no resultado do [[Onde aportar]], no ranking, no screening e na linha do alerta.
- **UI:** `src/components/ben/ben-panel.tsx`. No desktop é um painel lateral que não cobre o conteúdo. No mobile é uma folha inferior com encaixe meio/inteiro e foco preso. Esc fecha.
  - Cabeçalho com o chip "Vendo: PETR4 · Valuation", que o usuário pode remover.
  - Tela inicial com até 3 sugestões e "consultando dados…" mostrando a ferramenta em uso.
  - Botões parar, tentar de novo e copiar; até 2 sugestões de continuação; respostas longas recolhidas; tabelas em Markdown no estilo da `DataTable`.
  - Estado da conversa em `panel-store.ts` e `use-ben-chat.ts` (`stopBenRun` com `AbortController`).
- **Botão flutuante:** `src/components/ben-chat-fab.tsx`, montado uma vez no layout. Só aparece com sessão e some em checkout, login, cadastro, oferta e admin. No mobile fica acima da bottom nav e sai de cima de abas e de `data-ben-fab-avoid`. Continua a conversa só se ela for da mesma tela.
- **Histórico:** `/conversas-ben`, com busca, renomear, excluir e "Continuar no painel"; API em `src/app/api/ben/conversations/`.

## Regras / limites
- **Free:** 2 mensagens por dia (fuso America/Sao_Paulo), contadas em `BenMessage` (`src/lib/ben-message-limit-service.ts`). A UI mostra "restam N" e, em 0, troca o campo pelo estado de limite. **Premium:** ilimitado.
- Compliance: proibidos "compra", "venda" e "melhor ação"; o guarda-corpo do `ben-service` foi mantido (ver [[Compliance CVM]]).
- O contexto é só uma dica: números atuais vêm das ferramentas.

## Histórico nas ondas
- [[Onda 0]]: o botão aparece só para logados; o popup proativo foi removido (sem 401 em `/api/ben/interactions`).
- [[Onda 1]]: `7ff4c71` (chat e `/conversas-ben` revisados; textarea com 16 px).
- [[Onda 5]]: `6e7d08c` (botão do Ben no mobile, toques de 44 px).
- [[Onda 6]]: `87a519a` + `d683517` (contexto, "Perguntar ao Ben", links), `d926413` (painel/folha, streaming, limites, histórico) e `10df504` (foco após parar, layout do aviso, conversa excluída).

## Pendências
- Conversas vazias (pergunta interrompida antes da resposta) ficam no banco; a UI só as esconde (`messageCount > 0` em `src/app/conversas-ben/page.tsx`). Falta limpar no servidor.
- /bdr/aapl34 no mobile: o botão em repouso cobre a coluna "Critérios" da valuation (marcar com `data-ben-fab-avoid`; `src/components/asset/valuation-table.tsx` ainda não tem o atributo).

## Relacionadas
[[Onde aportar]] · [[Compliance CVM]] · [[Planos e preços]] · [[Carteira]] · [[Ranking]] · [[Onda 6]]
