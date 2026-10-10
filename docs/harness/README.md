# Harness de implementação multiagente

Este é o método usado para entregar o programa [Melhorias 2026-09](../melhorias-2026-09/RESUME.md) do Preço Justo AI: ondas 0–6, 34 lotes e 80 commits na branch `melhorias/ux-ui-mobile`. Use-o em qualquer implementação grande, ou seja, quando o trabalho não cabe numa sessão e precisa de revisão independente.

> **Antes de começar, leia o [vault do projeto](../vault/00%20-%20In%C3%ADcio.md)**: decisões do dono, fórmulas, armadilhas e pendências.

- Scripts: [`scripts/`](scripts/). Como lançar: [`scripts/harness.md`](scripts/harness.md).
- Templates: [`templates/batch-spec.md`](templates/batch-spec.md), [`templates/backlog-rules.md`](templates/backlog-rules.md), [`templates/specialist-prompts.md`](templates/specialist-prompts.md).
- Exemplo real completo: [`docs/melhorias-2026-09/`](../melhorias-2026-09/).

---

## 1. Papéis

| Papel | Quem | Faz | Não faz |
|---|---|---|---|
| **Coordenador** | A sessão principal do Claude Code | Divide o trabalho em ondas e lotes, dispara os workflows, lê **todo** laudo do QA, corrige riscos de produção por conta própria, valida o build contra o banco local, atualiza `RESUME.md` e o vault | Implementar lotes inteiros (gasta o próprio contexto) |
| **Especialistas** | Agentes só-leitura: UX/UI, mobile, domínio (mercado financeiro e compliance), simplificação e arquitetura | Auditam e escrevem relatórios em `reports/` com `arquivo:linha`, severidade e teste de aceite | Editar código |
| **Projetista** | Agente "head de produto" | Consolida os relatórios em `strategy.md`, `backlog.json`, `backlog-rules.md` e uma spec por lote, e resolve conflitos entre especialistas | Decidir no lugar do dono (preço, prazo de trial etc.) |
| **Programador** | Agente por lote | Implementa a spec inteira dentro dos OWNED PATHS e se autovalida (tsc, eslint, guardas, testes, screenshots) | Commitar, sair do escopo |
| **QA** | Agente independente e adversarial | Procura falhas: lê o diff, roda tsc/eslint/`check-ui`/`check-compliance`/testes, tira screenshots claro/escuro × mobile/desktop, roda sondas Playwright e devolve `pass`/`fail` com bloqueantes | Editar código da aplicação, confiar no relatório do programador |
| **Fixer** | Agente programador, nova rodada | Corrige todos os bloqueantes e os menores baratos | Sair dos OWNED PATHS |
| **Committer** | Agente de esforço baixo | Um commit local por lote sob o `git.lock`; prefixo `wip:` se o QA não aprovou | Push, incluir arquivos de outro lote |
| **Integrador** | Um agente por onda | tsc/eslint/testes do projeto inteiro e screenshots de todas as rotas; corrige só quebras **entre** lotes | Features novas |

## 2. Ciclo de vida

```
especialistas (paralelo, só leitura) ──► projetista ──► strategy.md + backlog.json + batches/*.md + backlog-rules.md
                                                            │
                         dono aprova decisões ◄─────────────┘
                                                            │
onda N:  para cada lote (concorrência 1–3)                  ▼
         programador ──► QA ──fail──► fixer ──► QA ──fail──► fixer ──► QA   (até maxCycles = 2–3)
                          │pass                                         │fail
                          ▼                                             ▼
                      committer ("feat/fix: ...")               committer ("wip: ...", bloqueantes no corpo)
         ──► integrador da onda ("fix: integração da onda N")
         ──► coordenador revisa laudos, corrige riscos, atualiza RESUME.md, vault e ledger de tokens
         ──► próxima onda
```

- **Onda 0 é a fundação** (tokens, componentes compartilhados, helpers de formatação) e roda sozinha, porque todo o resto importa dela.
- **Lotes da mesma onda têm OWNED PATHS disjuntos.** É isso que permite rodar em paralelo na mesma working tree sem worktrees. Arquivos compartilhados ficam num único lote, ou com escopo restrito escrito na spec ("só o caminho de screening de `rank-builder/route.ts`").
- **Concorrência:** 3 lotes em paralelo nas ondas 0–2 (limite de RAM). Nas ondas 3–6, 1 lote por vez com `skipIntegration: true` e um único integrador no fim da onda, para controlar tokens e medir cada lote.
- **Lote que não passa** em `maxCycles` é commitado como `wip:` para não perder trabalho; os bloqueantes vão para o integrador, para o coordenador ou para uma rodada extra.

## 3. Como escrever uma spec de lote

Use [`templates/batch-spec.md`](templates/batch-spec.md). O que fez diferença:

