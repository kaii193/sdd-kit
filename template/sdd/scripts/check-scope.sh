#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

dir="$(find_spec_dir "${1:-}")"
if [ -z "$dir" ]; then
  yellow "Không xác định được spec (branch không có dạng feature/NNN-...). Bỏ qua."
  exit 0
fi
spec="$dir/spec.md"
[ -f "$spec" ] || { red "Thiếu $spec"; exit 1; }

base="${SDD_BASE:-}"
if [ -z "$base" ]; then
  if git rev-parse --verify -q "origin/$BASE_BRANCH" >/dev/null; then base="origin/$BASE_BRANCH"; else base="$BASE_BRANCH"; fi
fi

declare -A REL=()
while IFS=$'\t' read -r mod rel; do
  [ -n "$mod" ] && REL["$mod"]="$rel"
done < <(awk -F'|' '
  /^## /{sec=($0 ~ /Phụ thuộc/); next}
  sec && /^\|/ && $0 !~ /^\|[[:space:]:|-]+\|[[:space:]]*$/ {
    mods=$2; rel=$3; gsub(/`/,"",mods); gsub(/^[[:space:]]+|[[:space:]]+$/,"",rel)
    n=split(mods, arr, ",")
    for (i=1;i<=n;i++){ m=arr[i]; gsub(/[[:space:]]/,"",m); if (m!="" && m!="Module") print m "\t" rel }
  }' "$spec")

declare -A TOUCHED=()
outside=(); shared=()
while IFS= read -r f; do
  [ -z "$f" ] && continue
  path_in "$f" "${IGNORE_PATHS[@]}" && continue
  if path_in "$f" "${SHARED_PATHS[@]}"; then shared+=("$f"); continue; fi
  m="$(module_of "$f")"
  if [ -n "$m" ]; then TOUCHED["$m"]+="$f"$'\n'; else outside+=("$f"); fi
done < <(git diff --name-only "$base"...HEAD)

errors=0; warns=0
err()  { red "  ✗ $*"; errors=$((errors+1)); }
warn() { yellow "  ! $*"; warns=$((warns+1)); }

echo "Kiểm tra phạm vi: ${dir#"$ROOT"/}  (so với $base)"
k1="${!REL[*]}"; k2="${!TOUCHED[*]}"
echo "  Khai báo: ${k1:-(trống)}"
echo "  Bị sửa:   ${k2:-(không có)}"
echo

for m in "${!TOUCHED[@]}"; do
  files="$(printf '%s' "${TOUCHED[$m]}" | sed '/^$/d' | sed 's/^/        /')"
  if [ -z "${REL[$m]+x}" ]; then
    err "Module '$m' bị sửa nhưng KHÔNG khai báo trong spec:"; echo "$files"
  else
    case "${REL[$m]}" in
      *"Chỉ đọc"*)      err "Module '$m' khai báo 'Chỉ đọc' nhưng bị sửa:"; echo "$files";;
      *"Bị ảnh hưởng"*) warn "Module '$m' khai báo 'Bị ảnh hưởng' nhưng bị sửa — cập nhật quan hệ trong spec nếu có chủ đích";;
    esac
  fi
done

for m in "${!REL[@]}"; do
  case "${REL[$m]}" in
    *"Sửa"*|*"Mới"*) [ -z "${TOUCHED[$m]+x}" ] && warn "Module '$m' khai báo '${REL[$m]}' nhưng chưa có thay đổi";;
  esac
done

if [ "${#outside[@]}" -gt 0 ]; then
  warn "File không thuộc module nào (kiểm tra MODULE_GLOBS trong sdd/config.sh):"
  printf '        %s\n' "${outside[@]}"
fi
if [ "${#shared[@]}" -gt 0 ]; then
  warn "Sửa file hạ tầng dùng chung — reviewer cần chú ý:"
  printf '        %s\n' "${shared[@]}"
fi

echo
if [ "$errors" -gt 0 ]; then
  red "check-scope: $errors lỗi, $warns cảnh báo"
  [ "$SCOPE_MODE" = "strict" ] && exit 1
  yellow "(SCOPE_MODE=warn — không làm fail)"; exit 0
fi
green "check-scope: OK ($warns cảnh báo)"
