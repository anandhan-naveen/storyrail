<!-- Applies when designSystem.enabled is true in storyrail.config.json. -->

# Design links

When `designSystem.enabled` is `true` and the frontend lane is in scope:

- Copy every Figma link from the issue (the "Design (Figma)" field of the story template, or links in the notes) into a
  `## Design` section of `spec.md`, placed after `## Acceptance criteria`. Name what each frame shows (screen, state).
- Map acceptance criteria to frames where you can (`AC2 → "Loan history – empty state"`).
- No Figma link and `designSystem.figmaRequired` is `true` → add it to `## Open questions`, so the orchestrator asks
  before the frontend developer starts.
