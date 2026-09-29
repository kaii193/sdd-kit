#!/usr/bin/env bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

dir="$(resolve_spec_dir "${1:-}")"
load_project_config "$(project_dir_of "$dir")"
spec="$dir/spec.md"
[ -f "$spec" ] || { red "Thiếu $spec"; exit 1; }

code_dir="${GF_CODE_DIR:-$PROJECT_PATH}"
git -C "$code_dir" rev-parse --is-inside-work-tree >/dev/null 2>&1 || { red "Không phải git repo: $code_dir"; exit 1; }

base="${SDD_BASE:-}"
if [ -z "$base" ]; then
  if git -C "$code_dir" rev-parse --verify -q "origin/$BASE_BRANCH" >/dev/null; then base="origin/$BASE_BRANCH"; else base="$BASE_BRANCH"; fi
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
while IFS= read -r -d '' f; do
  [ -z "$f" ] && continue
  path_in "$f" "${IGNORE_PATHS[@]}" && continue
  if path_in "$f" "${SHARED_PATHS[@]}"; then shared+=("$f"); continue; fi
  m="$(module_of "$f")"
  if [ -n "$m" ]; then TOUCHED["$m"]+="$f"$'\n'; else outside+=("$f"); fi
done < <(git -C "$code_dir" -c core.quotePath=false diff --name-only --no-renames -z "$base"...HEAD)

errors=0; warns=0
err()  { red "  ✗ $*"; errors=$((errors+1)); }
warn() { yellow "  ! $*"; warns=$((warns+1)); }

echo "Kiểm tra phạm vi: ${dir#"$GF_HOME"/}  (repo $code_dir, so với $base)"
k1="${!REL[*]}"; k2="${!TOUCHED[*]}"
echo "  Khai báo: ${k1:-(trống)}"
echo "  Bị sửa:   ${k2:-(không có)}"
echo

for m in "${!REL[@]}"; do
  case "${REL[$m]}" in
    "Chỉ đọc"|"Sửa nội bộ"|"Sửa hợp đồng"|"Mới"|"Bị ảnh hưởng") ;;
    *) err "Module '$m': quan hệ '${REL[$m]}' không hợp lệ — dùng đúng một trong: Chỉ đọc, Sửa nội bộ, Sửa hợp đồng, Mới, Bị ảnh hưởng";;
  esac
done

for m in "${!TOUCHED[@]}"; do
  files="$(printf '%s' "${TOUCHED[$m]}" | sed '/^$/d' | sed 's/^/        /')"
  if [ -z "${REL[$m]+x}" ]; then
    err "Module '$m' bị sửa nhưng KHÔNG khai báo trong spec:"; echo "$files"
  else
    case "${REL[$m]}" in
      "Chỉ đọc")      err "Module '$m' khai báo 'Chỉ đọc' nhưng bị sửa:"; echo "$files";;
      "Bị ảnh hưởng") warn "Module '$m' khai báo 'Bị ảnh hưởng' nhưng bị sửa — cập nhật quan hệ trong spec nếu có chủ đích";;
    esac
  fi
done

for m in "${!REL[@]}"; do
  case "${REL[$m]}" in
    "Sửa nội bộ"|"Sửa hợp đồng"|"Mới") [ -z "${TOUCHED[$m]+x}" ] && warn "Module '$m' khai báo '${REL[$m]}' nhưng chưa có thay đổi";;
  esac
done

if [ "${#outside[@]}" -gt 0 ]; then
  warn "File không thuộc module nào (kiểm tra MODULE_GLOBS trong config.sh của dự án):"
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