1. **OWNED PATHS explícitos**, com globs. Escopo restrito dentro de um arquivo compartilhado vai entre parênteses.
2. **CONTEXT YOU MUST READ FIRST**: helpers que devem ser **reutilizados** ("import it; do not re-implement"), commits anteriores (`git log -- <caminhos>`), a seção exata do relatório e as notas do vault.
3. **TASKS numeradas com prioridade** (P0/P1/P2) e com os rótulos exatos da UI, os valores padrão e as unidades (fração × percentual).
4. **ACCEPTANCE e TEST PLAN verificáveis**: rota + passo + resultado, e conferência numérica à mão para 1–2 tickers contra o banco local. O QA só cobra o que está escrito.
5. **Carry-over**: antes de disparar a onda, acrescente as pendências das ondas anteriores e as decisões novas do dono.

**Conferir disjunção** antes de disparar (troque `3` pela onda):

```bash
node -e 'const b=require("./docs/<programa>/backlog.json").batches.filter(x=>x.wave===3);
const n=p=>p.replace(/\/\*\*$/,"").replace(/\s*\(.*$/,"");
for(const a of b)for(const c of b)if(a.id<c.id)for(const p of a.ownedPaths)for(const q of c.ownedPaths){
const x=n(p),y=n(q);if(x===y||x.startsWith(y+"/")||y.startsWith(x+"/"))console.log(a.id,p,"x",c.id,q)}'
```

## 4. Regras globais

Todo agente lê `backlog-rules.md` antes de começar ([template genérico](templates/backlog-rules.md), [versão do projeto](../melhorias-2026-09/backlog-rules.md)). Blocos: segurança de produção, ownership, design system, copy de compliance, títulos/SEO, mobile, dark mode, limites da máquina, validação e relatório final.

Guardas automáticas usadas pelo QA e pela CI (`.github/workflows/quality.yml`, que roda tsc, eslint, `yarn test` e as guardas só nos arquivos alterados do PR, **sem build**):
- `scripts/check-ui.sh <arquivos>`: gradientes, `bg-clip-text`, `backdrop-blur`, pesos extremos, sombras grandes, emoji e roxos;
- `scripts/check-compliance.sh <arquivos>`: "Compra", "Sinal de compra", "Região segura", "garantid*", "preditiv*", "único no mercado", "melhores ações", "recomendação" (com tratamento de negações como "não é recomendação").

## 5. Segurança

- **O `.env` é o banco de PRODUÇÃO (Neon).** Tudo local usa o Postgres do Docker `pja-local-db` na porta **55432**, com `DATABASE_URL`/`DIRECT_URL` sobrescritos **no mesmo comando**: a variável do processo vence o `.env`. Seed: `scripts/local/seed-local.ts`. Usuários: `premium@local.test` / `free@local.test`, senha `Local123!`.
- **`next build`/`yarn build` proibidos para os agentes**: o script de build roda `prisma db push`. O coordenador valida o build de produção com `npx next build` apontado para o banco local antes de cada push.
- **Sem mudança de schema** em nenhuma onda.
- Nenhum agente chama endpoints de pagamento, e-mail ou geração de IA. Ninguém faz push: o dono faz.
- O script de screenshots recusa hosts que não sejam localhost.

## 6. Limites da máquina (15 GB de RAM)

- **Watchdog do dev server** ([`scripts/dev-watchdog.sh`](scripts/dev-watchdog.sh)): o `next dev --turbopack` chegou a 6,5 GB. O watchdog reinicia o servidor quando a memória livre cai abaixo de 1,8 GB ou o servidor passa de 5 GB, com `--max-old-space-size=2048`.
- **Todo comando pesado passa por `flock -w 3600 <scratch>/heavy.lock`** (tsc, eslint, testes, screenshots, Playwright). Commits passam por `<scratch>/git.lock`.
- **Testes sempre com `timeout 300`**, e **teste unitário não importa Prisma**: o cliente segura o processo na saída e, com ele, o lock. Lógica testável vai para módulos puros (ex.: `9680fb4`, projeções de proventos fora do serviço).
- **Ceifador de testes** ([`scripts/test-reaper.sh`](scripts/test-reaper.sh)): mata `tsx --test` com mais de 5 min.
- **Disco:** screenshots no scratch, com `deviceScaleFactor` 1 e só as rotas necessárias, apagadas pelo committer. Se o `/` tiver menos de 2 GB livres, apague `shots/` antigos.

## 7. Armadilhas aprendidas

Cada uma tem uma nota no vault ([Harness](../vault/Harness/Harness.md)).

