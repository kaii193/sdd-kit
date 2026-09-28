if [ -z "${BASH_VERSINFO:-}" ] || [ "${BASH_VERSINFO[0]}" -lt 4 ]; then
  echo "SDD scripts cần bash >= 4 (macOS: brew install bash). Bash hiện tại: ${BASH_VERSION:-không rõ}" >&2
  exit 2
fi
ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
source "$ROOT/sdd/config.sh"

red()    { printf '\033[31m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }

find_spec_dir() {
  local arg="${1:-${SDD_SPEC:-}}"
  if [ -n "$arg" ]; then
    [ -d "$arg" ] && { echo "$arg"; return; }
    [ -d "$ROOT/sdd/specs/$arg" ] && { echo "$ROOT/sdd/specs/$arg"; return; }
  fi
  local branch="${SDD_BRANCH:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)}"
  local num
  num="$(printf '%s' "$branch" | sed -nE 's#^(.*/)?feature/([0-9]{3})-.*#\2#p')"
  [ -z "$num" ] && return 0
  local d
  for d in "$ROOT"/sdd/specs/"$num"-*; do
    [ -d "$d" ] && { echo "$d"; return; }
  done
}

read_status() {
  grep -m1 -E '^\*\*Trạng thái:\*\*' "$1" 2>/dev/null \
    | sed -E 's/^\*\*Trạng thái:\*\*[[:space:]]*//' | awk '{print $1}'
}

module_of() {
  local f="$1" g prefix rest
  for g in "${MODULE_GLOBS[@]}"; do
    prefix="${g%\*}"
    if [[ "$f" == "$prefix"* ]]; then
      rest="${f#"$prefix"}"
      if [[ "$rest" == */* ]]; then echo "${rest%%/*}"; return; fi
    fi
  done
}

path_in() {
  local f="$1"; shift
  local p
  for p in "$@"; do [[ "$f" == "$p"* ]] && return 0; done
  return 1
}
