<!-- Applies when the house standards are switched on in storyrail.config.json. -->

# House standards while fixing

Your fixes must follow `.bob/rules/02-house-standards.md` like new code does: library components only on the frontend
(when `designSystem.enabled`), the reference app's patterns on the backend (when `references.backend.enabled`; read-only
under `references/`). A finding about the standards is fixed by moving to the library component or the reference
pattern, not by suppressing it.
