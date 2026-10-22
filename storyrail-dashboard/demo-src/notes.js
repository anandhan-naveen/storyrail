/* Demo: the work notes each agent leaves in runs/issue-51/notes/<station>.md (sample data for the replay).
   A member's notes show in the chat once their step has started. */
const DEMO_NOTES={
  "req-fetch":["Read #51 and its comments, and the two documents the functional analyst attached: the Screen document and the API document.",
    "Two lanes: the Screen document adds a loan history panel, the API document a new endpoint; API tests come with the backend lane.",
    "6 testable ACs: FE-AC1 to FE-AC3 (panel, empty state, error state), BE-AC4 to BE-AC6 (list, paging, 404).",
    "The API document didn't give a page size, so I asked. You answered 20; I posted the answer on #51.",
    "Contract: added GET /api/books/{id}/loans exactly as the API document names the fields."],
  "fe-dev":["Built the panel as LoanHistory with its own useLoanHistory hook, so it can refetch after a loan toggle without reloading the book list.",
    "Followed the Screen document for the texts: \"Never borrowed\" for the empty state, a retry button on errors.",
    "New test ids: loan-history, loan-row, history-empty. 24 tests, 97% lines.",
    "Round 1 fixes: added the live region for R1-01 with a regression test, and replaced a magic number Sonar flagged."],
  "be-dev":["Added a Loan entity and LoanRepository with a paged query, newest loan first, page size 20 as you confirmed.",
    "Unknown book returns 404 with the problem title from the API document (BE-AC6).",
    "31 tests, mvn verify green, JaCoCo 91%.",
    "Round 1 fixes: upgraded jackson-databind from 2.15.2 to 2.17.2 for the NexusIQ Severe violation, and shared the duplicated date format Sonar reported."],
  "ui-tests":["9 new Playwright tests for FE-AC1 to FE-AC3 on the mocked API, using the test ids from Varunesh.",
    "Covered the empty, error and many-loans states, plus keyboard focus after closing the panel.",
    "Added axe and 360 px checks for the new panel. 82 UI tests green in total.",
    "Round 2: re-ran the whole suite after Varunesh's fixes and added the regression test for R1-01 he asked for. 83/83 green."],
  "api-tests":["Started the backend locally and ran the scenarios against localhost:8080.",
    "12 new Cucumber scenarios for BE-AC4 to BE-AC6, one rule per AC; each scenario cleans up, so the testers can reuse them on QA.",
    "Every response is checked against the contract. 130 scenarios green.",
    "Round 2: rebuilt the backend with Meysam's jackson-databind upgrade and re-ran all 130 scenarios: still green, no JSON changes."],
  "gate":["Round 1, all local: Sonar through the Maven plugin and sonar-scanner, Fortify SCA on the backend, the NexusIQ CLI on both.",
    "Sonar: quality gate failed on one critical issue, a duplicated date format. Fortify: no critical or high. NexusIQ: jackson-databind 2.15.2 has a Severe policy violation.",
    "Round 2: every gate passed, 0 findings."],
  "reviewer":["Round 1: CHANGES_REQUESTED. One major: the empty history isn't announced to screen readers (R1-01). Two minors on naming and a missing test for page 2.",
    "Round 2: APPROVE. Every AC is implemented, matches the documents and has a test tagged with it."],
  "cicd":["Opened a merge request in each repo: backend !12, API tests !8, frontend !15. All MR pipelines went green.",
    "You approved the merge. Merged backend first, then API tests, then frontend, and waited for each main pipeline.",
    "All three pipelines green on main. Deployment with CDD is up to the team."],
  "orchestrator":["Relayed one question from Sindhu to you and posted the answer on #51.",
    "Ran frontend and backend in parallel, then UI and API tests, then the review beside the scans.",
    "Fix round 1 went to both developers; round 2 passed every gate.",
    "Merged after your OK; labelled #51 Ready for QA."]
};
function demoNotes(m){ const ids=m.kind==="lead"?["orchestrator"]:m.stations; const out=[];
  ids.forEach(id=>{ const st=(state[id]||{}).status; if(id==="orchestrator"?!!run.startedAt:(st&&st!=="pending"&&st!=="skipped")) (DEMO_NOTES[id]||[]).forEach(n=>out.push(n)); });
  return out; }
