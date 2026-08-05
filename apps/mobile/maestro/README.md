# Maestro Studio entry

Open **`apps/mobile/.maestro`** in Maestro Studio (single YAML source of truth).

Do **not** recreate `maestro/satsigner-workspace` as a symlink under this app —
Metro treats that path as a watched directory and crashes if it becomes a symlink.

```bash
cd apps/mobile && pnpm maestro:link-studio   # prints the path to open
```

Edit flows only under `.maestro/flows/`. See `.maestro/AGENT_FEEDBACK.md`.
