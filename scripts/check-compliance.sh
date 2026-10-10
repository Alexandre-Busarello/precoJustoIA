#!/usr/bin/env bash
# Guarda-corpo de compliance (CVM/CDC): falha em termos proibidos na copy de src/**/*.ts(x).
#
# Uso:
#   bash scripts/check-compliance.sh                 # varre todo o src/
#   bash scripts/check-compliance.sh <arquivos...>   # só os arquivos informados
#
# Termos (sem diferenciar maiúsculas): "Compra" (palavra inteira), "Sinal de compra", "Região segura", "garantid*",
# "preditiv*", "único(s)/única(s) no/do Brasil/mercado", "melhores ações" e "recomendação".
#
# Ignorados:
#   - linhas com console.*, comentários (//, /*, * no início e "// ..." no fim da linha), regex literais no início da
#     linha (listas de termos proibidos usadas como filtro), testes (__tests__) e rotas/telas de admin;
#   - negações e avisos: só o trecho negado sai da linha antes da checagem. O termo precisa vir logo depois de
#     "não"/"nem", com no máximo 4 palavras de uma lista fechada no meio (verbos de aviso como é/são/constitui/indica/
#     garante/oferece/faz e artigos como um/uma/de): "não é recomendação", "nem recomendação", "não indicam compra",
#     "não garantem", "não é uma indicação de compra". Vírgula e pontuação interrompem a negação ("Não perca essa
#     Oportunidade de Compra" e "Nem pense duas vezes, retorno garantido" continuam proibidos). Uma negação no fim da
#     linha anterior ("não são" + quebra de linha) só cobre o termo que abre a linha atual;
#   - valores de código em minúsculas: literal inteiro ('compra' depois de =, :, ?, (, [, |, ou case) e chave de objeto
#     (compra: no início da linha ou depois de { ou ,). "Sinal de compra:" e "Sinal de 'compra'" continuam proibidos;
#   - "compra" como transação registrada: expressões fixas (compra de 100 / de R$ / de cada mês, preço de compra,
#     poder de compra, por compra ou venda, só compra, compra ações) e, nos módulos do livro de transações da carteira
#     (LEDGER_PATHS), qualquer "compra" (é o nome do lançamento, não um sinal).
#
# Exceções em scripts/check-compliance.allowlist, uma por linha (linhas com # no início são comentários):
#   caminho                 -> arquivo inteiro (terminado em "/", vale como prefixo de pasta)
#   caminho :: trecho       -> só as linhas do arquivo que contêm o trecho
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 2
ALLOWLIST="scripts/check-compliance.allowlist"
export LC_ALL=C.UTF-8

PATTERN='\bCompra\b|Sinal de compra|Regi[aã]o segura|garantid|preditiv|[úu]nic[oa]s? (no|do) (Brasil|mercado)|melhores a[cç][oõ]es|recomenda[cç][aã]o'
COMMENT='^[[:space:]]*(//|/\*|\*)'
REGEX_LITERAL='^[[:space:]]*\[?/'
LEDGER_IDIOMS='compras? de (\d|R\$|\$\{|cada)|pre[cç]o (m[eé]dio )?de compra|poder de compra|por compra ou venda|\bs[oó] compra\b|\bcompra a[cç][oõ]es\b'
LEDGER_PATHS=(
  src/app/api/portfolio/
  src/components/portfolio-transaction
  src/components/portfolio-rebalancing
  src/components/portfolio-tutorial-page.tsx
  src/lib/portfolio-
  src/lib/allocation/
)

