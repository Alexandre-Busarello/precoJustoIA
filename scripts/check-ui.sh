#!/usr/bin/env bash
# Guarda-corpo visual do design system (ver docs de UX): falha em padrões proibidos na UI.
#
# Uso:
#   bash scripts/check-ui.sh                 # arquivos .ts/.tsx/.css de src/ alterados ou novos (git)
#   bash scripts/check-ui.sh <arquivos...>   # só os arquivos informados
#   bash scripts/check-ui.sh --all           # varre todo o src/ e imprime a contagem por regra (não falha)
#
# Regras: bg-gradient-to-, bg-clip-text, backdrop-blur, font-black/font-extrabold,
# shadow-lg/xl/2xl (fora de dialog/sheet/popover/dropdown-menu/alert-dialog em src/components/ui),
# emoji em .tsx (exceto linhas com console.*), text-purple/violet/indigo/pink-.
# Exceções por arquivo em scripts/check-ui.allowlist.
set -uo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$ROOT" || exit 2
ALLOWLIST="scripts/check-ui.allowlist"
export LC_ALL=C.UTF-8

RULES=(gradient clip-text backdrop-blur heavy-weight large-shadow emoji purple-text)
declare -A PATTERN=(
  [gradient]='bg-gradient-to-'
  [clip-text]='bg-clip-text'
  [backdrop-blur]='backdrop-blur'
  [heavy-weight]='\bfont-(black|extrabold)\b'
  [large-shadow]='\bshadow-(lg|xl|2xl)\b'
  [emoji]='[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B00}-\x{2BFF}\x{FE0F}]'
  [purple-text]='\btext-(purple|violet|indigo|pink)-'
)
OVERLAY_FILES='^src/components/ui/(dialog|sheet|popover|dropdown-menu|alert-dialog)\.tsx$'

# Allowlist: "caminho" (todas as regras) ou "caminho regra1,regra2". Caminho terminado em "/" vale como prefixo.
ALLOW_PATHS=()
ALLOW_RULES=()
if [[ -f "$ALLOWLIST" ]]; then
  while read -r path rules _; do
    [[ -z "${path:-}" || "$path" == \#* ]] && continue
    ALLOW_PATHS+=("$path")
    ALLOW_RULES+=("${rules:-*}")
  done < "$ALLOWLIST"
fi

is_allowed() { # $1 arquivo, $2 regra
  local i
  for i in "${!ALLOW_PATHS[@]}"; do
    local p="${ALLOW_PATHS[$i]}" r="${ALLOW_RULES[$i]}"
    if [[ "$1" == "$p" || ( "$p" == */ && "$1" == "$p"* ) ]]; then
      [[ "$r" == "*" || ",$r," == *",$2,"* ]] && return 0
    fi
  done
  return 1
}

applies() { # $1 arquivo, $2 regra
  [[ "$2" == "emoji" && "$1" != *.tsx ]] && return 1
  [[ "$2" == "large-shadow" && "$1" =~ $OVERLAY_FILES ]] && return 1
  is_allowed "$1" "$2" && return 1
  return 0
}

matches() { # $1 arquivo, $2 regra -> linhas "N:conteúdo"
  if [[ "$2" == "emoji" ]]; then
    grep -nP -- "${PATTERN[$2]}" "$1" | grep -v 'console\.'
  else
    grep -nP -- "${PATTERN[$2]}" "$1"
  fi
}

collect_files() {
  if [[ $# -gt 0 ]]; then
    printf '%s\n' "$@"
  else
    { git diff --name-only HEAD; git ls-files --others --exclude-standard; } | sort -u
  fi
}

if [[ "${1:-}" == "--all" ]]; then
  mapfile -t FILES < <(find src -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.css' \) | sort)
  echo "check-ui --all: ${#FILES[@]} arquivos em src/"
  total=0
  for rule in "${RULES[@]}"; do
    count=0
    files_hit=0
    for f in "${FILES[@]}"; do
      applies "$f" "$rule" || continue
      n=$(matches "$f" "$rule" | wc -l)
      if (( n > 0 )); then
        count=$((count + n))
        files_hit=$((files_hit + 1))
      fi
    done
    printf '  %-14s %6d linhas em %4d arquivos\n' "$rule" "$count" "$files_hit"
    total=$((total + count))
  done
  printf '  %-14s %6d linhas\n' "total" "$total"
  exit 0
fi

mapfile -t FILES < <(collect_files "$@" | grep -E '^src/.*\.(ts|tsx|css)$' || true)
failures=0
for f in "${FILES[@]}"; do
  [[ -f "$f" ]] || continue
  for rule in "${RULES[@]}"; do
    applies "$f" "$rule" || continue
    while IFS= read -r hit; do
      [[ -z "$hit" ]] && continue
      line="${hit%%:*}"
      text="${hit#*:}"
      text="$(echo "$text" | sed -E 's/^[[:space:]]+//' | cut -c1-140)"
      echo "$f:$line: [$rule] $text"
      failures=$((failures + 1))
    done < <(matches "$f" "$rule")
  done
done

if (( failures > 0 )); then
  echo "check-ui: $failures ocorrência(s) proibida(s). Troque por tokens do design system ou justifique em $ALLOWLIST." >&2
  exit 1
fi
echo "check-ui: ok (${#FILES[@]} arquivo(s))"
