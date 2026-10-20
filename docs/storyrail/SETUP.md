# Run StoryRail with IBM Bob (macOS)

StoryRail runs inside **IBM Bob**. Each agent is a Bob **custom mode** that ships with this repo, and you start each run
yourself with `/storyrail <issue number>` in the Bob chat.

## What's in `.bob/`

| File | What it does |
|---|---|
| `.bob/custom_modes.yaml` | The 10 StoryRail modes (orchestrator + 9 agents). Each mode may only **edit** its own folders (`fileRegex`), e.g. the frontend dev only `projects/frontend/` app code, so "stay in your lane" is enforced, not just asked. The reviewer has no edit rights at all. |
| `scripts/storyrail-lanes.mjs` | The same lanes as a check for the parallel stages, which run as subagents: `lanes` lists them, `check <agents>` fails on any file changed outside them. |
| `.bob/rules/01-project-guide.md` | Project conventions, loaded in every mode. |
| `.bob/rules-<mode>/01-brief.md` | The full brief of one mode (what to do, gates, what to report). |
| `.bob/commands/storyrail.md` | The `/storyrail` command: switches to the orchestrator mode and passes your arguments. |
| `.bobignore` | Files Bob must never read (`.env`, keys). |

## 1. One-time setup

### Tools

```bash
# Homebrew (skip if you have it): https://brew.sh
brew install git gh node@22 maven
brew install --cask temurin@21              # Java 21 (asks for your Mac password: it runs an installer)
brew install semgrep gitleaks osv-scanner   # optional: used by the local quality scan if present

# node@22 and Java 21 are not on your PATH by default; add them once:
echo 'export PATH="$(brew --prefix node@22)/bin:$PATH"' >> ~/.zprofile
echo 'export JAVA_HOME=$(/usr/libexec/java_home -v 21)' >> ~/.zprofile
source ~/.zprofile
```

Check: `node -v` shows 22.x, `java -version` shows 21, and `mvn -v` shows Maven 3.9+ **with Java version 21**, plus `gh --version`.

### Git identity (once per Mac)

```bash
git config --global user.name "Your Name"
git config --global user.email "you@example.com"
```

### GitHub CLI login

```bash
gh auth login        # GitHub.com → HTTPS → log in with a browser
```

### The repos

Clone only the hub; it clones the two projects into `projects/` itself.

```bash
git clone https://github.com/storyrail-squad/storyrail.git
cd storyrail
git switch bob
node scripts/storyrail-workspace.mjs sync      # clones library-frontend, library-backend and library-api-tests into projects/
(cd projects/frontend && npm ci) && (cd projects/frontend/tests/ui && npm ci && npx playwright install chromium)
(cd projects/api-tests && mvn -B -q test-compile)   # downloads the Cucumber/RestAssured dependencies once
```

The repo names and QA URL live in `storyrail.config.json`. To use your GitLab projects at the office, change them there.

### IBM Bob

1. Install and sign in to IBM Bob (IDE) the way your organisation provides it.
2. **File → Open Folder… →** the `storyrail` folder (the hub root, not a subfolder and not a project in `projects/`).
3. Open the mode selector in the chat. You should see the ten **StoryRail · …** modes. If not, open
   Settings → Modes → *Edit Project Modes*: it should show `.bob/custom_modes.yaml`. A YAML error there hides all of them.
4. Type `/` in the chat: **`/storyrail`** should be in the list.

### Permissions (Permissions button, next to the mode selector)

StoryRail runs many small steps, so approve the routine ones and keep the risky ones manual:

| Action | Setting | Why |
|---|---|---|
| Read | auto-approve | Reading code and specs |
| Edit | auto-approve | Each mode can only edit its own folders anyway |
| Todo | auto-approve | Progress list |
| Subtask | auto-approve | The orchestrator hands each stage to its mode |
| Mode | auto-approve | `/storyrail` switches to the orchestrator mode |
| Subagent | auto-approve | Runs the parallel stages (FE ∥ BE, UI ∥ API, reviewer ∥ scan); the lane check guards them |
| Execute | **ask** at first | Look at what it runs during your first story; auto-approve once you trust it |

Whatever you allow, the orchestrator still **stops and asks you** before merging, at sign-off and when requirements are
unclear. Never approve `git push --force`, `git reset --hard` or anything that deletes outside the repo.

## 2. Each story

Run **one story or bug at a time**: the dashboard and your working folder follow a single run.

