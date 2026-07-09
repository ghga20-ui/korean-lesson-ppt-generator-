#!/usr/bin/env bash
# 슬라이드 JSON -> .pptx -> PowerPoint 네이티브 렌더 PNG
#
#   ./render.sh <payload.json> <out-basename> [port]
#
# 결과: <out-basename>.pptx, <out-basename>.png
#
# 주의: OfficeCLI 네이티브 렌더는 옛한글 조합용 자모(U+1100 블록)의
# OpenType shaping을 재현하지 못한다. 옛한글 슬라이드 판정에는 쓰지 말 것.
set -euo pipefail

payload="$1"
base="$2"
port="${3:-3000}"

curl -sf -X POST "http://localhost:${port}/api/generate-pptx" \
  -H "Content-Type: application/json" \
  --data-binary "@${payload}" \
  -o "${base}.pptx"

officecli view "${base}.pptx" screenshot --render native -o "${base}.png" >/dev/null 2>&1
echo "${base}.png"
