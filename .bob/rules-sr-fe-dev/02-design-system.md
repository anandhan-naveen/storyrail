<!-- Applies when designSystem.enabled is true in storyrail.config.json. Standards: .bob/rules/02-house-standards.md -->

# Building screens from the design system

When `designSystem.enabled` is `true`, add these steps to your work. Otherwise skip this file.

1. **Read the design.** The spec's `## Design` section holds the Figma link(s) for this story. Open each frame with the
   Figma MCP server (`designSystem.figmaMcpServer`, configured in `.bob/mcp.json`): get the frame's structure, the
   components it uses, texts and states. If the spec has no Figma link and `designSystem.figmaRequired` is true, stop and
   report it instead of guessing a layout.
2. **Map every element to a library component.** For each element in the frame, find the matching component of
   `designSystem.package` and its story in Storybook (through the Storybook MCP server if `designSystem.storybookMcpServer`
   is set, otherwise from the package's `*.stories.*` files under `projects/frontend/node_modules/<package>`).
   Note the props and variants the design uses.
3. **Write a component map** at the top of your completion summary: `design element → library component (props/variant)`.
   Anything without a match goes under "Missing components" with what it should do; don't build a substitute.
4. **Implement with library components only**, following `.bob/rules/02-house-standards.md`. Generated code from Figma
   is a starting point: replace any raw markup it produces with the library components from your map.
5. Test ids: use the library's own test hooks if it has them; otherwise pass `data-testid` through the component's props.

The rest of your brief (`01-brief.md`) still applies: unit tests, every gate green, report through the status script.
