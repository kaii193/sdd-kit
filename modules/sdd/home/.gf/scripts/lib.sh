if [ -z "${BASH_VERSINFO:-}" ] || [ "${BASH_VERSINFO[0]}" -lt 4 ]; then
  echo "SDD scripts cần bash >= 4 (macOS: brew install bash). Bash hiện tại: ${BASH_VERSION:-không rõ}" >&2
  exit 2
fi
GF_HOME="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

red()    { printf '\033[31m%s\033[0m\n' "$*"; }
yellow() { printf '\033[33m%s\033[0m\n' "$*"; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }

resolve_spec_dir() {
  local arg="${1:-}"
  if [ -z "$arg" ]; then
    echo "Thiếu thư mục spec (vd: projects/<dự-án>/specs/NNN-ten)" >&2
    return 1
  fi
  if [ -d "$arg" ]; then (cd "$arg" && pwd); return; fi
  if [ -d "$GF_HOME/$arg" ]; then (cd "$GF_HOME/$arg" && pwd); return; fi
  echo "Không tìm thấy thư mục spec: $arg" >&2
  return 1
}

project_dir_of() {
  (cd "$1/../.." && pwd)
}

load_project_config() {
  local config="$1/config.sh"
  if [ ! -f "$config" ]; then
    echo "Thiếu $config — thư mục spec phải nằm trong projects/<dự-án>/specs/" >&2
    exit 1
  fi
  source "$config"
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
