#!/usr/bin/env bash
set -e

echo "Building production bundle..."
npm run build

TEMP_DIR=$(mktemp -d)
echo "Deploying to gh-pages branch via temporary worktree $TEMP_DIR..."
git worktree add "$TEMP_DIR" -B gh-pages
rm -rf "$TEMP_DIR"/*
cp -r dist/* "$TEMP_DIR"/
cd "$TEMP_DIR"
git add -A
git commit -m "deploy: GitHub Pages build $(date -u +"%Y-%m-%dT%H:%M:%SZ")" || true
git push -u origin gh-pages --force
cd - > /dev/null
git worktree remove "$TEMP_DIR"

echo "Successfully deployed to https://federicocalonso.github.io/cadcat/"
