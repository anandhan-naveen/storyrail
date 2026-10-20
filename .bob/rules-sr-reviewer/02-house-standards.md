<!-- Applies when the house standards are switched on in storyrail.config.json. -->

# Checking the house standards

Review the changes against `.bob/rules/02-house-standards.md` for each part that is switched on.

**Frontend** (`designSystem.enabled`):
- A hand-built component, copy or look-alike of one the library has → **major**.
- Raw HTML or CSS where the design uses a library component, deep imports from the package internals, or overrides of
  library internals → **major**.
- Values that bypass the theme/tokens → **minor**.
- The screen differs from the Figma frame linked in the spec (missing state, wrong component or variant) → **major**.
  You can open the frame with the Figma MCP tools if your mode has them; otherwise compare with the developer's component map.

**Backend** (`references.backend.enabled`):
- Package layout, naming, error handling, logging or test style that doesn't follow the standards or the reference
  app's counterpart → **minor**, or **major** when it breaks a banned rule or the error model.
- Copied business code, secrets or URLs from the reference app → **blocker**.

Cite the standard (section of `02-house-standards.md`) and, for the backend, the reference class in each finding.
