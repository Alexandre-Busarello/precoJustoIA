# Como lançar os scripts do harness pelo Claude Code

Os três scripts desta pasta rodam a partir da sessão principal do Claude Code (o **coordenador**). Nenhum deles faz push nem toca o banco de produção.

| Script | O que faz | Como lançar |
|---|---|---|
| `implement-wave.js` | Orquestra uma onda: programador → QA → fixer → committer por lote, e o integrador no fim | Ferramenta **Workflow** |
| `dev-watchdog.sh` | Sobe o dev server no banco local e o reinicia quando a RAM aperta | **Bash** em background |
| `test-reaper.sh` | Mata `tsx --test` com mais de 5 min (libera o `heavy.lock`) | **Bash** em background |

## 0. Preparar a sessão

```bash
SCRATCH=<scratchpad da sessão>          # o Claude Code informa no início da sessão
REPO=/caminho/do/repo
docker start pja-local-db               # banco LOCAL (porta 55432)
touch "$SCRATCH/heavy.lock" "$SCRATCH/git.lock"
cp "$REPO/docs/harness/scripts/implement-wave.js" "$SCRATCH/"   # o Workflow lê o script do scratch
```

Confira a sintaxe do script antes de disparar (uma crase solta num prompt quebra tudo):

```bash
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8").replace("export const meta","const meta");
new (Object.getPrototypeOf(async function(){}).constructor)("args","agent","log","phase",s);console.log("ok")' "$SCRATCH/implement-wave.js"
```

Use aspas em toda variável com caminho: o shell padrão é zsh e caminhos com espaço (`00 - Início.md`) quebram sem elas.

## 1. Vigias em background

Peça ao Claude para rodar, cada um com `run_in_background`:

```bash
SCRATCH="$SCRATCH" REPO="$REPO" bash "$REPO/docs/harness/scripts/dev-watchdog.sh"
LOG="$SCRATCH/test-reaper.log" bash "$REPO/docs/harness/scripts/test-reaper.sh"
```

Os dois ficam vivos entre turnos. Não reinicie o dev server na mão: o watchdog é o dono dele.

## 2. Disparar uma onda (Workflow)

A ferramenta Workflow recebe o caminho do script (a cópia no scratch) e o objeto `args`:

```json
{
  "repo": "/caminho/do/repo",
  "scratch": "<scratchpad>",
  "docsDir": "/caminho/do/repo/docs/<programa>",
  "wave": 3,
  "concurrency": 1,
  "maxCycles": 3,
  "skipIntegration": true,
  "projectContext": "Next.js 15 App Router, React 19, Tailwind v4, Prisma. UI em pt-BR.",
  "coAuthor": "Co-Authored-By: Claude <noreply@anthropic.com>",
  "batches": [{ "id": "w3-onde-aportar", "title": "Onde aportar: motor + página" }]
}
```

Dois modos usados no projeto:

- **Paralelo (ondas 0–2):** todos os lotes da onda em `batches`, `concurrency: 3`, sem `skipIntegration`. Mais rápido, mais tokens por hora, mais RAM.
- **Um a um (ondas 3–6):** uma chamada de Workflow por lote com `skipIntegration: true` e `concurrency: 1`. No fim da onda, uma última chamada só para integrar, ou um agente avulso com o prompt de integração. Assim dá para medir tokens por lote e parar entre lotes.

Enquanto o Workflow roda:
- **Não mande SendMessage para agentes do workflow.** Isso já desanexou um agente do fluxo. Se algo travar (lock preso, banco parado), aja direto no ambiente sem conversar com o agente.
- Leia o resultado de cada lote (laudo do QA, `followups`) antes de disparar o próximo.

## 3. Esperar sem gastar tokens (Monitor)

Para esperar uma condição (fim do workflow, lock livre, container de pé), use a ferramenta **Monitor** com um laço `until` que tenha limite de tempo. Não use `sleep` solto em primeiro plano. Exemplos:

```bash
# lock livre (flock -n falha enquanto alguém segura)
until flock -n "$SCRATCH/heavy.lock" true; do sleep 20; done

# banco local de pé
until docker exec pja-local-db pg_isready -q; do sleep 10; done
```

Nunca espere com `until ! pgrep -f "<padrão>"`. O padrão casa com a linha de comando do próprio laço e a espera nunca termina. Espere no PID (`while kill -0 $PID; do sleep 5; done`) ou use o truque do colchete (`pgrep -f "[s]creenshots.ts"`).

## 4. Rodar lotes em sequência sem supervisão (/loop dinâmico)

`/loop` sem intervalo deixa o modelo decidir o ritmo (modo dinâmico). Serve para "dispare o próximo lote da onda quando o anterior terminar, anote os tokens no ledger e pare se o QA reprovar com bloqueante de produção":

```
/loop siga docs/<programa>/RESUME.md: se não há workflow rodando, dispare o próximo lote pendente da onda N com skipIntegration; ao terminar, registre tokens no token-ledger.tsv e revise o laudo do QA; pare quando a onda acabar
```

Revise cada laudo do QA: o coordenador ainda é responsável pelos riscos de produção (ver [README](../README.md#o-coordenador-revisa-tudo)).

## 5. Encerrar

- Pare os vigias (`kill` nos PIDs do background). O classificador de segurança bloqueia matar processos de **outros** agentes; nesse caso, peça ao usuário.
- Atualize o `RESUME.md` do programa e o vault (`docs/vault/Ondas/`, `docs/vault/Pendências/`).
