/* ---------- Demo replay: a sample run of GitLab story #51, on a loop ---------- */
(()=>{
  const S="set", L="log", R="run", M="metric", F="findings", X="security";
  // [seconds, op, ...args] — the same operations the agents send through scripts/storyrail-status.mjs
  const SCRIPT=[
    [0,R,"phase","Requirements"],[0,L,"orchestrator","info","Run started for GitLab issue #51: Loan history for a book"],
    [2,S,"req-fetch","running",20,"Reading #51 and its comments"],
    [5,S,"req-fetch","running",50,"Reading the Screen and API documents"],
    [8,S,"req-fetch","waiting",80,"1 question for you"],[8,L,"req-fetch","warn","Open question: the API document doesn't say the page size. 20?"],
    [12,L,"orchestrator","info","You answered: page size 20. Posted on #51"],
    [13,S,"req-fetch","done",100,"frontend, backend · 6 ACs"],[13,L,"req-fetch","ok","Spec written: 2 lanes, 6 ACs; contract adds GET /api/books/{id}/loans"],
    [14,R,"phase","Build"],[14,L,"orchestrator","info","Build: frontend and backend in parallel"],
    [15,S,"fe-dev","running",10,"Reading the spec and the Screen document"],[15,S,"be-dev","running",10,"Reading the spec and the API document"],
    [20,S,"fe-dev","running",45,"Building the loan history panel"],[20,S,"be-dev","running",50,"Loan entity, repository and paging"],
    [25,S,"fe-dev","running",80,"Tests for the empty and error states"],[25,S,"be-dev","running",85,"GET /api/books/{id}/loans, 404 for unknown books"],
    [28,S,"be-dev","done",100,"31 tests · mvn verify green · JaCoCo 91%"],[28,M,"unit-be",31,31],[28,L,"be-dev","ok","Endpoint done: 200 with paging, 404 for unknown books"],
    [30,S,"fe-dev","done",100,"24 tests · 97% lines"],[30,M,"unit-fe",24,24],[30,L,"fe-dev","ok","History panel done; new test ids: loan-history, loan-row, history-empty"],
    [31,R,"phase","Isolated tests"],
    [32,S,"ui-tests","running",15,"Planning UI tests for FE-AC1 to FE-AC3"],[32,S,"api-tests","running",15,"Starting the backend locally"],
    [37,S,"ui-tests","running",70,"Running 9 new tests on the mocked API"],[37,S,"api-tests","running",65,"Running 12 new scenarios on localhost:8080"],
    [41,S,"api-tests","done",100,"12 scenarios · 3 ACs"],[41,M,"api",130,130],[41,L,"api-tests","ok","130 scenarios green against the local backend"],
    [43,S,"ui-tests","done",100,"9 tests · 3 ACs"],[43,M,"ui",82,82],[43,L,"ui-tests","ok","82 UI tests green, including axe and 360 px checks"],
    [44,R,"phase","Review + scans"],
    [45,S,"reviewer","running",20,"Round 1: reading both diffs"],[45,S,"gate","running",15,"Sonar on frontend and backend"],
    [49,S,"gate","running",50,"Fortify on the backend"],[52,S,"gate","running",80,"NexusIQ policy evaluation"],
    [54,S,"reviewer","done",100,"CHANGES_REQUESTED · 0 / 1 / 2"],[54,L,"reviewer","warn","R1-01 (major): the empty history isn't announced to screen readers"],
    [56,S,"gate","done",100,"3 findings · Sonar 1 · Fortify ok · NexusIQ 1"],[56,"scans",1,0,1],[56,F,0,2,4,0],
    [56,L,"gate","warn","NexusIQ: jackson-databind 2.15.2 Severe; Sonar: duplicated date format (critical)"],
    [57,R,"phase","Fix"],[57,L,"orchestrator","info","Fix round 1: frontend and backend developers in parallel"],
    [58,S,"fe-fix","running",20,"Fixing 3 findings, round 1"],[58,S,"be-fix","running",20,"Fixing 3 findings, round 1"],
    [62,S,"be-fix","running",60,"Upgrading jackson-databind for NexusIQ"],[62,S,"fe-fix","running",70,"Live region + regression test for R1-01"],
    [66,S,"fe-fix","done",100,"3/3 fixed · 0 disputed"],[67,S,"be-fix","done",100,"3/3 fixed · 0 disputed"],[67,F,0,0,0,6],
    [67,L,"be-fix","ok","jackson-databind 2.17.2, date format shared; 2 regression tests"],
    [68,R,"phase","Review + scans"],[68,S,"reviewer","running",50,"Round 2: checking the fixes"],[68,S,"gate","running",40,"Round 2: re-scanning"],
    [73,S,"gate","done",100,"0 findings · Sonar ok · Fortify ok · NexusIQ ok"],[73,"scans",0,0,0],
    [74,S,"reviewer","done",100,"APPROVE · 0 / 0 / 0"],[74,L,"reviewer","ok","Round 2: APPROVE, every AC met and tested"],
    [75,R,"phase","Release"],[75,S,"cicd","running",10,"Opening merge requests in 3 repos"],
    [79,S,"cicd","waiting",30,"MRs green: backend !12, API tests !8, frontend !15. Merge?"],[79,L,"cicd","info","All MR pipelines green; waiting for your OK to merge"],
    [84,S,"cicd","running",50,"Backend merged · CI running on main"],[84,L,"orchestrator","info","You approved the merge"],
    [89,S,"cicd","running",70,"API tests merged · CI running on main"],[93,S,"cicd","running",85,"Frontend merged · CI running on main"],
    [98,S,"cicd","done",100,"3 MRs merged · CI green on main"],[98,L,"cicd","ok","Backend, API tests and frontend pipelines green on main"],
    [99,R,"phase","Done"],[99,L,"orchestrator","ok","#51 labelled Ready for QA; over to the team for CDD and QA testing"],
    [99,"end"]
  ];
  const LOOP=112; const STATIONS=AGENTS.map(a=>a.id);
  let start=0, next=0, feed=[];
  function reset(){
    state=Object.fromEntries(STATIONS.map(s=>[s,{status:"pending",progress:0,note:""}]));
    run={issues:[51],title:"Loan history for a book",repo:"https://gitlab.example.com/squad/backlog",phase:"Requirements",startedAt:new Date().toISOString(),metrics:{}};
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
    else if(op==="scans") run.metrics.scans={sonar:a,fortify:b,nexusiq:c};
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
