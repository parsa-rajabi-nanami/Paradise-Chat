#!/usr/bin/env bash
#
# verify.sh — Verify the self-contained Claude workspace for Paradise Chat.
#
# Confirms the project-local .claude/ layout is intact, that nothing this repo needs was
# installed into the user's global ~/.claude, and reports any missing global prerequisites.
# The ONLY acceptable global dependency is the `claude` executable itself.
#
# Usage:  bash .claude/setup/verify.sh
# Exit:   0 = workspace OK (warnings allowed);  1 = a required local component is missing.

set -u

# Resolve repo root (.claude/setup/ -> repo root)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_DIR="$(cd "$CLAUDE_DIR/.." && pwd)"

red()   { printf '\033[31m%s\033[0m\n' "$1"; }
grn()   { printf '\033[32m%s\033[0m\n' "$1"; }
ylw()   { printf '\033[33m%s\033[0m\n' "$1"; }

fail=0
warn=0

echo "Paradise Chat — Claude workspace verification"
echo "repo:   $REPO_DIR"
echo "claude: $CLAUDE_DIR"
echo

# --- 1. Required local structure -------------------------------------------------
echo "[1] Required local structure"
req_dirs=(skills agents resources prompts templates setup)
req_files=(CLAUDE.md SKILLS_INDEX.md)
for d in "${req_dirs[@]}"; do
  if [ -d "$CLAUDE_DIR/$d" ]; then grn "  ok   dir  .claude/$d/"
  else red "  MISS dir  .claude/$d/"; fail=1; fi
done
for f in "${req_files[@]}"; do
  if [ -f "$CLAUDE_DIR/$f" ]; then grn "  ok   file .claude/$f"
  else red "  MISS file .claude/$f"; fail=1; fi
done
echo

# --- 2. Local skills are self-contained (have a SKILL.md) ------------------------
echo "[2] Local skills"
skill_count=0
if [ -d "$CLAUDE_DIR/skills" ]; then
  for s in "$CLAUDE_DIR"/skills/*/; do
    [ -d "$s" ] || continue
    name="$(basename "$s")"
    skill_count=$((skill_count+1))
    if [ -f "$s/SKILL.md" ]; then grn "  ok   skill $name (SKILL.md present)"
    else red "  BAD  skill $name (no SKILL.md)"; fail=1; fi
  done
fi
[ "$skill_count" -eq 0 ] && { ylw "  warn no skills found under .claude/skills/"; warn=1; }
echo

# --- 3. Local agents -------------------------------------------------------------
echo "[3] Local agents"
agent_count=$(find "$CLAUDE_DIR/agents" -maxdepth 1 -name '*.md' 2>/dev/null | wc -l | tr -d ' ')
if [ "$agent_count" -gt 0 ]; then grn "  ok   $agent_count agent file(s) in .claude/agents/"
else ylw "  warn no agent .md files in .claude/agents/"; warn=1; fi
echo

# --- 4. No project skills/agents leaked into global ~/.claude --------------------
echo "[4] Global cleanliness (~/.claude should hold no skills/agents for this repo)"
g_skills="$HOME/.claude/skills"
g_agents="$HOME/.claude/agents"
if [ -d "$g_skills" ] && [ -n "$(ls -A "$g_skills" 2>/dev/null)" ]; then
  ylw "  warn $g_skills is non-empty: $(ls -A "$g_skills" | tr '\n' ' ')"; warn=1
else grn "  ok   ~/.claude/skills empty or absent"; fi
if [ -d "$g_agents" ] && [ -n "$(ls -A "$g_agents" 2>/dev/null)" ]; then
  ylw "  warn $g_agents is non-empty: $(ls -A "$g_agents" | tr '\n' ' ')"; warn=1
else grn "  ok   ~/.claude/agents empty or absent"; fi
echo

# --- 5. No runtime GitHub-raw / network resource refs in skills -------------------
echo "[5] Offline-safety scan (skills must not fetch resources at runtime)"
hits=$(grep -rIloE 'raw\.githubusercontent\.com|githubusercontent\.com/.*/(raw|blob)' \
        "$CLAUDE_DIR/skills" "$CLAUDE_DIR/agents" 2>/dev/null)
if [ -n "$hits" ]; then ylw "  warn possible raw-resource URLs:"; echo "$hits" | sed 's/^/        /'; warn=1
else grn "  ok   no raw.githubusercontent resource URLs in skills/agents"; fi
echo

# --- 6. The only allowed global dependency: the claude executable ----------------
echo "[6] Global prerequisite: claude executable"
if command -v claude >/dev/null 2>&1; then
  grn "  ok   claude found: $(command -v claude)"
else
  red "  MISS claude not on PATH — install Claude Code (the one allowed global dependency)"
  fail=1
fi
echo

# --- 6b. Vendored caveman (local plugin) + node runtime -------------------------
echo "[6b] Vendored caveman plugin"
cv="$CLAUDE_DIR/resources/caveman"
for f in src/hooks/caveman-activate.js src/hooks/caveman-mode-tracker.js LICENSE; do
  if [ -e "$cv/$f" ]; then grn "  ok   caveman/$f"
  else red "  MISS caveman/$f"; fail=1; fi
done
if command -v node >/dev/null 2>&1; then grn "  ok   node found: $(node -v 2>/dev/null) ($(command -v node)) — caveman hooks runnable"
else ylw "  warn node not on PATH — caveman hooks won't run (skills still invokable manually)"; warn=1; fi
if grep -q 'caveman/src/hooks/caveman-activate.js' "$CLAUDE_DIR/settings.json" 2>/dev/null; then
  grn "  ok   caveman hooks wired in .claude/settings.json"
else ylw "  warn caveman hooks not wired in settings.json"; warn=1; fi
if grep -q '"caveman@caveman": *false' "$CLAUDE_DIR/settings.json" 2>/dev/null; then
  grn "  ok   global caveman plugin disabled for this project (no double-register)"
else ylw "  warn global caveman plugin not disabled in project settings — possible double-register"; warn=1; fi
echo

# --- 7. Optional global plugins (NOT vendored, by design) ------------------------
echo "[7] Optional global plugins (informational — see SKILLS_INDEX.md)"
for p in frontend-design; do
  if [ -d "$HOME/.claude/plugins/cache/$p" ] || \
     find "$HOME/.claude/plugins/cache" -maxdepth 2 -name "$p" -type d 2>/dev/null | grep -q .; then
    grn "  ok   plugin '$p' present in global cache"
  else
    ylw "  note plugin '$p' not installed (optional; reinstall via plugin marketplace if wanted)"
  fi
done
echo

# --- Summary ---------------------------------------------------------------------
if [ "$fail" -ne 0 ]; then
  red "RESULT: FAIL — a required local component is missing (see above)."
  exit 1
elif [ "$warn" -ne 0 ]; then
  ylw "RESULT: OK with warnings — workspace usable; review warnings above."
  exit 0
else
  grn "RESULT: OK — workspace is self-contained. Only global dependency: claude executable."
  exit 0
fi
