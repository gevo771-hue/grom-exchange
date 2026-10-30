# GROM working agreements

Optimize unnecessary work, not correctness, design quality, functionality, or security. These rules do not change model settings or guarantee a particular token saving.

## Context and continuity

- Before resuming, check the latest user requirements, Git status and relevant recent changes; do not repeat completed work or overwrite uncommitted changes.
- Read only the files and dependencies needed for the task. Start with scoped `rg` searches; widen the search only when evidence requires it.
- Reuse known, unchanged context. Do not repeatedly open whole files or dump large logs; inspect the relevant sections and errors.
- Exclude `node_modules`, `dist`, `build`, `.next`, logs and generated data from routine searches unless the task needs them.
- Batch independent reads and checks where useful. Avoid redundant tool calls and frequent polling of unchanged status.

## Changes

- Make the smallest complete fix to the cause. Reuse existing components, functions, styles and architecture.
- Preserve working behavior and design unless the user requests a change. Avoid unrelated files, speculative features, unnecessary rewrites, refactors and dependencies.
- Investigate relevant interactions fully when a task is complex; do not stop at a superficial patch to save tokens.

## Verification and safety

- Choose checks appropriate to the changed behavior and its risk. Run required repository and CI checks; do not repeat passing checks without changed code, new evidence or an unresolved concern.
- Add regression tests for meaningful failure modes, not tests that merely mirror trivial CSS or text changes.
- For UI changes, inspect affected pages on mobile and desktop, including alignment, overflow, controls and navigation. Before an authorized deployment, verify the build and then the published result.
- For swaps, trading, wallet sessions, balances, prices and permissions, retain necessary correctness, regression and security checks. Never weaken safeguards to save time or tokens.
- Never sign or submit financial operations for the user. Treat project-mirror `sources/` as read-only; do not restore old recovery copies.

## Communication

- Give concise, relevant updates and a short final report: what changed, what was verified and any material limitation. Distinguish local completion from publication.
- Do not create extra reports, screenshots, plans or documentation unless requested or needed for review, verification or continuity. Update an existing relevant record instead of duplicating it.
- Apply these agreements within the authorized task; do not change model settings or create new chats automatically.