ALLOW_PATHS=()
ALLOW_SNIPPETS=()
if [[ -f "$ALLOWLIST" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="$(echo "$line" | sed -E 's/^[[:space:]]+|[[:space:]]+$//g')"
    [[ -z "$line" || "$line" == \#* ]] && continue
    if [[ "$line" == *" :: "* ]]; then
      ALLOW_PATHS+=("${line%% :: *}")
      ALLOW_SNIPPETS+=("${line#* :: }")
    else
      ALLOW_PATHS+=("$line")
      ALLOW_SNIPPETS+=("")
    fi
  done < "$ALLOWLIST"
fi

is_allowed() { # $1 arquivo, $2 texto da linha
  local i p snippet
  for i in "${!ALLOW_PATHS[@]}"; do
    p="${ALLOW_PATHS[$i]}"
    snippet="${ALLOW_SNIPPETS[$i]}"
    if [[ "$1" == "$p" || ( "$p" == */ && "$1" == "$p"* ) ]]; then
      [[ -z "$snippet" || "$2" == *"$snippet"* ]] && return 0
    fi
  done
  return 1
}

is_ledger_path() {
  local p
  for p in "${LEDGER_PATHS[@]}"; do
    [[ "$1" == "$p"* ]] && return 0
  done
  return 1
}

# Remove da linha tudo o que não é copy proibida (negações/avisos, valores de código, lançamentos da carteira) e diz se
# ainda sobra algum termo. $1 arquivo, $2 linha, $3 linha anterior. Retorna 0 quando a linha deve ser apontada.
still_flagged() {
  local ledger=0
  is_ledger_path "$1" && ledger=1
  CC_TEXT="$2" CC_PREV="$3" CC_LEDGER="$ledger" CC_PATTERN="$PATTERN" CC_IDIOMS="$LEDGER_IDIOMS" perl -CSDA -Mutf8 -e '
    my ($text, $prev) = map { my $v = $_; utf8::decode($v); $v } ($ENV{CC_TEXT}, $ENV{CC_PREV});
    my $pattern = $ENV{CC_PATTERN}; utf8::decode($pattern);
    my $idioms = $ENV{CC_IDIOMS}; utf8::decode($idioms);
    for ($text, $prev) { s~\s//\s.*$~~ }
    # Palavras aceitas entre a negação e o termo: verbos de aviso e artigos. Nada mais (nem pontuação).
    my $word = qr/(?:é|e|são|sao|seja|sejam|ser|constitui|constituem|representa|representam|indica|indicam|indicamos|garante|garantem|garantimos|configura|configuram|oferece|oferecem|oferecemos|faz|fazem|fazemos|faça|façam|sugere|sugerem|sugerimos|sugira|use|usa|usamos|emite|emitem|emitimos|deve|devem|há|existe|se|trata|um|uma|de|da|do|a|o|as|os|qualquer|nenhum|nenhuma|tipo|como|sinal|indicação|indicações|palavra|palavras|termo|termos)(?!\w)/i;
    my $term = qr/["\x{201C}\x27]?\w*?(?:recomenda[cç]|compra|garant|preditiv)\w*["\x{201D}\x27]?(?:\s+(?:de|ou|e|nem)\s+(?:compra|venda|investimento|rentabilidade)s?\b)*/i;
    my $head = qr/\b(?:n[aã]o|nem)(?!\w)(?:\s+$word){0,4}/i;
    # Negação na própria linha (com lista de termos entre aspas logo depois, como "compra", "venda" ou "recomendação").
    $text =~ s~$head\s+$term(?:\s*,?\s*(?:(?:ou|e|nem)\s+)?["\x{201C}][^"\x{201D}]{1,20}["\x{201D}])*~ ~g;
    # Negação no fim da linha anterior: cobre só o termo que abre esta linha.
    $text =~ s~^[\s{>(]*(?:$word\s+){0,4}$term~ ~ if $prev =~ m~$head\s*$~;
    # Valores de código: literal inteiro depois de operador e chave de objeto.
    $text =~ s~(^|[=:(,\[|?{!]|\bcase)(\s*)([\x27"`])compras?\3~$1$2~g;
    $text =~ s~(^|[{,])(\s*)compras?(\s*:)~$1$2$3~g;
    $text =~ s~$idioms~~gi;
    $text =~ s~\bcompras?\b~~gi if $ENV{CC_LEDGER};
    exit($text =~ m~$pattern~i ? 0 : 1);
  '
  local rc=$?
  if (( rc > 1 )); then
    echo "check-compliance: erro interno ao analisar $1 (perl saiu com $rc)" >&2
    exit 2
  fi
  return "$rc"
}

is_excluded_path() {
  [[ "$1" == *"/__tests__/"* || "$1" == *".test.ts" || "$1" == *".test.tsx" ]] && return 0
  [[ "$1" == *"/admin/"* || "$1" == *"/admin-"* || "$(basename "$1")" == admin* ]] && return 0
  return 1
}

if [[ $# -gt 0 ]]; then
  mapfile -t FILES < <(printf '%s\n' "$@" | grep -E '^src/.*\.(ts|tsx)$' || true)
else
  mapfile -t FILES < <(find src -type f \( -name '*.ts' -o -name '*.tsx' \) | sort)
fi

hits=0
for f in "${FILES[@]}"; do
  [[ -f "$f" ]] || continue
  is_excluded_path "$f" && continue
  while IFS= read -r hit; do
    [[ -z "$hit" ]] && continue
    lineno="${hit%%:*}"
    text="${hit#*:}"
    echo "$text" | grep -qE 'console\.' && continue
    echo "$text" | grep -qE "$COMMENT" && continue
    echo "$text" | grep -qE "$REGEX_LITERAL" && continue
    prev=""
    (( lineno > 1 )) && prev="$(sed -n "$((lineno - 1))p" "$f")"
    still_flagged "$f" "$text" "$prev" || continue
    is_allowed "$f" "$text" && continue
    echo "$f:$lineno: $(echo "$text" | sed -E 's/^[[:space:]]+//' | cut -c1-160)"
    hits=$((hits + 1))
  done < <(grep -niP -- "$PATTERN" "$f")
done

if (( hits > 0 )); then
  echo "check-compliance: $hits ocorrência(s). Troque por 'Abaixo/Acima do preço justo', 'Dentro da faixa estimada', 'estimativa' ou justifique em $ALLOWLIST." >&2
  exit 1
fi
echo "check-compliance: ok (${#FILES[@]} arquivo(s))"
