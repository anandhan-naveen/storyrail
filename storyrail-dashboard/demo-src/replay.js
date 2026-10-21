/* ---------- Demo replay: a sample run of story #51, on a loop ---------- */
(()=>{
  const S="set", L="log", R="run", M="metric", F="findings", X="security";
  // [seconds, op, ...args] — the same operations the agents send through scripts/storyrail-status.mjs
  const SCRIPT=[
    [0,R,"phase","Requirements"],[0,L,"orchestrator","info","Run started for issue #51: Loan history for a book"],
    [2,S,"req-fetch","running",20,"Reading issue #51 and its comments"],
    [6,S,"req-fetch","running",70,"Checking the 6 acceptance criteria are testable"],
    [9,S,"req-fetch","done",100,"frontend, backend · 6 ACs"],[9,L,"req-fetch","ok","Spec written: 2 lanes, 6 ACs; contract adds GET /api/books/{id}/loans"],
    [10,R,"phase","Build"],[10,L,"orchestrator","info","Build: frontend and backend in parallel"],
    [11,S,"fe-dev","running",10,"Reading the spec and the BookRow component"],[11,S,"be-dev","running",10,"Reading the spec and the Book entity"],
    [16,S,"fe-dev","running",40,"Building the loan history panel"],[16,S,"be-dev","running",45,"Adding the Loan entity and repository"],
    [17,L,"be-dev","info","Loan entity and repository done, 14 tests green"],
    [22,S,"fe-dev","running",75,"Writing tests for the empty and error states"],[22,S,"be-dev","running",80,"GET /api/books/{id}/loans with paging"],
    [26,S,"be-dev","done",100,"31 tests · mvn verify green · JaCoCo 91%"],[26,M,"unit-be",31,31],[26,L,"be-dev","ok","Endpoint done: 200 with paging, 404 for unknown books"],
    [28,S,"fe-dev","done",100,"24 tests · 97% lines"],[28,M,"unit-fe",24,24],[28,L,"fe-dev","ok","History panel done; new test ids: loan-history, loan-row, history-empty"],
    [29,R,"phase","Isolated tests"],
    [30,S,"ui-tests","running",15,"Planning UI tests for FE-AC1 to FE-AC3"],[30,S,"api-tests","running",15,"Writing @BE-AC4 to @BE-AC6 scenarios"],
    [36,S,"ui-tests","running",70,"Running 9 new tests on the mocked API"],[36,S,"api-tests","running",65,"Running 12 new scenarios on the local jar"],
    [41,S,"api-tests","done",100,"12 scenarios · 3 ACs · 4 @qa"],[41,M,"api",130,130],[41,L,"api-tests","ok","130 scenarios green on the local jar, 4 new ones tagged @qa"],
    [43,S,"ui-tests","done",100,"9 tests · 3 ACs"],[43,M,"ui",82,82],[43,L,"ui-tests","ok","82 UI tests green, including axe and 360 px checks"],
    [44,R,"phase","Review + scan"],
    [45,S,"reviewer","running",20,"Round 1: reading both diffs"],[45,S,"gate","running",20,"Lint, Semgrep, gitleaks, npm audit"],
    [51,S,"gate","done",100,"2 minor findings · 6/6 tools"],[51,X,0,0],[51,L,"gate","warn","S1-01, S1-02 (minor): magic number in paging, duplicated date format"],
    [54,S,"reviewer","done",100,"CHANGES_REQUESTED · 0 / 1 / 3"],[54,F,0,1,5,0],
    [54,L,"reviewer","warn","R1-01 (major): the empty history isn't announced to screen readers"],
    [55,R,"phase","Fix"],[56,S,"fixer","running",20,"Fixing 6 findings from review and scan"],
    [60,S,"fixer","running",70,"Adding a live region and a regression test for R1-01"],
    [63,S,"fixer","done",100,"6/6 fixed · 0 disputed"],[63,F,0,0,0,6],[63,L,"fixer","ok","All 6 findings fixed, 3 regression tests added"],
    [64,R,"phase","Review + scan"],[64,S,"reviewer","running",50,"Round 2: checking the fixes"],[64,S,"gate","running",50,"Round 2: re-scanning"],
    [67,S,"gate","done",100,"0 findings · 6/6 tools"],[68,S,"reviewer","done",100,"APPROVE · 0 / 0 / 0"],[68,L,"reviewer","ok","Round 2: APPROVE, every AC met and tested"],
    [69,R,"phase","CI/CD"],[69,S,"cicd","running",10,"Opening PRs in 3 repos"],
    [74,S,"cicd","waiting",40,"PRs green: backend #12, API tests #8, frontend #15. Merge?"],[74,L,"cicd","info","All checks green; waiting for the product owner to approve the merge"],
    [79,S,"cicd","running",60,"Merging backend, then API tests, then frontend"],[79,L,"orchestrator","info","Laurence approved the merge"],
    [86,S,"cicd","done",100,"3 PRs merged · deployed to QA"],[86,L,"cicd","ok","Backend on Render, frontend on GitHub Pages"],
    [87,R,"phase","QA"],[87,S,"smoke","running",50,"Checking the QA site and API"],[90,S,"smoke","done",100,"QA site and API alive"],
    [91,S,"qa-api","running",30,"Running 42 @qa scenarios on the QA API"],[96,S,"qa-api","done",100,"42/42 @qa scenarios green on QA"],[96,L,"qa-api","ok","API acceptance on QA: 42/42 green"],
    [97,S,"manual-tests","running",15,"Exploring the loan history on QA"],[103,S,"manual-tests","running",65,"Checking 360 px, dark mode and keyboard focus"],
    [109,S,"manual-tests","done",100,"14 cases · 0 blocker/major · 1 low"],[109,L,"manual-tests","warn","D01 (low): long borrower names wrap awkwardly at 360 px; backlog"],
    [110,R,"phase","Sign-off"],[110,S,"signoff","waiting",0,"Your decision"],[110,L,"orchestrator","info","Story ready for sign-off"],
    [118,S,"signoff","done",100,"Approved"],[118,R,"phase","Done"],[118,L,"orchestrator","ok","Laurence signed off #51; issue closed, D01 in the backlog"],
    [118,"end"]
  ];
  const LOOP=132; const STATIONS=AGENTS.map(a=>a.id);
  let start=0, next=0, feed=[];
  function reset(){
    state=Object.fromEntries(STATIONS.map(s=>[s,{status:"pending",progress:0,note:""}]));
    run={issues:[51],title:"Loan history for a book",repo:"storyrail-squad/squad-backlog",phase:"Requirements",startedAt:new Date().toISOString(),metrics:{}};
    feed=[]; next=0; start=performance.now(); feedSeen.clear(); $("feed").innerHTML="";
    ["k-unit","k-api","k-ui","k-rev","k-sec"].forEach(id=>{ $(id).textContent="—"; }); ["kb-unit","kb-api","kb-ui","kb-rev","kb-sec"].forEach(id=>bar(id,0)); $("findings").hidden=true;
    Object.values(chatCache).forEach(c=>{ c.chat=[]; });
  }
  function apply(e){
    const [,op,a,b,c,d,f]=e; const now=new Date().toISOString();
    if(op===S) state[a]={status:b,progress:b==="done"?100:c,note:d||""};
    else if(op===L) feed.push({t:now,agent:a,level:b,msg:c});
    else if(op===R) run[a]=b;
    else if(op===M){ run.metrics[a]={passed:b,total:c}; const p=["unit-fe","unit-be"].map(k=>run.metrics[k]).filter(Boolean); if(p.length) run.metrics.unit=p.reduce((x,y)=>({passed:x.passed+y.passed,total:x.total+y.total}),{passed:0,total:0}); }
    else if(op===F) run.metrics.review={blocker:a,major:b,minor:c,fixed:d};
    else if(op===X) run.metrics.security={vulns:a,lint:b};
    else if(op==="end") run.endedAt=now;
  }
  function tick(){
    const t=(performance.now()-start)/1000; let changed=false;
    while(next<SCRIPT.length&&SCRIPT[next][0]<=t){ apply(SCRIPT[next]); next++; changed=true; }
    if(t>LOOP){ reset(); changed=true; }
    if(changed){ window.__feed=feed; renderAgents(); renderRun(); renderFeed(feed); renderSquad(); }
  }
  $("replay").addEventListener("click",()=>{ reset(); tick(); });
  reset(); tick(); setInterval(tick,500);
})();
