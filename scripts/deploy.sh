#!/bin/zsh
# Fanfares deploy: commits dev, pushes db schema to prod, merges into main.
set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo "${GREEN}▶ $1${NC}"; }
warn()  { echo "${YELLOW}⚠ $1${NC}"; }
error() { echo "${RED}✖ $1${NC}"; exit 1; }

# ── 1. Must be on dev ────────────────────────────────────────────────────────
CURRENT=$(git rev-parse --abbrev-ref HEAD)
if [[ "$CURRENT" != "brian" ]]; then
  warn "You are on '$CURRENT', switching to brian..."
  git checkout brian
fi

# ── 2. Prompt for commit message ─────────────────────────────────────────────
echo ""
echo -n "Commit message: "
read COMMIT_MSG
if [[ -z "$COMMIT_MSG" ]]; then
  error "Commit message cannot be empty."
fi

# ── 3. Stage, commit and push dev ────────────────────────────────────────────
info "Staging all changes..."
git add .

if git diff --cached --quiet; then
  warn "Nothing to commit — working tree clean."
else
  info "Committing: $COMMIT_MSG"
  git commit -m "$COMMIT_MSG"
fi

info "Pushing dev branch..."
git push origin dev

# ── 4. Switch to main and push DB schema ─────────────────────────────────────
info "Switching to main..."
git checkout main

info "Pulling latest main..."
git pull origin main

# ── 5. Merge dev into main and push DB schema ───────────────────────────────
info "Merging dev into main..."
git merge brian --no-edit

if [[ ! -f "supabase/.temp/project-ref" ]]; then
  error "Supabase project is not linked. Run: npx supabase link"
fi

info "Pushing database schema to production Supabase..."
npx supabase db push --linked

# ── 6. Push main ──────────────────────────────────────────────────────────────

info "Pushing main branch..."
git push origin main

# ── 7. Switch back to dev ────────────────────────────────────────────────────
info "Switching back to brian..."
git checkout brian

echo ""
info "Deploy complete! 🎺"
