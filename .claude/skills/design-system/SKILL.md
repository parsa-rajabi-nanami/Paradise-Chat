---
name: design-system
description: "Design-token ARCHITECTURE for UI: three-layer tokens (primitive→semantic→component), CSS variables, spacing/typography scales, and component state specs. Use when modeling or restructuring tokens/theming so values are not hardcoded. NOT for writing Tailwind utility classes (use tailwind-design-system) and NOT for slides/branding."
argument-hint: "[component or token]"
license: MIT
metadata:
  author: claudekit
  version: "1.0.0"
---

# Design System

Token architecture and component specifications. Defines *how design values are structured* so
they stay consistent and themeable. The Tailwind-specific implementation lives in the
`tailwind-design-system` skill.

## Use this skill when

- Modeling design tokens (color, spacing, typography, radius, shadow)
- Restructuring hardcoded hex/px values into a token system
- Defining component state specs (default/hover/active/disabled)
- Setting up CSS-variable theming or light/dark token layers
- Mapping tokens into a Tailwind theme config

## Do not use this skill when

- Writing Tailwind utility classes or responsive variants → use `tailwind-design-system`
- Building React component logic/state → delegate to the `frontend-developer` agent
- The request is about slides, presentations, branding, logos, or marketing assets
- Backend/Django/API work

## Three-layer token structure

```
Primitive (raw values)  →  Semantic (purpose aliases)  →  Component (component-specific)
```

```css
--color-blue-600: #2563EB;              /* Primitive */
--color-primary: var(--color-blue-600); /* Semantic  */
--button-bg: var(--color-primary);      /* Component */
```

## Component spec pattern

| Property   | Default | Hover        | Active         | Disabled     |
|------------|---------|--------------|----------------|--------------|
| Background | primary | primary-dark | primary-darker | muted        |
| Text       | white   | white        | white          | muted-fg     |
| Shadow     | sm      | md           | none           | none         |

## References (load only when needed)

| Topic                | File                                |
|----------------------|-------------------------------------|
| Token architecture   | `references/token-architecture.md`  |
| Primitive tokens     | `references/primitive-tokens.md`    |
| Semantic tokens      | `references/semantic-tokens.md`     |
| Component tokens     | `references/component-tokens.md`    |
| Component specs      | `references/component-specs.md`     |
| States & variants    | `references/states-and-variants.md` |
| Tailwind integration | `references/tailwind-integration.md`|

## Best practices

1. Never use raw hex/px in components — always reference a token.
2. The semantic layer enables theme switching (light/dark).
3. Component tokens enable per-component customization.
4. Use HSL for opacity control; document each token's purpose.
