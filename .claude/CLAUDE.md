# Workspace Claude configuration

This directory makes Paradise Chat a **self-contained Claude Code workspace**. Every
project-specific Skill, Agent, prompt, template, resource, and index lives here, inside the
repository. Cloning the repo reproduces the same Claude behavior — no manual reinstallation of
Skills or Agents, and no writes to the user's global `~/.claude/`.

> The repo's top-level [`../CLAUDE.md`](../CLAUDE.md) documents the *application* (Django + React).
> This file documents the *Claude workspace*.

## Layout

```
.claude/
  CLAUDE.md          # this file — workspace guidance
  SKILLS_INDEX.md    # catalog of local skills + agents (read this first)
  settings.json      # project-local permissions (committed)
  settings.local.json# machine-local overrides (not portable; gitignore-able)
  skills/            # complete, self-contained skills (copied in full)
  agents/            # project subagents (delegated locally)
  resources/         # vendored static resources (no external fetch at runtime)
  prompts/           # reusable prompt snippets for this project
  templates/         # scaffolding templates (code/doc starters)
  setup/             # verify.sh — checks the local environment
```

## Self-containment contract

1. Nothing is installed into `~/.claude/skills` or `~/.claude/agents`. Verified empty.
2. Skills are copied **in full** into `skills/<name>/`; their references/resources are local.
3. No runtime dependency on GitHub Raw URLs or other network resources. The only URLs left in
   skill files are attribution/further-reading links (not fetched to function).
4. The **only** acceptable global dependency is the `claude` executable itself.

## Onboarding (new clone)

```bash
bash .claude/setup/verify.sh
```

The script confirms the local layout is intact and reports any missing global prerequisites.

## Remaining global dependencies

See [SKILLS_INDEX.md](SKILLS_INDEX.md) → "Self-containment". All project skills/agents — **including
the full caveman plugin** — are vendored locally (`skills/`, `agents/`, `resources/caveman/`) and
wired via project `settings.json`. The global caveman plugin is disabled for this repo to avoid
double-registration.

Global runtime requirements: the `claude` executable, and **`node`** (caveman's hooks are JS).
The `frontend-design` plugin is the only un-vendored, optional global plugin and is not required.
