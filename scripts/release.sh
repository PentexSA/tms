#!/usr/bin/env bash
# Corte de release: leva a branch `release`, a que o Render publica, até um
# commit da main e marca o corte com uma tag. Só avança (fast-forward): o que
# está no ar sempre veio da main, e um corte nunca reescreve outro.
#
#   pnpm release            # corta da origin/main
#   pnpm release <commit>   # corta de um commit que já está na main
#
# Para voltar atrás, use o Rollback do Render (ou um revert na main e um
# corte novo), nunca um force push na release.
set -euo pipefail

REF=${1:-origin/main}
git fetch --quiet --tags origin main release
TARGET=$(git rev-parse --verify "$REF^{commit}")

if ! git merge-base --is-ancestor "$TARGET" origin/main; then
  echo "$REF não está na origin/main: faça o merge do PR antes do corte."
  exit 1
fi
if git merge-base --is-ancestor "$TARGET" origin/release; then
  echo "Nada novo: a release já contém $REF."
  exit 0
fi
if ! git merge-base --is-ancestor origin/release "$TARGET"; then
  echo "A release tem commits fora de $REF, e o corte só avança."
  exit 1
fi

TAG=release-$(date +%Y%m%d-%H%M%S)
echo "Corte $TAG ($(git rev-parse --short "$TARGET")), entram:"
git log --oneline origin/release.."$TARGET"
read -r -p "Publicar? [s/N] " ok
[ "$ok" = s ] || [ "$ok" = S ] || { echo "Cancelado."; exit 1; }

git tag -a "$TAG" -m "Corte de release $TAG" "$TARGET"
# Sem o pre-push: ele roda a suíte na árvore local, e o corte só move a
# release para commits que já passaram pelo CI na main
git push --no-verify origin "$TARGET:refs/heads/release" "refs/tags/$TAG"
echo "Release $TAG enviada: o Render publica a branch release."
