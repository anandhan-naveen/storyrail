#!/usr/bin/env python3
"""Build the stand-alone StoryRail demo page: docs/demo/index.html.

One HTML file, no server and no account needed: it replays a sample run of story #51 on a loop
(Orchestration, Squad and Flow tabs) and shows an Evals tab with sample exam data. Squad members
answer chat questions from their status and log in the replay.

Open it by double-clicking the file, through the local dashboard at http://localhost:4800/demo,
or host the docs/ folder on any static web server (GitHub Pages, GitLab Pages, an intranet server).

Usage (from the hub root):  python3 scripts/storyrail-build-demo.py
Inputs: storyrail-dashboard/index.html, storyrail.config.json, storyrail-dashboard/demo-src/*
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
D = os.path.join(ROOT, "storyrail-dashboard", "demo-src")
OUT = os.path.join(ROOT, "docs", "demo", "index.html")


def read(*parts):
    with open(os.path.join(*parts), encoding="utf-8") as f:
        return f.read()


src = read(ROOT, "storyrail-dashboard", "index.html")
squad = json.loads(read(ROOT, "storyrail.config.json"))["squad"]["members"]


def rep(a, b):
    global src
    if a not in src:
        raise SystemExit("storyrail-build-demo: the dashboard changed, can't find: " + a[:90])
    src = src.replace(a, b)


def cut(start, end, insert):
    """Replace src[start:end) (end marker kept) with insert."""
    global src
    i, j = src.index(start), src.index(end)
    src = src[:i] + insert + src[j:]


# Squad from the config instead of the server.
cut('fetch("squad.json"', 'setInterval(()=>{ if(!$("view-squad").hidden) renderSquad(); },15000);',
    "const SQUAD=" + json.dumps(squad) + ''';
squad=SQUAD; squad.forEach(m=>m.stations.forEach(s=>byStation[s]=m)); byStation.orchestrator=squad.find(m=>m.kind==="lead");
engine="records";
''')
rep('''async function loadMember(id){
  try{ const r=await fetch("api/member?id="+encodeURIComponent(id),{cache:"no-store"}); if(r.ok) chatCache[id]=await r.json(); }catch(e){ /* server may be restarting; keep the last copy */ }
}''', '''async function loadMember(id){ chatCache[id]=chatCache[id]||{outputs:[],chat:[]}; }''')
i = src.index('$("d-engine").textContent=')
j = src.index(";", src.index('"AI answers are off on this machine', i)) + 1
src = src[:i] + '$("d-engine").textContent="Demo: "+m.name+" answers from their status and log in this replay.";' + src[j:]

# Chat: answers come from the member's records in the replay.
cut('$("d-form").addEventListener("submit",async e=>{', '$("d-q").addEventListener("keydown"', '''function recordsAnswer(m){
  const ms=memberState(m); const lines=[];
  if(!m.stations.length) lines.push(run.startedAt?"We're in the "+(run.phase||"first")+" phase of “"+(run.title||"this story")+"”.":"No story is running right now.");
  ms.per.forEach(p=>lines.push("My "+STATION_NAME[p.id]+" step is "+({pending:"not started yet",running:"in progress",done:"done",failed:"failed",waiting:"waiting for you",skipped:"not needed this run"}[p.status]||p.status)+(p.status==="running"&&p.progress?" ("+p.progress+"%)":"")+(p.note?": "+p.note:".")));
  const ids=new Set(m.stations); if(!m.stations.length) ids.add("orchestrator");
  const f=(window.__feed||[]).filter(x=>ids.has(x.agent)).slice(-3); if(f.length) lines.push("What I've reported lately:\\n"+f.map(x=>"• "+x.msg).join("\\n"));
  return lines.join("\\n");
}
$("d-form").addEventListener("submit",e=>{
  e.preventDefault(); const q=$("d-q").value.trim(); const id=openId; if(!q||!id) return;
  const m=squad.find(x=>x.id===id); const data=chatCache[id]||(chatCache[id]={outputs:[],chat:[]});
  data.chat=data.chat.concat({from:"you",text:q,t:new Date().toISOString()},{from:id,text:recordsAnswer(m),t:new Date().toISOString()});
  $("d-q").value=""; renderDrawer(true); $("d-q").focus();
});
''')

# The replay instead of polling the local server.
cut('(()=>{\n  const conn=$("conn"); let last="", fails=0;', "})();\n</script>", read(D, "replay.js") + "\n")
rep('<p class="foot">Live: agents report through <code>scripts/storyrail-status.mjs</code>; this page refreshes every 1.5 s.</p>',
    '<p class="foot">Demo replay of a sample run, on a loop. In a real run the agents report through <code>scripts/storyrail-status.mjs</code> and the local dashboard updates every 1.5 s.</p>')
rep('<span class="chip" id="conn">connecting</span>',
    '<span class="chip live" id="conn">demo replay</span><button class="chip replay" id="replay" type="button">Restart</button>')
rep(".chip b{color:var(--on-brand);font-weight:600}",
    ".chip b{color:var(--on-brand);font-weight:600}\n.chip.replay{background:transparent;cursor:pointer}\n.chip.replay:hover{border-color:var(--on-brand)}\n.chip.replay:focus-visible{outline:3px solid #fff;outline-offset:2px}")

# Evals tab with sample exam data.
rep('<button role="tab" id="tab-flow" aria-controls="view-flow" aria-selected="false" tabindex="-1">Flow</button>',
    '<button role="tab" id="tab-flow" aria-controls="view-flow" aria-selected="false" tabindex="-1">Flow</button>\n    <button role="tab" id="tab-evals" aria-controls="view-evals" aria-selected="false" tabindex="-1">Evals</button>')
rep('  <div class="scrim" id="scrim" hidden></div>', read(D, "evals.html") + '  <div class="scrim" id="scrim" hidden></div>')
rep("</style>", read(D, "evals.css") + "</style>")
rep('const TABS=["orch","squad","flow"];', 'const TABS=["orch","squad","flow","evals"];')
rep('  if(name==="orch") renderOrch();',
    '  if(name==="orch") renderOrch();\n  document.querySelector(".lower").style.display=name==="evals"?"none":""; // the run\'s activity log and stories don\'t belong to the exam')
rep("/* ---------- Tabs ---------- */", read(D, "evals.js") + "\n/* ---------- Tabs ---------- */")

os.makedirs(os.path.dirname(OUT), exist_ok=True)
with open(OUT, "w", encoding="utf-8") as f:
    f.write(src)
print("Built " + os.path.relpath(OUT, ROOT) + " (" + str(len(src) // 1024) + " KB). Open it in a browser, or http://localhost:4800/demo")
