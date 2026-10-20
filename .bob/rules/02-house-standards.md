<!-- House standards, loaded in every StoryRail mode. Fill in the TODO(office) parts, then set
     designSystem.enabled / references.backend.enabled to true in storyrail.config.json.
     `node scripts/storyrail-workspace.mjs todo` lists what is still open. -->

# House standards

These apply **only when they are switched on** in `storyrail.config.json`:
`designSystem.enabled` for the frontend part, `references.backend.enabled` for the backend part.
When a part is off, ignore it and follow the project guide alone.

## Frontend: the company design system

- Screens are built from the component library `designSystem.package` (TODO(office): name it here too, e.g. `@your-org/ui-components`).
  Its documentation is the Storybook at `designSystem.storybookUrl`.
- **Never hand-build a component the library already has** (buttons, inputs, selects, tables, dialogs, toasts, layout).
  No copies, no look-alikes, no restyling through CSS overrides of library internals.
- Use components through their public props only, as their Storybook stories show. No deep imports from the package's
  internal folders.
- Styling: TODO(office): the library's tokens/theme mechanism (e.g. "spacing and colours only through the theme tokens; no hex values in app code").
- Accessibility comes from the library components; don't remove or override their roles and labels.
- If no component fits a need in the design, **don't invent one**: report it (component missing, what it should do) so the
  squad can ask the design-system team.

## Backend: coding standards

The reference application at `references.backend.path` (read-only, never edit it) shows how the company writes services.
New code must look like it belongs there. TODO(office): replace or extend this list with your real standards.

- **Package layout:** TODO(office): e.g. `controller / service / repository / mapper / dto / exception / config` per feature.
- **Naming:** TODO(office): e.g. `*Controller`, `*Service` + `*ServiceImpl`?, `*Repository`, `*Mapper`, DTO suffixes.
- **Mapping:** TODO(office): e.g. MapStruct mappers, never manual mapping in controllers.
- **Errors:** TODO(office): the company error model and exception handler (compare with the contract's problem format).
- **Logging:** TODO(office): logger, levels, what must never be logged (personal data, tokens).
- **Transactions and persistence:** TODO(office): where `@Transactional` goes, query style.
- **Tests:** TODO(office): test naming, given/when/then, which slices, test data builders.
- **Anything banned:** TODO(office): e.g. field injection, `System.out`, wildcard imports.

When the reference app and this list disagree, this list wins. When the reference app and the project guide disagree,
the reference app wins for code style, and the contract always wins for API behaviour.
