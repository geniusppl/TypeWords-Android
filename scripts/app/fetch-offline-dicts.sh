#!/usr/bin/env bash
# 把 scripts/app/offline-dicts.txt 里列出的词典/课文下载到 public/dicts/en/，打进 APP（离线可用）
set -euo pipefail
cd "$(dirname "$0")/../.."
BASE=https://files.typewords.cc/dicts/en
fail=0
while IFS= read -r line; do
  line="${line%%#*}"; line="$(echo "$line" | xargs)"
  [ -z "$line" ] && continue
  dest="public/dicts/en/$line"
  mkdir -p "$(dirname "$dest")"
  if [ -s "$dest" ]; then continue; fi
  ok=0
  for i in 1 2 3 4; do
    if curl -fsSL --retry 2 -o "$dest.tmp" "$BASE/$line" && head -c 1 "$dest.tmp" | grep -q '\['; then
      mv "$dest.tmp" "$dest"; ok=1; break
    fi
    sleep 5
  done
  if [ $ok = 0 ]; then echo "下载失败: $line"; rm -f "$dest.tmp"; fail=$((fail+1)); fi
done < scripts/app/offline-dicts.txt
echo "内置词典: $(find public/dicts/en -name '*.json' | wc -l) 个, $(du -sh public/dicts | cut -f1)"
[ $fail -lt 5 ]
