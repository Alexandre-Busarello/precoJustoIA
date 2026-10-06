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
# Ignorados: linhas com console.*, comentários (//, /*, *), testes (__tests__), rotas e telas de admin e linhas com
# "não é recomendação", "não constitui recomendação" ou "não são recomendação".
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
DISCLAIMER='n[aã]o (é|e|constitui|s[aã]o) recomenda[cç][aã]o'
COMMENT='^[[:space:]]*(//|/\*|\*)'

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
    echo "$text" | grep -qiP "$DISCLAIMER" && continue
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
