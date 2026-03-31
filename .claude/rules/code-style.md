---
paths:
  - "apps/mobile/**/*.{ts,tsx}"
---

# Code Style

We use ultracite with oxlint and oxfmt to lint and format our codebase.

To check lint and format problems, run:

```bash
yarn run check
```

Run the following command if you want to try to fix them automatically:

```bash
yarn run fix
```

Note: Some errors don't have auto fix and will require manual fix.