# resources/

Vendored static resources for this workspace. **Everything Claude needs at runtime lives here** —
no GitHub Raw URLs, no network fetches.

Currently empty: the installed skills carry their own knowledge in their `references/` and
`resources/` subfolders, so no shared resource has needed vendoring yet.

When a skill or agent would otherwise reference an external file (image, dataset, schema, doc):

1. Download it into this folder.
2. Replace the external URL in the skill/agent with a relative path to the local copy.
3. Note its origin in this README so it can be refreshed later.

| File | Origin | Used by |
|------|--------|---------|
| _(none yet)_ | | |
