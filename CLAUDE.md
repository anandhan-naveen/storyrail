# StoryRail project guide

StoryRail takes a user story or a bug (a GitHub issue in the squad backlog, written by the analyst) through a squad
of agents to a signed-off release. Start a run with `/storyrail <issue-number>`. The stage order and gates are in
[docs/storyrail/PIPELINE.md](docs/storyrail/PIPELINE.md); the agents are in `.claude/agents/sr-*.md`.

The product it currently builds is a **Library Catalog** (books: browse, search, filter, add, delete, loan toggle),
made of **two projects that live in their own repos and deploy separately**.

## Repositories

This repo is the **hub**: agents, dashboard and run reports. It contains no product code. The other repos are listed in
[`storyrail.config.json`](storyrail.config.json) (`node scripts/storyrail-workspace.mjs config` prints it):

| Role | Repo | Local path (from the hub root) | Deploys to |
|---|---|---|---|
| Backlog: stories and bugs only | `anandhan-naveen/squad-backlog` | – (read with `gh issue view <n> -R <backlog>`) | – |
| Frontend project | `anandhan-naveen/library-frontend` | `projects/frontend/` | GitHub Pages (QA) |
| Backend project, **owns the API contract** | `anandhan-naveen/library-backend` | `projects/backend/` | Render (QA) |

`projects/` is not part of the hub repo: `node scripts/storyrail-workspace.mjs sync` clones the projects there (or
updates them to `main`). Each project folder is its own git repo with its own branches, PRs and pipelines.

## Workspace map

| Path | What | Owner agent |
|---|---|---|
| `projects/frontend/src/` | React 18 + TypeScript (strict), Vite, React Router (HashRouter), Vitest + RTL | sr-fe-dev |
| `projects/frontend/tests/ui/` | Playwright UI automation: `chromium` project (mocked API via `page.route`) + `demo` project (demo build) | sr-ui-tests |
| `projects/frontend/contract/openapi.yaml` | Pinned copy of the backend's contract; the frontend CI fails if it differs from the backend's `main` | sr-req-fetch copies it |
| `projects/backend/src/` | Java 21, Spring Boot 3.5, Maven, Spring Data JPA, H2, Bean Validation, ProblemDetail errors | sr-be-dev |
| `projects/backend/docs/api/openapi.yaml` | API contract, **single source of truth** for FE, BE and API tests | sr-req-fetch proposes, devs implement |
| `projects/backend/tests/api/` | Playwright API tests against a running backend (`API_BASE_URL`) | sr-api-tests |
| `projects/*/.github/workflows/` | Each project's `ci-cd.yml` (build, test, deploy to QA, smoke) and `security.yml` (CI only — agents don't edit these unless the story is about CI) | — |
| `runs/issue-<N>/` | Everything one run produces: spec, review and scan reports, fixer responses, QA log | all |
| `tests/manual/` | Manual QA records of the first run | sr-manual-qa |
| `docs/history/run-1/` | Archive of the first, hand-orchestrated run (old briefs and reviews, old monorepo paths) — read-only reference | — |

## Commands (all must pass before a stage is done)

```bash
# frontend project
(cd projects/frontend && npm ci && npm run lint && npm run typecheck && npm run test:coverage && npm run build && npm audit --audit-level=high)
# backend project (needs Java 21 + Maven 3.9)
(cd projects/backend && mvn -B verify)          # unit tests, JaCoCo ≥ 80 %, SpotBugs, PMD, Checkstyle (warnings)
(cd projects/backend && mvn spring-boot:run)    # http://localhost:8080, H2 seeded
# UI automation (builds the app itself; needs the frontend's own deps installed)
(cd projects/frontend/tests/ui && npm ci && npm run lint && npm run typecheck && npx playwright test)
# API automation (backend must be running on :8080)
(cd projects/backend/tests/api && npm ci && npm run lint && npm run typecheck && API_BASE_URL=http://localhost:8080 npx playwright test)
```

First time on a machine: `node scripts/storyrail-workspace.mjs sync`, then `(cd projects/frontend/tests/ui && npx playwright install chromium)`.

## Conventions every agent follows

- **Stay in your lane.** Each agent writes only to the paths its brief allows. Report problems outside your lane instead of fixing them.
- **Two repos, one story.** A story can touch both projects. Each touched project gets its own branch and its own PR; they reference the same backlog issue.
- **Contract first.** API changes go into `projects/backend/docs/api/openapi.yaml` before code, and the same file is copied to `projects/frontend/contract/openapi.yaml`. Field names, status codes and problem titles must match it exactly. The backend PR merges before the frontend PR.
- **Errors** are RFC 7807 `application/problem+json`; 400s carry `errors: { field: message }`. Never leak stack traces or class names.
- **Frontend:** no `any`, no `dangerouslySetInnerHTML`, no browser dialogs (`alert/confirm/prompt`). Accessible names and roles first; `data-testid` as the fallback hook for tests. Keyboard focus must never land on `<body>` after an action. Respect `prefers-reduced-motion`.
- **Backend:** Java records for DTOs, constructor injection only, no Lombok. Inject `java.time.Clock` for anything time-based. Tests: JUnit 5, Mockito, `@WebMvcTest`, `@DataJpaTest`.
- **Tests are tagged with the acceptance criterion they prove**, e.g. `@AC3` in the title, so every AC is traceable.
- **Every bug fix gets a regression test** that fails on the old code.
- **Lint is zero-warning** (ESLint + `eslint-plugin-sonarjs`), TypeScript strict, `npm audit` high = 0.
- **No secrets** in code, tests or logs.

## Reporting progress (every agent)

Report to the live dashboard with the status script (never edit `.storyrail/` by hand):

```bash
node scripts/storyrail-status.mjs set <station> running 30 "short note (≤ 60 chars)"
node scripts/storyrail-status.mjs log <station> ok "one-line result"
node scripts/storyrail-status.mjs set <station> done 100 "headline result, e.g. 24 tests · 96% cov"
```

**Run every command from the hub root.** The Bash working directory persists between calls, so use subshells for other folders, e.g. `(cd projects/frontend && npm run lint)`, never a bare `cd`. Git commands for a project run the same way: `(cd projects/backend && git status)`.

Use your own station id only (given in your agent file). Report at 3–5 milestones, not on every step.
Statuses: `pending running done failed skipped waiting`. Log levels: `ok warn bad info`.
