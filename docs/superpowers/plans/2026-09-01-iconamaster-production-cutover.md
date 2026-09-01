# Iconamaster Production Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish the verified premium prototype at `https://iconamaster.ru` while preserving a complete, immediately restorable copy of the current production site.

**Architecture:** Build the existing Vite SPA into static files, add an Apache fallback for client-side routes, and transfer one release archive to MTW over SSH. Prepare a sibling release directory, copy the legacy Corona administration dependencies into it, then atomically rename directories so rollback is a reverse rename rather than a fresh upload.

**Tech Stack:** React, Vite, Apache `.htaccess`, OpenSSH/SCP, POSIX shell on MTW.

**Spec:** `docs/superpowers/specs/2026-08-19-iconamaster-premium-prototype-design.md`

## Global Constraints

- Do not modify `https://iconamaster.cargo.site/`.
- Preserve the complete current MTW document root as a sibling rollback directory.
- Preserve `/corona`, `/config.php`, `/uploads`, and `/captcha` in the new document root.
- Never print, copy into source control, or embed MTW or Corona credentials.
- Use an atomic directory rename for cutover and reverse rename for rollback.
- Do not remove the rollback directory until the user explicitly authorizes cleanup.

---

### Task 1: Production routing contract

**Files:**
- Create: `public/.htaccess`
- Create: `tests/mtw-deployment.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: Vite's existing `public/` copy behavior.
- Produces: Apache routing that serves real files/directories unchanged and sends other HTML routes to `/index.html`.

- [ ] Write a failing Node test that requires `public/.htaccess`, `RewriteEngine On`, two existing-path guards, and the `/index.html` fallback.
- [ ] Run `node --test tests/mtw-deployment.test.mjs` and confirm it fails because `public/.htaccess` is absent.
- [ ] Add the minimal `.htaccess` rules and the `test:mtw` package script.
- [ ] Run `npm run test:mtw` and confirm it passes.

### Task 2: Freeze and verify the release

**Files:**
- Modify only generated `dist/` output.

**Interfaces:**
- Consumes: committed release source.
- Produces: `dist/client/index.html`, assets, content JSON, and `.htaccess` for MTW.

- [ ] Run the complete `npm run verify` gate.
- [ ] Confirm `dist/client/.htaccess`, the two new Dzen articles, 14 Dzen images, and the Corona-preservation exclusions are present.
- [ ] Commit the routing contract and record the exact release commit.

### Task 3: Create rollback artifacts

**Files:**
- Create locally: `backups/production-cutover-<timestamp>/manifest.txt`.
- Create remotely: `iconamaster.ru.rollback-<timestamp>.tar.gz` and later `iconamaster.ru.rollback-<timestamp>/`.

**Interfaces:**
- Consumes: current MTW `iconamaster.ru/` tree.
- Produces: a compressed backup verified with `tar -tzf` and an untouched sibling rollback directory after cutover.

- [ ] Record the current root size, file count, and SHA-256 of key files.
- [ ] Create a server-side compressed archive without following external links.
- [ ] Verify the archive can be listed and contains `iconamaster.ru/index.html` or `iconamaster.ru/index.php`, `corona/admin/index.php`, `config.php`, and `uploads/`.

### Task 4: Prepare the new document root

**Files:**
- Upload: one `iconamaster-release-<timestamp>.tar.gz` archive.
- Create remotely: `iconamaster.ru.new-<timestamp>/`.

**Interfaces:**
- Consumes: verified `dist/client/` output and current Corona service files.
- Produces: a complete candidate document root beside production.

- [ ] Package `dist/client/` with its dotfiles and compute SHA-256 locally.
- [ ] Upload the archive over SCP and verify the remote SHA-256 matches.
- [ ] Extract into the new sibling directory.
- [ ] Copy `corona/`, `config.php`, `uploads/`, and `captcha/` from current production into the candidate.
- [ ] Verify candidate permissions, index, routing file, content JSON, assets, and Corona entry point.

### Task 5: Atomic cutover and smoke test

**Files:**
- Rename remotely: `iconamaster.ru` to `iconamaster.ru.rollback-<timestamp>`.
- Rename remotely: `iconamaster.ru.new-<timestamp>` to `iconamaster.ru`.

**Interfaces:**
- Consumes: verified candidate and rollback archive.
- Produces: the premium prototype at the production domain.

- [ ] Perform both renames in one fail-fast SSH command, automatically reversing the first rename if the second fails.
- [ ] Verify HTTPS status and content for `/`, `/collection`, two article routes, two icon routes, `/contacts`, and `/corona/admin/index.php`.
- [ ] Verify CSS, JavaScript, representative icon images, and Dzen images return successful responses.

### Task 6: Rollback readiness record

**Files:**
- Create: `docs/releases/2026-09-01-iconamaster-production.md`.

**Interfaces:**
- Consumes: final remote directory names and verification evidence.
- Produces: a credential-free rollback record.

- [ ] Record the release commit, backup archive name, rollback directory name, and verification results.
- [ ] Record the reverse-rename rollback procedure and the requirement to preserve the current failed/new directory during rollback.
- [ ] Do not delete the rollback directory or backup archive.
