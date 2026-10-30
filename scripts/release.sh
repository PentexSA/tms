#!/usr/bin/env bash
# Corte de release: sobe o "version" do package.json da raiz (semver) num
# commit em cima da origin/main, marca com a tag vX.Y.Z e leva a branch
# `release`, a que o Render publica, até esse commit. Só avança
# (fast-forward): o que está no ar sempre veio da main.
#
#   pnpm release patch   # 1.0.0 -> 1.0.1
#   pnpm release minor   # 1.0.0 -> 1.1.0
#   pnpm release major   # 1.0.0 -> 2.0.0
#
# O corte é feito num worktree temporário: a sua árvore e a sua branch não
# mudam. Para voltar atrás, use o Rollback do Render (ou um revert na main e
# um corte novo), nunca um force push na release.
set -euo pipefail

BUMP=${1:-}
case $BUMP in
  patch | minor | major) ;;
  *)
    echo "uso: pnpm release <patch|minor|major>"
    exit 2
    ;;
esac

git fetch --quiet --tags origin main release
if ! git merge-base --is-ancestor origin/release origin/main; then
  echo "A release tem commits fora da main, e o corte só avança."
  exit 1
fi
if [ -z "$(git rev-list origin/release..origin/main)" ]; then
  echo "Nada novo: a release já está na origin/main."
  exit 0
fi

CURRENT=$(git show origin/main:package.json |
  node -p 'JSON.parse(require("fs").readFileSync(0, "utf8")).version')
NEXT=$(node -e '
  const [version, bump] = process.argv.slice(1)
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
  if (!m) {
    console.error(`version fora do semver: ${version}`)
    process.exit(1)
  }
  let [major, minor, patch] = m.slice(1).map(Number)
  if (bump === "major") [major, minor, patch] = [major + 1, 0, 0]
  else if (bump === "minor") [minor, patch] = [minor + 1, 0]
  else patch++
  console.log(`${major}.${minor}.${patch}`)
' "$CURRENT" "$BUMP")
TAG=v$NEXT
if git rev-parse --quiet --verify "refs/tags/$TAG" >/dev/null; then
  echo "A tag $TAG já existe."
  exit 1
fi

echo "Corte $TAG ($CURRENT -> $NEXT), entram:"
git log --oneline origin/release..origin/main
read -r -p "Publicar? [s/N] " ok
[ "$ok" = s ] || [ "$ok" = S ] || {
  echo "Cancelado."
  exit 1
}

WT=$(mktemp -d)
trap 'git worktree remove --force "$WT" >/dev/null 2>&1 || true; rm -rf "$WT"' EXIT
git worktree add --quiet --detach "$WT" origin/main
node -e '
  const fs = require("fs")
  const [file, version] = process.argv.slice(1)
  const text = fs.readFileSync(file, "utf8")
  fs.writeFileSync(file, text.replace(/"version": "[^"]*"/, `"version": "${version}"`))
' "$WT/package.json" "$NEXT"
# Sem os hooks: o worktree não tem node_modules, e o commit só muda a versão
git -C "$WT" commit --quiet --no-verify -am "chore(release): $TAG"
git -C "$WT" tag -a "$TAG" -m "Release $TAG"
SHA=$(git -C "$WT" rev-parse HEAD)

# Atômico: main, release e tag entram juntas ou nenhuma (se a main andou
# desde o fetch, nada muda). Sem o pre-push: ele roda a suíte na árvore
# local, e o corte só leva à release commits que já passaram pelo CI na main.
if ! git push --atomic --no-verify origin \
  "$SHA:refs/heads/main" "$SHA:refs/heads/release" "refs/tags/$TAG"; then
  git tag -d "$TAG" >/dev/null
  echo "O push falhou (a main andou?): nada foi publicado, rode de novo."
  exit 1
fi
echo "Release $TAG enviada: o Render publica a branch release."
