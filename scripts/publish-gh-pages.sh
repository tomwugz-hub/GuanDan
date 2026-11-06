#!/usr/bin/env bash
# 将纯静态网页版（dist/guandan-play-web）发布到 GitHub Pages。
# 前提：box 上已执行过 `gh auth login`（需要用户本人在浏览器里批准）。
# 只发布静态文件：index.html / style.css / guandan.bundle.js / manifest.json / sw.js / icons/ / .nojekyll
set -euo pipefail
REPO="${1:-guandan-play}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/dist/guandan-play-web"
gh auth status >/dev/null
OWNER="$(gh api user -q .login)"
echo "预检：文件齐全 / 无服务端文件 / 无 Jev 接口引用"
for f in index.html style.css guandan.bundle.js manifest.json sw.js icons/apple-touch-icon.png; do test -f "$WEB/$f"; done
# 安全检查：不得包含服务端/评测/密钥相关文件
if find "$WEB" -name '*.mjs' -o -name '*.jsonl' -o -name 'server*' -o -name '.env*' | grep -q .; then echo "发现不应发布的文件" >&2; exit 1; fi
if grep -rIl "jevbridge\|api\.typesafe\.ai" "$WEB" >/dev/null; then echo "静态包中含有服务端引用" >&2; exit 1; fi
TMP="$(mktemp -d)"
cp -r "$WEB"/. "$TMP"/
cd "$TMP"
git init -q -b main
git add -A
git -c user.name="$OWNER" -c user.email="$OWNER@users.noreply.github.com" commit -qm "掼蛋教练 静态网页版"
if gh repo view "$OWNER/$REPO" >/dev/null 2>&1; then echo "仓库 $OWNER/$REPO 已存在，停止" >&2; exit 2; fi
gh repo create "$OWNER/$REPO" --public --description "掼蛋教练 · 四人对局（离线网页版）" >/dev/null
git remote add origin "https://github.com/$OWNER/$REPO.git"
gh auth setup-git >/dev/null
git push -q -f origin main
gh api -X POST "repos/$OWNER/$REPO/pages" -f "source[branch]=main" -f "source[path]=/" >/dev/null 2>&1 || \
  gh api -X PUT "repos/$OWNER/$REPO/pages" -f "source[branch]=main" -f "source[path]=/" >/dev/null
echo "已发布：https://$OWNER.github.io/$REPO/ （首次构建约 1 分钟）"
