# Repository instructions

## Preserve content semantics

- Treat notes as source-faithful documents. Preserve unrelated prose, formulas, images, examples, citations, and conclusions when changing presentation.
- Inspect the current file and dirty worktree before editing. Do not reset, overwrite, or mix unrelated user changes.
- Distinguish sourced facts, interpretation, and runtime validation explicitly.

## Choose the presentation layer

- Use Markdown for prose, definitions, lists, quotations, and precise comparison tables.
- Use Mermaid when nodes, arrows, sequences, state transitions, or simple topology carry the information.
- Use Vue components when grouping, semantic color, multi-region layout, interaction, or chart-library integration is part of the explanation.
- Do not add article-local `<style>` blocks or complex Raw HTML for layout. Put presentation code under `notes/.vuepress/components/` and keep Markdown invocation small.
- Keep `text` fences only when monospaced spatial layout is meaningful. Do not mechanically convert source code, pseudocode, or useful ASCII diagrams.
- Prefer shared `--diagram-*` semantic tokens over article-local decorative colors.

## Diagram components

- Put article-specific diagrams under `notes/.vuepress/components/diagrams/`.
- Register global components in `notes/.vuepress/client.ts`.
- Reuse shared tokens before creating generic primitives; add primitives only after repeated interfaces are demonstrated.
- Keep diagram markup semantic and accessible. Do not create headings that accidentally enter the article table of contents.
- Keep exact comparisons and citations in Markdown even when a component provides visual intuition.

## Validation

- Run `make check`, `pnpm run typecheck`, `pnpm test`, `pnpm run docs:build`, and `git diff --check` for site changes.
- For portable-export changes, run `pnpm run export:smoke`; it opens strict exports through `file://` in Chromium and verifies assets, formulas, charts, Vue interaction, Outline, network isolation, and responsive layout.
- Keep test-only notes and assets under `tests/fixtures/` so they do not enter the knowledge-base sidebar or production build.
- Inspect the rendered target page at desktop and mobile widths, including light and dark modes when semantic colors change.
- After validation, run `make clean` so generated output and VuePress caches are not left behind.
