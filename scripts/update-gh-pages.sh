#!/usr/bin/env bash
# 更新已发布的 GitHub Pages 静态网页版（普通提交 + 普通 push，不改写历史）。
set -euo pipefail
REPO="${1:-guandan-play}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/dist/guandan-play-web"
gh auth status >/dev/null
OWNER="$(gh api user -q .login)"
echo "预检：文件齐全 / 无服务端文件 / 无 Jev 接口引用"
for f in index.html style.css guandan.bundle.js manifest.json sw.js icons/apple-touch-icon.png; do test -f "$WEB/$f"; done
if find "$WEB" -name '*.mjs' -o -name '*.jsonl' -o -name 'server*' -o -name '.env*' | grep -q .; then echo "发现不应发布的文件" >&2; exit 1; fi
if grep -rIl "jevbridge\|api\.typesafe\.ai" "$WEB" >/dev/null; then echo "静态包中含有服务端引用" >&2; exit 1; fi
gh repo view "$OWNER/$REPO" >/dev/null
TMP="$(mktemp -d)"
gh repo clone "$OWNER/$REPO" "$TMP/repo" -- -q
cd "$TMP/repo"
git rm -rq --ignore-unmatch . >/dev/null
cp -r "$WEB"/. .
git add -A
if git diff --cached --quiet; then echo "没有变化"; exit 0; fi
git -c user.name="$OWNER" -c user.email="$OWNER@users.noreply.github.com" commit -qm "${MSG:-更新掼蛋教练静态网页版}"
git push -q origin main
echo "已推送：https://$OWNER.github.io/$REPO/  缓存版本：$(grep -o "guandan-play-[0-9a-f]*" sw.js)"
