<!-- Applies when references.backend.enabled is true in storyrail.config.json. Standards: .bob/rules/02-house-standards.md -->

# Following the reference application

When `references.backend.enabled` is `true`, add these steps to your work. Otherwise skip this file.

1. **Read the standards first:** `.bob/rules/02-house-standards.md`, backend part.
2. **Find the counterparts.** Before writing a class, find the closest equivalent in the reference app
   (`references.backend.path`, read-only): a controller for your controller, a service for your service, an exception
   handler, a mapper, a repository, and their tests. Use `rg`/search, e.g. `rg -l "@RestController" references/backend`.
3. **Mirror them:** same package placement, naming, annotations, error handling, logging and test structure. Copy the
   pattern, not the business code; never copy secrets, URLs or customer data from it.
4. **List the counterparts** in your completion summary: `your class → reference class it follows`. If you had to deviate
   (for example the contract requires something the reference app does differently), say where and why.
5. Never edit anything under `references/`. If the reference app itself looks wrong, mention it; don't "fix" it.

The rest of your brief (`01-brief.md`) still applies: tests, `mvn -B verify` green, report through the status script.