1. **Your analyst writes the story** as an issue in the backlog repo ([squad-backlog](https://github.com/storyrail-squad/squad-backlog)) with the *User story* template: the story, numbered acceptance
   criteria, and tick **Frontend** and/or **Backend**. StoryRail never writes or changes requirements.
2. Start the dashboard in a terminal and leave it open: `node scripts/storyrail-dashboard.mjs`, then open
   **http://localhost:4800**. Keep it on a second screen during a demo.
3. In Bob's chat, give it the issue number:

   ```
   /storyrail 46
   ```

   Several issues that belong together: `/storyrail 46 47`.
4. Answer when it stops at a gate:
   - questions about unclear acceptance criteria,
   - **"PRs are green: backend #X, API tests #Z, frontend #Y. Merge and deploy to QA?"** (one PR per repo the story touches; backend first, then API tests, then frontend),
   - which QA defects to fix now,
   - **sign-off**.
5. Bugs found later: the analyst uses the **Bug** template (steps, expected, actual), then `/storyrail fix 50 51`.
6. Where is a run? `/storyrail status`.

Everything a run produces (spec, review and scan reports, QA log and screenshots) is committed in the hub under `runs/issue-<N>/`. The code goes to the project repos.

## The dashboard: squad and chat

The dashboard opens on the **Orchestration** view: Naveen, the squad lead, in the centre and the squad around him in
the order a story moves, with Laurence (product owner) at the top. The spoke to whoever is working lights up, a waiting
hand-off glows amber, and when Naveen sends Sandrine's fixes back for a re-check, Priya and Subramanian get a
"Round 2" tag. The line above the diagram says what each active member is doing, one line per member.

The **Squad** tab shows every agent as a squad member with a name and a role (Sindhu the business analyst, Varunesh and
Meysam the developers, Priya the strict reviewer, Charlotte the release engineer, …), with whoever is working shown large
at the top. The **Flow** tab has the rail diagram.

The theme switch in the top-right corner (screen, sun and moon icons for Auto, Light and Dark) sets the colour theme. Auto follows your system setting; Light or Dark
overrides it and is remembered in that browser.

**Rename the squad** in `storyrail.config.json` → `squad.members` (name, role, a one-line "about"). Restart the
dashboard server to pick it up.

### Ask a squad member

Select a member to see their work as a timeline (status updates, reports they wrote) and ask them about it, e.g.
"Which acceptance criteria have you covered?" or "Why did you flag R1-03?" (to Priya). They answer in role, from their records.

| `STORYRAIL_ASK` | Who answers | Needs |
|---|---|---|
| `auto` (default) | Bob if it is set up, else records | – |
| `bob` | IBM Bob Shell in **ask mode** (`bob run --mode ask`, read-only) | Bob Shell installed and `BOB_API_KEY` set (ask your Bob admin) |
| `records` | No AI: status, recent log and reports | – |

```bash
export BOB_API_KEY=…                                         # once per terminal, from your Bob admin
node scripts/storyrail-dashboard.mjs                         # auto
STORYRAIL_ASK=records node scripts/storyrail-dashboard.mjs   # never call Bob
```

The terminal prints which one is used. Answers can read the run but never change files, and the chat API only accepts
requests from the dashboard page itself. Chats are kept per member in `.storyrail/chats/` (not committed).

## Good to know

- **Parallel stages.** Build (frontend ∥ backend), isolated tests (UI ∥ API) and review ∥ scan run **at the same time**
  as two Bob subagents. Subagents don't get their mode's file limits, so `scripts/storyrail-lanes.mjs` checks every
  changed file afterwards: anything outside the agents' lanes fails the stage and goes back to that agent. Single-agent
  stages (requirement fetch, fixer, manual QA) run as subtasks in their own mode. If subagents aren't allowed in your
  Bob setup, the orchestrator runs the parallel stages one after the other instead.
- **What you see in Bob.** Single-agent stages open their own subtask conversation; let it finish and the orchestrator
  continues. Parallel stages appear as one collapsible subagent panel with both agents, their tool calls and cost.
- **Cost.** A full story runs about ten modes. Small, focused stories go much further than big ones.
- **Your computer must stay awake** during a run (System Settings → Battery/Lock Screen, or run `caffeinate -i` in another terminal).
- **The dashboard** is local only (`127.0.0.1:4800`); it reads `.storyrail/status.json`, which is not committed.
- **Chat cost.** Each question is one short Bob call (a few seconds). Use `STORYRAIL_ASK=records` if you don't want any.
- **Corporate network.** npm, Maven and Playwright's browser download must reach your internal registry or proxy
  (e.g. `npm config set registry …`, Maven `settings.xml` mirror, `PLAYWRIGHT_DOWNLOAD_HOST`).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `/storyrail` not in the `/` list | Open the repo root as the folder in Bob; check `.bob/commands/storyrail.md` exists (`git switch bob`). |
| StoryRail modes missing | Settings → Modes → *Edit Project Modes*; fix the YAML error it shows, then reload the window. |
| "Edit not allowed" in a mode | Working as intended: that file is outside the mode's lane (another project, or its tests/contract). The orchestrator sends it to the right mode. |
| `gh: not logged in` | `gh auth login` |
| Backend steps say "Maven missing" | `brew install maven` and `brew install --cask temurin@21`, then open a new terminal. |
| Playwright "browser not installed" | `(cd projects/frontend/tests/ui && npx playwright install chromium)` |
| `projects/frontend` missing, or "has uncommitted changes" | `node scripts/storyrail-workspace.mjs sync`; for uncommitted changes, commit or discard them in that project first. |
| Dashboard shows "dashboard server stopped" | `node scripts/storyrail-dashboard.mjs` in a separate terminal. |
| A stage fails twice | The orchestrator stops and tells you why. Fix or answer, then say "continue". |
