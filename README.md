# Hallatec Forge Core (`hallatec-forge-core`)

> **The canonical design core and component library for Hallatec Forge.**

This repository is the single source of truth for the shared CSS design system and JavaScript components powering all nine public, buildless Hallatec Forge cybersecurity tools.

---

## The One Rule

> **Never edit `assets/hallatec.css` or `assets/hallatec.js` directly in the tool repositories.**  
> Any change to colors, typography, layout, or shared behavior must originate in `hallatec-forge-core`.

Each of the nine tool repositories is an independent, public, buildless project deployed on Cloudflare Pages. This repository regenerates and distributes their shared assets automatically.

---

## Managed Public Tools

| Tool ID | Repository | Canonical URL | Cloudflare Pages Project |
| :--- | :--- | :--- | :--- |
| `hub` | [`hallatec/hallatec-forge-hub`](https://github.com/hallatec/hallatec-forge-hub) | [forge.hallatec.com](https://forge.hallatec.com/) | `hallatec-forge` |
| `emailguard` | [`hallatec/hallatec-emailguard`](https://github.com/hallatec/hallatec-emailguard) | [emailguard.hallatec.com](https://emailguard.hallatec.com/) | `hallatec-emailguard` |
| `hscore` | [`hallatec/hallatec-hscore`](https://github.com/hallatec/hallatec-hscore) | [hscore.hallatec.com](https://hscore.hallatec.com/) | `hallatec-hscore` |
| `attackrank` | [`hallatec/hallatec-attackrank`](https://github.com/hallatec/hallatec-attackrank) | [attackrank.hallatec.com](https://attackrank.hallatec.com/) | `hallatec-attackrank` |
| `trustkey` | [`hallatec/hallatec-trustkey`](https://github.com/hallatec/hallatec-trustkey) | [trustkey.hallatec.com](https://trustkey.hallatec.com/) | `hallatec-trustkey` |
| `aegis365` | [`hallatec/hallatec-aegis365`](https://github.com/hallatec/hallatec-aegis365) | [aegis365.hallatec.com](https://aegis365.hallatec.com/) | `hallatec-aegis365` |
| `lifeline` | [`hallatec/hallatec-lifeline`](https://github.com/hallatec/hallatec-lifeline) | [lifeline.hallatec.com](https://lifeline.hallatec.com/) | `hallatec-lifeline` |
| `lockfall` | [`hallatec/hallatec-lockfall`](https://github.com/hallatec/hallatec-lockfall) | [lockfall.hallatec.com](https://lockfall.hallatec.com/) | `hallatec-lockfall` |
| `coremap` | [`hallatec/hallatec-coremap`](https://github.com/hallatec/hallatec-coremap) | [coremap.hallatec.com](https://coremap.hallatec.com/) | `hallatec-coremap` |

---

## How Distribution Works

When a change is pushed to `main` in `hallatec-forge-core`:

1. **Safety Checks:**
   - **Truncation Guard:** Ensures CSS (≥200 lines) and JS (≥150 lines) are complete.
   - **Syntax Validation:** Runs `node --check` to guarantee valid JS.
2. **Asset Assembly:**
   - Prepend per-repo SPDX attribution header (`AGPL-3.0-or-later`).
   - Append per-tool `HTC.provenance` object (`tool`, `canonical`, `repository`, etc.).
   - Increment `?v=N` cache-bust in `index.html`.
3. **Cross-Repo PR Generation:**
   - A GitHub Action automatically opens a Pull Request on each tool repository that has drifted.

---

## Local Development & Commands

```bash
# Check if any tool repo has drifted from core
npm run drift:check

# Regenerate assets across tool repos locally
npm run sync

# Regenerate assets and bump cache-bust ?v=N in index.html
npm run sync:bump

# Validate JavaScript syntax
npm test
```

---

## Security & Secrets

Cross-repo PR generation uses a fine-grained GitHub Personal Access Token (`FORGE_SYNC_PAT`) scoped exclusively to the 9 public tool repositories with `Contents: Read and write` and `Pull Requests: Read and write` permissions.

---

## License

AGPL-3.0-or-later + Section 7(b) attribution.
Copyright © 2026 Hallatec Technology Solutions LLC.