| Armadilha | Sintoma | O que fazer |
|---|---|---|
| `until ! pgrep -f "<padrão>"` | A espera nunca termina: o padrão casa com a própria linha de comando do laço | Esperar no PID (`kill -0`) ou usar `pgrep -f "[s]creenshots.ts"`; sempre com timeout |
| SendMessage para agente do workflow | O agente se desanexa do fluxo e o resultado não volta ao script | Não conversar com agentes do workflow; agir direto no ambiente (liberar lock, religar banco) |
| Outra sessão parou o container do banco | Rotas com erro de conexão, QA reprovando à toa | Conferir `docker ps` antes de culpar o lote; `docker start pja-local-db` |
| Word-splitting no zsh | `$VAR` com espaço não é dividido (ao contrário do bash), e `echo =====` dá "not found" (expansão de `=`) | Aspas sempre; arrays explícitos; `echo '-----'` |
| Crases dentro dos prompts do workflow | O template literal fecha antes da hora e o script inteiro quebra | Usar aspas simples para comandos nos prompts, ou escapar a crase |
| Matar processo de outro agente | O classificador de segurança bloqueia | Pedir ao usuário |
| Proteção de deployment da Vercel no preview | `fetch` sem cookie recebe a página de login e a prévia do ranking quebra | Repetir com a sessão (`93499c6`); testar o preview autenticado |
| Teste importando Prisma | `tsx --test` não sai e segura o `heavy.lock` | Módulo puro + `timeout 300` + ceifador |

## 8. O coordenador revisa tudo

Aprovação do QA não basta. Nas ondas 3–6, o coordenador leu cada laudo e encontrou riscos que nenhum agente bloqueou:

- **Exclusão destrutiva de proventos:** o dedupe de dividendos de FII apagava linhas do Yahoo. O coordenador trocou para não apagar dados (`f15d22f`).
- **Rate limit nascendo em `enforce`:** o limite nunca tinha rodado em produção. Ele passou a começar em modo `log` (`API_RATE_LIMIT_MODE`, `86ffed8`).
- **Prompts de IA pedindo "recomendação":** o coordenador reescreveu os prompts (`85eeb53`, integração `57fc0f1`).
- **Build de produção:** validado contra o banco local antes dos pushes (`b10e34d` removeu uma página que quebrava o prerender).

Regra prática: tudo que **apaga dado, muda comportamento padrão em produção, fala com o usuário em nome da empresa** ou mexe com **dinheiro** é revisado pelo coordenador antes do push.

## 9. Medir tokens

- O resultado de cada agente no Workflow traz o uso de tokens. Some programador, QA, fixer e committer por lote.
- Registre num `token-ledger.tsv` no scratch, com as colunas `lote, inicio, fim, tokens_subagentes, agentes, resultado`.
- Valores observados: **~0,4–0,9 mi de tokens por lote**, ou seja, 3 agentes num lote aprovado no 1º ciclo e 5 com um ciclo de correção. Uma integração custa 0,09–0,19 mi. **Ondas 3–6 ≈ 6,39 mi** (3: 1,92 · 4: 1,00 · 5: 2,06 · 6: 1,41). Detalhe em [Custo de tokens](../vault/Harness/Custo%20de%20tokens.md).
- Tempo de relógio: ~40–100 min por lote rodando um a um; a onda 2 (9 lotes em paralelo, 50 agentes) levou ~7,2 h.
- Com a janela de tokens apertada: concorrência 1, `skipIntegration`, `maxCycles` 2 e specs mais estreitas.

## 10. Checklist: como começar uma nova grande implementação

1. [ ] Ler [`docs/vault/00 - Início.md`](../vault/00%20-%20In%C3%ADcio.md), em especial as [Decisões do dono](../vault/Produto/Decis%C3%B5es%20do%20dono.md), a [Compliance CVM](../vault/Produto/Compliance%20CVM.md) e as [Pendências](../vault/Pend%C3%AAncias/Pend%C3%AAncias.md).
2. [ ] Criar a branch a partir da `main` e a pasta `docs/<programa>/` com `batches/`, `reports/` e `tools/`.
3. [ ] Subir o ambiente: `docker start pja-local-db`, seed local, dev server pelo watchdog, ceifador de testes e locks no scratch ([harness.md](scripts/harness.md)).
4. [ ] Rodar os especialistas necessários em paralelo, só leitura ([prompts](templates/specialist-prompts.md)).
5. [ ] Rodar o projetista: `strategy.md`, `backlog.json`, specs e `backlog-rules.md` ([templates](templates/)).
6. [ ] Levar as decisões ao dono e registrar as respostas no vault e no topo da estratégia.
7. [ ] Conferir a disjunção dos OWNED PATHS por onda (§3).
8. [ ] Escrever `RESUME.md` com status, decisões, segurança e como retomar.
9. [ ] Copiar `scripts/implement-wave.js` para o scratch e disparar a onda 0 sozinha.
10. [ ] A cada lote ou onda: ler o laudo do QA, corrigir riscos de produção (§8), anotar tokens, atualizar `RESUME.md`, a nota da onda e as pendências do vault.
11. [ ] Antes do push: tsc, eslint, `yarn test`, guardas e `next build` **contra o banco local**; listar as ações de deploy (variáveis, crons).
12. [ ] Fechar: nota da onda no vault, pendências atualizadas, armadilhas novas viram notas em `Harness/`.
