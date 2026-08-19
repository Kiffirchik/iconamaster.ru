# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Iconamaster prototype constraints

- The approved dark museum mock controls layout and visual hierarchy, not icon content.
- Icon files are immutable originals. Do not use ImageGen, pixel editing, generative fill, or handcrafted replacements on them.
- Preview crops may remove only incidental photographic background; full images always use `object-fit: contain`.
- WhatsApp is primary; phone and email remain visible alternatives.
- This project is local-only until the user separately authorizes publishing.
