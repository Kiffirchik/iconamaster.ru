# Final fix report — Windows bootstrap final review

Date: 2026-09-02
Baseline: `7af1734f10b36444b9568deb8488a79b4fb5dde2`

## Findings addressed

1. The portability gate now detects arbitrary drive-rooted paths, Windows profile/temp environment references, and Windows parent/sibling dependencies. Controls cover web URLs, version/prose text, runtime roots, repository-relative `./...` references, MTW server paths, and neutral placeholders. Git-tracked-only scanning and the tracked-symlink boundary are unchanged.
2. `npm test` now discovers the complete `tests/unit` directory through `scripts/run-unit-tests.mjs`; a behavioral package-contract test invokes the npm script with a name filter and proves the portability test executes. `npm run verify` continues to invoke `npm test` once.
3. Migration checks use the absolute fixture path only for internal file I/O. Public failures expose only `tests/fixtures/migration/editorial-cover-assets.json`, a controlled category, a concrete safe rerun command, and `docs/windows-setup.md`. Tests prohibit project-root, user-profile, fixture-absolute, executable, and raw error disclosure.
4. Core prerequisite failures now provide deterministic next commands for the winget-available, Microsoft App Installer, and post-install/new-shell branches.
5. Representative deployment and migration behavior runs under Windows PowerShell 5.1 and pwsh 7 when available; pwsh remains optional.
6. Independent FFmpeg identity tests lock case-sensitive `versionLine` matching and case-insensitive SHA-256 matching.

## TDD evidence

### RED

- Portability classes: focused test expected five findings but received none.
- npm integration: the behavioral npm invocation completed without the named portability test in its TAP output.
- False-positive control: the initial general drive detector incorrectly flagged `tel:` and CSS/regular-expression syntax; the control test reported two findings.
- Safe diagnostics: 13 focused setup assertions failed against the old generic prerequisite text and absolute migration fixture disclosure. Both Windows PowerShell 5.1 and pwsh 7 exposed the old fixture value.
- FFmpeg mutation checks:
  - weakening exact `versionLine` comparison to case-insensitive caused the case-only drift test to exit 75;
  - removing expected-hash normalization caused the mixed-case hash test to exit 77.

### GREEN

- Focused portability: 5 passed, 0 failed.
- npm package invocation contract: 1 selected test passed; unrelated test bodies were skipped by name filtering.
- Focused safe diagnostics and migration shell matrix: 13 passed, 0 failed.
- FFmpeg identity boundaries after restoring the exact implementation: 2 passed, 0 failed.
- Complete Windows setup suite: 33 passed, 0 failed, 0 skipped. pwsh 7.6.4 was available, so both optional-shell cases executed.

## Verification evidence

- `npm run check:portability`: passed with no findings.
- `npm run verify`: passed in 40.4 seconds on the final bounded run.
  - Windows setup: 33 passed.
  - Unit suite: 130 passed, including 5 portability tests.
  - Sites worker/package tests: 6 passed.
  - MTW package tests: 2 passed.
  - Total Node test-runner tests: 171 passed, 0 failed, 0 skipped.
  - Content integrity: 50 icons, 7 pages, 10 articles, 2 videos, 78 aliases, and 272 owned local assets verified.
  - Icon assets: 79 independently owned originals verified with streaming SHA-256.
  - Vite/Sites build: 56 modules transformed; Sites package prepared.
  - Vite/MTW build: 56 modules transformed; 247 approved deployment derivatives prepared.
- `git diff --check`: passed with exit 0; Git emitted only the repository's existing LF-to-CRLF checkout notices.

## Sandbox note

The sandboxed Node runner failed before test execution with `EPERM` while resolving the user-profile boundary. Every affected focused and full verification command was rerun unchanged outside the filesystem sandbox. No package installation, winget execution, production connection, push, deployment, publication, or Git configuration change occurred.

## Changed files

- `.superpowers/sdd/2026-09-01-iconamaster-windows-bootstrap/final-fix-report.md`
- `docs/windows-setup.md`
- `package.json`
- `scripts/lib/portability.mjs`
- `scripts/run-unit-tests.mjs`
- `setup.ps1`
- `tests/unit/portability.test.mjs`
- `tests/windows-setup.test.mjs`

## Residual concerns

- No functional residual concern is known.
- On hosts without pwsh 7, its two representative optional-mode cases skip with the shell name; Windows PowerShell 5.1 remains required and fully exercised.
- The existing symlink-boundary test used its Git symlink-mode fallback because this host did not permit creating a filesystem symlink; the tracked link was still proven unread by the scanner.
