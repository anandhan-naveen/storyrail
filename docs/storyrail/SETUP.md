# Run StoryRail on your laptop (macOS)

StoryRail runs inside **Claude Code** on your machine, using your Claude Pro/Max subscription. No API key is needed.
You start each run yourself with `/storyrail <issue number>`.

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

### Claude Code

```bash
curl -fsSL https://claude.ai/install.sh | bash     # Anthropic's native installer (auto-updates)
claude --version
```

Make sure `ANTHROPIC_API_KEY` is **not** set in your shell (`echo $ANTHROPIC_API_KEY` prints nothing). If it is set,
Claude Code bills that key instead of using your subscription.

### GitHub CLI login

```bash
gh auth login        # GitHub.com → HTTPS → log in with a browser
```

### The repos

Clone only the hub; it clones the two projects into `projects/` itself.

```bash
git clone https://github.com/storyrail-squad/storyrail.git
cd storyrail
node scripts/storyrail-workspace.mjs sync      # clones library-frontend and library-backend into projects/
(cd projects/frontend && npm ci) && (cd projects/frontend/tests/ui && npm ci && npx playwright install chromium) && (cd projects/backend/tests/api && npm ci)
```

The repo names and QA URL live in `storyrail.config.json`. To use other repos (a fork, or your GitLab projects at the
office), change them there.

### First start

```bash
claude
```

Log in with your Claude account when the browser opens, and trust the folder when asked. Claude Code reads
`CLAUDE.md`, the agents in `.claude/agents/` and the `/storyrail` command automatically.

## 2. Each story

1. **Your analyst writes the story** as an issue in the backlog repo ([squad-backlog](https://github.com/storyrail-squad/squad-backlog)) with the *User story* template: the story, numbered acceptance criteria, and tick **Frontend** and/or **Backend**. StoryRail never writes or changes requirements.
2. When you decide that issue should be built, start Claude Code in the `storyrail` folder (`claude`) and give it the issue number:

   ```
   /storyrail 46
   ```

   Several issues that belong together: `/storyrail 46 47`.
3. Open the dashboard it prints: **http://localhost:4800**. Keep it on a second screen during a demo.
4. Answer when it stops at a gate:
   - questions about unclear acceptance criteria,
   - **"PRs are green: backend #X, frontend #Y. Merge and deploy to QA?"** (one PR per project the story touches; backend merges first),
   - which QA defects to fix now,
   - **sign-off**.
5. Bugs found later: the analyst uses the **Bug** template (steps, expected, actual), then `/storyrail fix 50 51`. This also starts at requirement fetch, which reads the bug issues.
6. Where is a run? `/storyrail status`.

Everything a run produces (spec, review and scan reports, QA log and screenshots) is committed in the hub under `runs/issue-<N>/`. The code goes to the project repos.

## Good to know

- **Usage limits.** A full story runs about ten agents and uses a lot of your plan's limit; on Pro a run may pause
  until the limit resets. Small, focused stories go much further than big ones.
- **Permissions.** `.claude/settings.json` pre-approves the routine commands (tests, lint, status updates).
  Claude Code still asks before anything else, such as pushing or merging.
- **Your computer must stay awake** during a run (System Settings → Battery/Lock Screen, or run `caffeinate -i` in another terminal).
- **The dashboard** is local only (`127.0.0.1:4800`); it reads `.storyrail/status.json`, which is not committed.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `/storyrail` not found | Start `claude` from the repo root, not a subfolder. |
| `gh: not logged in` | `gh auth login` |
| Backend steps say "Maven missing" | `brew install maven` and `brew install --cask temurin@21`, then open a new terminal. |
| Playwright "browser not installed" | `(cd projects/frontend/tests/ui && npx playwright install chromium)` |
| `projects/frontend` missing, or "has uncommitted changes" | `node scripts/storyrail-workspace.mjs sync`; for uncommitted changes, commit or discard them in that project first. |
| Dashboard shows "dashboard server stopped" | `node scripts/storyrail-dashboard.mjs` in a separate terminal. |
| A stage fails twice | The orchestrator stops and tells you why. Fix or answer, then say "continue". |
