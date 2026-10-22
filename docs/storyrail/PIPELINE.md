# StoryRail pipeline: order of agents and gates

**Before StoryRail (people).** The product owner gets the requirement from the business. The functional analyst refines
it with the stakeholders, writes the **Screen document** (frontend) and the **API document** (backend), attaches them to
the user story in GitLab and explains it at the 3 amigos meeting.

**StoryRail (agents)** starts from that GitLab issue (`/storyrail 51` for a story, `/storyrail fix 60` for a bug) and
stops when the merged code's **GitLab CI pipeline on the default branch is green**.

**After StoryRail (people).** The team deploys to QA with CDD. The testers run their prepared test cases, their E2E UI and
API automation against QA and their manual tests, and log defects as GitLab bugs (which come back through the defect
loop). The functional analyst and the product owner review the result at the end of the sprint and sign off.

| # | Stage | Agent / step | Runs against | Gate to the next stage |
|---|---|---|---|---|
| 1 | Requirement analysis | **Sindhu** (`sr-req-fetch`): reads the GitLab story and the attached Screen and API documents, decides the lanes, makes every AC testable, writes the API contract from the API document | GitLab issue + documents | No open questions: anything unclear is asked in the Bob chat and the answers are posted on the issue |
| 2 | Build | **Frontend dev** (`sr-fe-dev`) ∥ **Backend dev** (`sr-be-dev`), each with unit tests, on a story branch in its own repo. Only the lanes the story needs; the other developer stays idle | local clones | Unit tests + coverage green, lint clean |
| 3 | Isolated tests | **Isolated UI automation** (`sr-ui-tests`, frontend) ∥ **API automation** (`sr-api-tests`, backend, against the backend running locally) | localhost | All AC-tagged tests green |
| 4 | Review + scans | **Tech lead review** (`sr-reviewer`, read-only) ∥ **Quality scans** (`sr-scan`): **Sonar, Fortify, NexusIQ** (each locally or through the branch pipeline, as configured) plus quick checks (lint, secrets, contract copies) | local clones (or the pushed branch) | Both reports collected |
| 5 | Fix | **The developers** fix the findings of their own lane: frontend dev ∥ backend dev, minors included, with regression tests | local clones | Every finding fixed, disputed with evidence, or raised for a decision |
| 6 | Re-check | Back to 4: the tech lead checks the fixes, the scans run on the fixed code. Max 2 fix rounds | | **Quality gate:** review APPROVE (0 blocker/major) **and** Sonar quality gate passed **and** Fortify without critical/high **and** NexusIQ without Critical/Severe violations **and** quick checks clean |
| 7 | Release: merge + CI | One merge request per touched repo (same branch name everywhere); its pipeline runs. **You approve the merge** in the Bob chat. Merge order: backend, API tests, frontend; after each merge StoryRail follows the CI pipeline on the default branch | GitLab CI | Every default-branch pipeline green → the story is commented and labelled "Ready for QA" |

## Terms

- **∥ (side by side).** The two agents of a stage don't depend on each other, so in IBM Bob they run **at the same time as two subagents**. A subagent doesn't get its mode's file limits, so a lane check (`scripts/storyrail-lanes.mjs`) runs before and after: any file changed outside the agents' lanes fails the stage.
- **Lanes = repos.** The frontend lane works in the frontend repo; the backend lane in the backend repo **and** the API tests repo. Each repo gets its own branch (same name in every repo) and merge request; all of them point at the same GitLab issue.
- **Local vs CI scans.** `local`: the scanner runs on your machine before anything is pushed (sonar-scanner or the Maven plugin against your SonarQube, Fortify SCA or the ScanCentral client, the NexusIQ CLI); fastest feedback. `ci`: the run branch is pushed (not merged) and the branch pipeline's scan job runs; StoryRail reads the result. Set per scanner in `storyrail.config.json` → `scans`.
- **Why CI is the end.** CDD deployments can't be followed from StoryRail, so a run ends when the merged code builds and passes its pipeline. Everything after that is visible on the dashboard as "outside StoryRail".
- **Contract.** The backend repo owns `docs/api/openapi.yaml`, written from the API document. The frontend and API tests repos keep pinned copies. That's why the backend merges first.
- **Human gates.** You pick the issue, answer the clarifying questions and approve the merge. Everything between is the agents' job.

## Defect loop (`/storyrail fix <bug issues>`)

For bugs the testers log in GitLab after testing in QA. Same rail, only the affected lane.

1. **Requirement analysis** reads the bug and turns its expected behaviour into ACs (`BUG-<n>`).
2. The developer of the affected lane fixes it.
3. That lane's test agent adds a **regression test that fails on the old code** (tag `@BUG-<n>`).
4. Review + scans on that lane's diff, fixes by the developer, re-check (max 2 rounds).
5. Merge request (`Fixes #<bug>`), your OK, merge, CI on the default branch green.
6. The bug is commented "ready for re-test in QA" and labelled; the testers re-test it after the CDD deployment.

## Where things are

| What | Where |
|---|---|
| `/storyrail` command | `.bob/commands/storyrail.md` |
| Orchestrator brief | `.bob/rules-sr-orchestrator/01-orchestrator.md` |
| Agents (IBM Bob custom modes, with edit limits) | `.bob/custom_modes.yaml` |
| Each agent's brief | `.bob/rules-sr-*/01-brief.md` |
| Project conventions every mode follows | `.bob/rules/01-project-guide.md` |
| GitLab, projects, scans, squad | `storyrail.config.json` |
| GitLab from the agents | `node scripts/storyrail-gitlab.mjs` (token) or the GitLab MCP server |
| Local clones of the projects | `projects/*` (`node scripts/storyrail-workspace.mjs sync`) |
| Output of one run | `runs/issue-<N>/` |
| Live dashboard | `node scripts/storyrail-dashboard.mjs` → http://localhost:4800 |
| Setup on a new machine | [SETUP.md](SETUP.md) |
