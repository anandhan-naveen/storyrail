# StoryRail project guide

StoryRail takes a user story or a bug from GitLab through a squad of AI agents, from the moment its functional
documents are ready to a green CI pipeline on the default branch. Start a run with `/storyrail <issue-number>`. The
stage order and gates are in [docs/storyrail/PIPELINE.md](../../docs/storyrail/PIPELINE.md); the agents are Bob custom
modes in `.bob/custom_modes.yaml`, and each mode's brief is in `.bob/rules-<mode-slug>/`.

**How the squad works around it.** The product owner gets the requirement from the business; the functional analyst
writes the **Screen document** (frontend) and the **API document** (backend) and attaches them to the user story in
GitLab, then explains it at the 3 amigos meeting. StoryRail takes over from there: requirement analysis, build,
isolated tests, review and quality scans, fixes, merge and CI. Deploying to QA with CDD, the testers' work in QA
(test cases, E2E automation, manual testing) and the sign-off at the sprint review stay with the team.

## Repositories

This repo is the **hub**: agents, dashboard and run records. It contains no product code. Everything lives on your
GitLab, as listed in [`storyrail.config.json`](../../storyrail.config.json) (`node scripts/storyrail-workspace.mjs config` prints it):

| Role | Config key | Local path (from the hub root) |
|---|---|---|
| Backlog: user stories and bugs, with the functional documents attached | `backlog.project` | – (read with `node scripts/storyrail-gitlab.mjs issue <n>`) |
| Frontend project | `projects.frontend` | `projects/frontend/` |
| Backend project, **owns the API contract** | `projects.backend` | `projects/backend/` |
| API acceptance tests (Cucumber + Java) for the backend | `projects.apiTests` | `projects/api-tests/` |

`projects/` is not part of the hub repo: `node scripts/storyrail-workspace.mjs sync` clones the projects there (or
updates them to their default branch). Each project folder is its own git repo with its own branches, merge requests
and GitLab CI pipeline.

**GitLab access.** Through `node scripts/storyrail-gitlab.mjs` with a personal access token in the variable named by
`gitlab.tokenEnv` (default `GITLAB_TOKEN`), or through the GitLab MCP server when it is configured in Bob (reads only;
writes always go through the script). Never print the token or write it to a file.

## Workspace map

| Path | What | Owner mode |
|---|---|---|
| `projects/frontend/src/` | React 18 + TypeScript (strict), Vite, React Router (HashRouter), Vitest + RTL | sr-fe-dev |
| `projects/frontend/tests/ui/` | Playwright UI automation: `chromium` project (mocked API via `page.route`) | sr-ui-tests |
| `projects/frontend/contract/openapi.yaml` | Pinned copy of the backend's contract | sr-req-fetch copies it |
| `projects/backend/src/` | Java 21, Spring Boot 3.5, Maven, Spring Data JPA, H2, Bean Validation, ProblemDetail errors | sr-be-dev |
| `projects/backend/docs/api/openapi.yaml` | API contract, **single source of truth** for FE, BE and API tests, written from the API document | sr-req-fetch writes, devs implement |
| `projects/api-tests/src/test/resources/features/` | Cucumber scenarios (Gherkin), tagged per AC (`@BE-AC3`) | sr-api-tests |
| `projects/api-tests/src/test/java/` | Step definitions (RestAssured), contract validation, test data | sr-api-tests |
| `projects/api-tests/contract/openapi.yaml` | Pinned copy of the backend's contract | sr-req-fetch copies it |
| `projects/*/.gitlab-ci.yml` | Each project's GitLab CI (agents don't edit it unless the story is about CI) | — |
| `runs/issue-<N>/docs/` | The Screen and API documents of the story, downloaded from GitLab | sr-req-fetch |
| `runs/issue-<N>/` | Everything one run produces: spec, review and scan reports, fix responses, release record | all |

## Commands (all must pass before a stage is done)

```bash
# frontend project
(cd projects/frontend && npm ci && npm run lint && npm run typecheck && npm run test:coverage && npm run build && npm audit --audit-level=high)
# backend project (needs Java 21 + Maven 3.9)
(cd projects/backend && mvn -B verify)          # unit tests, JaCoCo ≥ 80 %, SpotBugs, PMD, Checkstyle (warnings)
(cd projects/backend && mvn spring-boot:run)    # http://localhost:8080, H2 seeded
# UI automation (builds the app itself; needs the frontend's own deps installed)
(cd projects/frontend/tests/ui && npm ci && npm run lint && npm run typecheck && npx playwright test)
# API acceptance tests, Cucumber + Java (backend must be running on :8080)
(cd projects/api-tests && mvn -B verify)                                    # all scenarios, against http://localhost:8080
(cd projects/api-tests && mvn -B verify -Dcucumber.filter.tags="@BE-AC3")   # one acceptance criterion
```

First time on a machine: `node scripts/storyrail-workspace.mjs sync`, then `(cd projects/frontend/tests/ui && npx playwright install chromium)`.

## Conventions every agent follows

- **Leave work notes.** Every agent that changes files writes `runs/issue-<N>/notes/<station>.md` before it replies (see its brief); the dashboard chat answers from them.
- **Stay in your lane.** Each agent writes only to the paths its brief allows. Report problems outside your lane instead of fixing them.
- **Several repos, one story.** A story can touch the frontend, the backend and the API tests. Each touched repo gets a branch with the **same name** and its own merge request; they reference the same GitLab issue. The backend lane always includes the API tests repo.
- **Documents first.** Build what the Screen and API documents in `runs/issue-<N>/docs/` say. When the code and a document disagree, the document wins; when a document is unclear, ask, don't guess.
- **Contract first.** API changes go into `projects/backend/docs/api/openapi.yaml` before code, and the same file is copied to `projects/frontend/contract/openapi.yaml` and `projects/api-tests/contract/openapi.yaml`. Field names, status codes and problem titles must match it exactly. Merge order: backend, then API tests, then frontend.
- **Errors** are RFC 7807 `application/problem+json`; 400s carry `errors: { field: message }`. Never leak stack traces or class names.
- **Frontend:** no `any`, no `dangerouslySetInnerHTML`, no browser dialogs (`alert/confirm/prompt`). Accessible names and roles first; `data-testid` as the fallback hook for tests. Keyboard focus must never land on `<body>` after an action. Respect `prefers-reduced-motion`.
- **API tests:** Gherkin that the analyst can read; one scenario per behaviour; values in tables are JSON literals; fresh data through `${…}` placeholders; every scenario cleans up after itself, so the testers can reuse it against QA. Java steps use constructor injection (PicoContainer) and compile with zero warnings.
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

**Run every command from the hub root.** Use subshells for other folders, e.g. `(cd projects/frontend && npm run lint)`, never a bare `cd`. Git commands for a project run the same way: `(cd projects/backend && git status)`.

Use your own station id only (given in your mode's brief). Report at 3–5 milestones, not on every step.
Statuses: `pending running done failed skipped waiting`. Log levels: `ok warn bad info`.
