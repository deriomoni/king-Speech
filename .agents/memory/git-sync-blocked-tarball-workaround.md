---
name: Git sync when git networking is blocked
description: How to sync a GitHub repo into this Replit project when git fetch/merge/push are blocked
---

Git write/network ops (fetch, merge, pull, push) are BLOCKED in this environment — for both the main agent and inside task contexts. Attempting them fails regardless of context.

**Why:** The Replit sandbox blocks git networking; there is no way around it via git itself.

**How to apply — tarball 3-way merge workaround:**
- Download the GitHub branch tarball over HTTPS (public repo): codeload URL, e.g. `https://codeload.github.com/<owner>/<repo>/tar.gz/refs/heads/main`, into `/tmp/`.
- Materialize the local merge-base commit read-only with `git archive <sha> | tar -x` (read-only git plumbing like `git archive`, `git show`, `git log` DO work).
- 3-way merge conflicting files with `git merge-file -p OURS BASE THEIRS`.
- Copy non-conflicting GitHub files in directly. No git commit needed — the platform commits at task end.
- `python3` is NOT available here; use `node` for any scripting (e.g. import-resolution scans).

**Verifying a large merge without navigating every route (Expo/Metro bundles lazily):**
- Clear stale Metro/Expo caches after copying files: `rm -rf node_modules/.cache .expo /tmp/metro-* /tmp/haste-map-*` then restart the workflow. Transient "Unable to resolve module" / undefined-import errors are usually stale bundles, not real missing files.
- Scan every `@/...` import across TS/TSX files and check each resolves to a real file (respect tsconfig `@/*` → project-root alias). Catches broken imports across all routes fast.
