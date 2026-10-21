/* Demo: the work notes each agent leaves in runs/issue-51/notes/<station>.md (sample data for the replay).
   A member's notes show in the chat once their step has started. */
const DEMO_NOTES={
  "req-fetch":["Two lanes: the frontend shows the history, the backend adds the endpoint; API tests come with the backend lane.",
    "Split the story into 6 testable ACs: FE-AC1 to FE-AC3 (panel, empty state, error state), BE-AC4 to BE-AC6 (list, paging, 404).",
    "Contract: added GET /api/books/{id}/loans with page and size, newest loan first. Copied to the frontend and API-test repos.",
    "Assumed 20 loans per page; the issue didn't say. Flagged it as an open question, the analyst confirmed."],
  "fe-dev":["Built the panel as LoanHistory with its own useLoanHistory hook, so it can refetch after a loan toggle without reloading the book list.",
    "Empty history shows \"Never borrowed\" (FE-AC2); an API error shows a retry button (FE-AC3).",
    "Kept both API modes working: the demo API returns the same paging and 404 as the contract.",
    "Files: src/components/LoanHistory.tsx, src/hooks/useLoanHistory.ts, src/api/books.ts, src/api/demoApi.ts.",
    "New test ids: loan-history, loan-row, history-empty. 24 tests, 97% lines."],
  "be-dev":["Added a Loan entity with a many-to-one to Book, and LoanRepository with a paged query ordered by loanedAt descending.",
    "GET /api/books/{id}/loans returns 404 with the contract's problem title when the book doesn't exist (BE-AC6).",
    "Used the injected Clock for loan dates, so the tests are deterministic.",
    "Files: book/Loan.java, book/LoanRepository.java, book/LoanController.java, book/LoanService.java and their tests.",
    "31 tests, mvn verify green, JaCoCo 91%."],
  "ui-tests":["9 new Playwright tests for FE-AC1 to FE-AC3 on the mocked API, using the test ids from Varunesh.",
    "Covered the empty, error and many-loans states, plus keyboard focus after closing the panel.",
    "Added axe and 360 px checks for the new panel. 82 UI tests green in total."],
  "api-tests":["12 new Cucumber scenarios for BE-AC4 to BE-AC6, one rule per AC.",
    "Tagged 4 of them @qa: one happy path per AC plus the 404, safe to run against QA because each scenario cleans up.",
    "Every response is checked against the contract, every error against the problem format. 130 scenarios green."],
  "gate":["Round 1: ran lint, Semgrep, gitleaks, npm audit, osv-scanner and the Maven checks on both repos.",
    "Two minor findings: a magic number in the paging code (S1-01) and a duplicated date format (S1-02).",
    "Round 2: all six tools clean, 0 findings."],
  "reviewer":["Round 1: CHANGES_REQUESTED. One major: the empty history isn't announced to screen readers (R1-01). Three minors on naming and a missing test for page 2.",
    "Round 2: APPROVE. Every AC is implemented and has a test tagged with it."],
  "fixer":["Fixed all 6 findings in one pass: R1-01 with a live region, plus the 3 review minors and the 2 scan minors.",
    "Added 3 regression tests, one of them proves R1-01 fails on the old code.",
    "Disputed nothing. Paging size is now a named constant shared by the controller and the test."],
  "manual-tests":["Tested on the QA site, not a local build: 14 cases across desktop, 360 px, dark mode and keyboard only.",
    "No blocker or major. One low: long borrower names wrap awkwardly at 360 px (D01), logged in the backlog.",
    "Checked the backend ACs against the QA API with curl as well."],
  "orchestrator":["Ran frontend and backend in parallel, then UI and API tests in parallel.",
    "Review needed 2 rounds: round 1 found 1 major and 5 minors, round 2 approved.",
    "Merged backend, API tests, frontend in that order after Laurence approved."]
};
function demoNotes(m){ const ids=m.stations.length?m.stations:["orchestrator"]; const out=[];
  ids.forEach(id=>{ const st=(state[id]||{}).status; if(id==="orchestrator"?!!run.startedAt:(st&&st!=="pending"&&st!=="skipped")) (DEMO_NOTES[id]||[]).forEach(n=>out.push(n)); });
  return out; }
