# Skills & Subagents Index

Reference for the Claude Code environment in this repo. Skills are **not** auto-loaded — each
activates only when a request clearly matches its triggers. Heavy docs live in `references/` /
`resources/` and load progressively (only when the SKILL.md points to them).

Token footprint = approximate cost when the skill body is loaded into context.

---

## Skills

### tailwind-design-system
- **Purpose:** Implementation in Tailwind CSS — `tailwind.config` theme, utility-class variants,
  responsive breakpoints, class-strategy dark mode, accessible Tailwind patterns.
- **Triggers:** writing/extending Tailwind classes or config in the frontend.
- **Does NOT cover:** abstract token architecture (→ design-system), React logic, backend.
- **Token footprint:** Low (SKILL.md ~1.5 KB).
- **Resources:** `resources/implementation-playbook.md` (~18 KB, on-demand).
- **Default state:** enabled, trigger-gated.

### design-system
- **Purpose:** Design-token architecture — three-layer tokens (primitive→semantic→component),
  CSS variables, spacing/typography scales, component state specs.
- **Triggers:** modeling/restructuring tokens or theming so values aren't hardcoded.
- **Does NOT cover:** Tailwind utility authoring (→ tailwind-design-system), slides, branding.
  Slide/presentation generation from the upstream skill was removed.
- **Token footprint:** Low (SKILL.md ~4 KB).
- **Resources:** `references/` ×7 (token-architecture, primitive/semantic/component-tokens,
  component-specs, states-and-variants, tailwind-integration), on-demand.
- **Default state:** enabled, trigger-gated.

### django-expert
- **Purpose:** Django 5 + DRF — models/indexes, ORM optimization (`select_related`/
  `prefetch_related`), serializers, viewsets, JWT/permissions, tests.
- **Triggers:** Django/DRF backend files (models.py, serializers, viewsets, settings.py).
- **Does NOT cover:** Channels/WebSocket/Redis async layer, frontend, non-Django Python.
- **Token footprint:** Medium (SKILL.md ~6 KB).
- **Resources:** `references/` ×5 (models-orm, drf-serializers, viewsets-views, authentication,
  testing-django), on-demand.
- **Default state:** enabled, trigger-gated.

---

## Subagents (explicit delegation only)

### frontend-developer  (`.claude/agents/frontend-developer.md`)
- **Purpose:** React component architecture, Zustand/client state, frontend performance, a11y.
- **Invocation:** explicit Task delegation only — never auto-invoked.
- **Scope note:** project is React + Vite + Tailwind; treat the file's Next.js/RSC content as
  transferable React knowledge, not the runtime stack.
- **Tools:** Read, Write, Edit, Glob, Grep, Bash.
- **Token footprint:** Medium (~7 KB, loaded only on delegation).
- **Default state:** dormant until delegated.

---

## Self-containment

Everything installed for this project lives inside this repo's `.claude/` directory:
`CLAUDE.md` (workspace guidance), `SKILLS_INDEX.md`, `skills/` (10 skills + resources/references),
`agents/` (4 subagents), plus `resources/`, `prompts/`, `templates/`, and `setup/`.
**Nothing was written to the global `~/.claude/skills` or `~/.claude/agents`** — verified empty.

Run `bash .claude/setup/verify.sh` after cloning to confirm the layout and report any missing
global prerequisites. The only acceptable global dependency is the `claude` executable itself.

### caveman — now VENDORED locally (no longer a global dependency)

The caveman plugin is **fully copied into this repo** and no longer needs the global plugin:

- **Skills** (`.claude/skills/`): `caveman`, `caveman-commit`, `caveman-compress`, `caveman-help`,
  `caveman-review`, `caveman-stats`, `cavecrew`.
- **Subagents** (`.claude/agents/`): `cavecrew-builder`, `cavecrew-investigator`, `cavecrew-reviewer`.
- **Plugin machinery** (`.claude/resources/caveman/`): complete plugin tree — `src/hooks/` (node),
  `commands/`, `docs/`, `LICENSE`, manifests. Offline-complete; no network needed.
- **Hooks** are wired in `.claude/settings.json` (`SessionStart` + `UserPromptSubmit`) pointing at
  the vendored node scripts via `$CLAUDE_PROJECT_DIR` — so caveman auto-activates from the repo copy.
- **Double-registration avoided** project-scoped: `.claude/settings.json` sets
  `enabledPlugins."caveman@caveman": false`, disabling the global plugin *only inside this repo*
  (the user's global caveman elsewhere is untouched, and the key is harmless on a clone where the
  plugin isn't installed).
- **Requires `node` on PATH** for the hooks (vendored scripts are JS). Checked by `verify.sh`.

License: caveman is MIT (see `.claude/resources/caveman/LICENSE`), author Julius Brussee.

### Documented global exception: frontend-design plugin

`frontend-design` is likewise an official **plugin** (`~/.claude/plugins/cache/claude-plugins-official/frontend-design`),
not loose skills. Same rationale as caveman: vendoring would double-register and conflict with the
globally resolved plugin. Not vendored; reinstall via the plugin marketplace on another machine if
its visual-design guidance is wanted. The project does not depend on it at runtime.

> `frontend-design` is **optional** and the only remaining un-vendored global plugin (visual-design
> guidance, not required for this repo's core behavior). caveman is now local. The one true global
> dependency is the `claude` executable (plus `node` for caveman's hooks).

---

## Overlap notes

- `tailwind-design-system` (Tailwind implementation) vs `design-system` (token architecture):
  descriptions/triggers are scoped to keep them distinct — implementation vs modeling.
- `django-expert` is explicitly bounded out of the Channels/WebSocket/Redis real-time layer to
  avoid misfiring on async backend work.
