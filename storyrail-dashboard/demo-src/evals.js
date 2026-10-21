/* ---------- Evals view (demo, mock data): one setup, an exam after each change ---------- */
const EV={
  // pass marks you set once; the first exam (the baseline) is judged against these, later exams against the exam before
  targets:{pct:90,spread:10,major:0.5,human:0},
  setup:{name:"IBM Bob + house standards + Figma MCP",sub:"The only setup you run. Every exam uses the same two practice stories."},
  stories:[
    {id:"E1",title:"Loan history for a book",kind:"Story",lanes:"Frontend + backend",tests:20,why:"Figma screen with Storybook components; backend follows the reference app"},
    {id:"E2",title:"ISBN check digit accepts wrong values",kind:"Bug",lanes:"Backend",tests:12,why:"Backend bug fix with a regression test, reference-app patterns"}],
  // each exam: why it ran, and 3 runs per story of [hidden tests passed, major findings, fix rounds, human interventions, minutes]
  exams:[
    {id:"x1",date:"21 Oct",reason:"baseline",label:"Baseline",detail:"First exam, before the demo",
      runs:{E1:[[20,0,1,0,40],[19,1,1,0,43],[20,0,1,0,39]],E2:[[12,0,1,0,19],[12,0,1,0,19],[11,0,1,0,21]]}},
    {id:"x2",date:"4 Nov",reason:"bob",label:"Bob update",detail:"Bob updated by IBM (version 2.2)",
      runs:{E1:[[20,0,1,0,38],[20,0,1,0,40],[19,0,1,0,41]],E2:[[12,0,1,0,18],[12,0,1,0,19],[12,0,1,0,18]]}},
    {id:"x3",date:"18 Nov",reason:"change",label:"Brief change",detail:"Frontend developer brief: check every Storybook prop before use",
      runs:{E1:[[20,0,1,0,37],[20,0,1,0,38],[20,0,1,0,36]],E2:[[12,0,1,0,18],[12,0,1,0,19],[12,0,1,0,18]]}},
    {id:"x4",date:"2 Dec",reason:"bob",label:"Bob update",detail:"Bob updated by IBM (version 2.3)",
      runs:{E1:[[17,2,2,1,52],[19,1,1,0,44],[16,2,2,1,55]],E2:[[11,1,1,0,24],[12,0,1,0,21],[10,1,2,0,27]]}}]
};
const evAvg=a=>a.reduce((x,y)=>x+y,0)/a.length;
function evStats(ex){
  let passed=0,total=0; const spreads=[],major=[],rounds=[],human=[],mins=[];
  EV.stories.forEach(st=>{ const runs=ex.runs[st.id];
    runs.forEach(r=>{ passed+=r[0]; total+=st.tests; major.push(r[1]); rounds.push(r[2]); human.push(r[3]); mins.push(r[4]); });
    const p=runs.map(r=>r[0]/st.tests*100); spreads.push(Math.max(...p)-Math.min(...p)); });
  return {pct:passed/total*100,spread:evAvg(spreads),major:evAvg(major),rounds:evAvg(rounds),human:human.reduce((a,b)=>a+b,0),mins:evAvg(mins)};
}
const evName=ex=>ex.date+" · "+ex.label;
let evSel="E1";
function evVerdict(A,B,a,b){
  if(A.reason==="baseline"){
    const T=EV.targets, ok=a.pct>=T.pct&&a.spread<=T.spread&&a.major<=T.major&&a.human<=T.human;
    const facts="Hidden tests "+a.pct.toFixed(0)+"% (target ≥ "+T.pct+"%) · spread between runs "+a.spread.toFixed(0)+" pts (≤ "+T.spread+") · major findings "+a.major.toFixed(1)+" per run (≤ "+T.major+") · human interventions "+a.human+" (target "+T.human+").";
    return ok?["keep","✓","First exam: it meets your targets and becomes the baseline.","There is nothing earlier to compare with, so it is checked against the targets you set. "+facts]
             :["worse","!","First exam: below your targets. Fix the setup before you rely on it.",facts];
  }
  if(A===B) return ["same","=","Pick two different exams to compare.",""];
  const d=a.pct-b.pct, steadier=a.spread<=b.spread+2;
  const facts="Hidden tests "+b.pct.toFixed(0)+"% → "+a.pct.toFixed(0)+"% · spread between runs "+b.spread.toFixed(0)+" → "+a.spread.toFixed(0)+" points · major findings "+b.major.toFixed(1)+" → "+a.major.toFixed(1)+" per run · human interventions "+b.human+" → "+a.human+".";
  if(A.reason==="bob"){
    if(d<=-2) return ["worse","!","Score dropped after a Bob update. Your setup didn't change, so raise it with IBM.","Attach this exam as evidence. "+facts];
    return ["keep","✓","The Bob update is safe: same quality as before.",facts];
  }
  if(d<=-2) return ["worse","!","Roll the change back: the squad got worse.",facts];
  if(d>=2||(d>-2&&steadier&&a.major<=b.major)) return ["keep","✓","Keep the change: the squad is as good or better.",facts];
  return ["same","=","No clear difference.",facts];
}
function renderEvals(){
  const A=EV.exams.find(x=>x.id===$("ev-a").value), first=A.reason==="baseline";
  $("ev-b-wrap").hidden=first; $("ev-b-first").hidden=!first;
  const B=first?A:EV.exams.find(x=>x.id===$("ev-b").value);
  const a=evStats(A), b=evStats(B);
  const [cls,icon,head,sub]=evVerdict(A,B,a,b);
  const v=$("ev-verdict"); v.className="ev-verdict "+cls; v.innerHTML='<span class="ic" aria-hidden="true"></span><div><b></b><p></p></div>';
  v.querySelector(".ic").textContent=icon; v.querySelector("b").textContent=head; v.querySelector("p").textContent=(A.detail?A.detail+". ":"")+sub;
  // the one setup, stats of the chosen exam with the change against the other one
  $("ev-setup-title").textContent="Your squad: "+EV.setup.name; $("ev-setup-sub").textContent=EV.setup.sub;
  const box=$("ev-stats"); box.innerHTML="";
  const T=EV.targets;
  if(first){ [["Hidden tests",a.pct,v=>v.toFixed(0)+"%","target ≥ "+T.pct+"%",a.pct>=T.pct],["Spread between runs",a.spread,v=>v.toFixed(0)+" pts","target ≤ "+T.spread+" pts",a.spread<=T.spread],
      ["Major findings / run",a.major,v=>v.toFixed(1),"target ≤ "+T.major,a.major<=T.major],["Fix rounds / run",a.rounds,v=>v.toFixed(1),"no target",null],
      ["Human interventions",a.human,v=>String(v),"target "+T.human,a.human<=T.human],["Time per run",a.mins,v=>v.toFixed(0)+" min","no target",null]]
    .forEach(([k,va,f,t,ok])=>{ const c=document.createElement("div"); c.className="ev-stat"; c.innerHTML='<div class="k"></div><div class="v"></div><div class="d"></div>';
      c.querySelector(".k").textContent=k; c.querySelector(".v").textContent=f(va); const d=c.querySelector(".d"); d.className="d "+(ok===null?"flat":ok?"up":"down"); d.textContent=(ok===null?"":ok?"✓ ":"✗ ")+t; box.append(c); }); }
  else [["Hidden tests",a.pct,b.pct,v=>v.toFixed(0)+"%",true],["Spread between runs",a.spread,b.spread,v=>v.toFixed(0)+" pts",false],["Major findings / run",a.major,b.major,v=>v.toFixed(1),false],
   ["Fix rounds / run",a.rounds,b.rounds,v=>v.toFixed(1),false],["Human interventions",a.human,b.human,v=>String(v),false],["Time per run",a.mins,b.mins,v=>v.toFixed(0)+" min",false]]
   .forEach(([k,va,vb,f,hi])=>{ const c=document.createElement("div"); c.className="ev-stat"; c.innerHTML='<div class="k"></div><div class="v"></div><div class="d"></div>';
     c.querySelector(".k").textContent=k; c.querySelector(".v").textContent=f(va);
     const diff=va-vb, small=Math.abs(diff)<(hi?1:0.05)*(k==="Time per run"?20:1), good=hi?diff>0:diff<0; const d=c.querySelector(".d");
     d.className="d "+(A===B||small?"flat":good?"up":"down"); d.textContent=A===B||small?"same as "+B.date:(diff>0?"▲ ":"▼ ")+f(Math.abs(diff)).replace("%"," pts")+" vs "+B.date; box.append(c); });
  // scoreboard
  const tb=$("ev-board"); tb.innerHTML="<thead><tr><th>Practice story</th><th class='hide-s'>What it checks</th><th></th><th></th><th>Change</th></tr></thead>";
  tb.querySelectorAll("th")[2].textContent=first?"":evName(B); tb.querySelectorAll("th")[3].textContent=evName(A);
  if(first){ tb.querySelectorAll("th")[2].remove(); tb.querySelectorAll("th")[3].textContent="Spread"; }
  const body=document.createElement("tbody");
  EV.stories.forEach(st=>{ const tr=document.createElement("tr"); tr.className="story"+(st.id===evSel?" sel":""); tr.tabIndex=0;
    const cell=(ex,col)=>{ const td=document.createElement("td"); const runs=ex.runs[st.id]; const bars=document.createElement("span"); bars.className="ev-runs"; bars.style.setProperty("--c",col); bars.setAttribute("aria-hidden","true");
      runs.forEach(r=>{ const i=document.createElement("i"); i.style.height=Math.max(3,(r[0]/st.tests)*30)+"px"; bars.append(i); });
      const pct=evAvg(runs.map(r=>r[0]))/st.tests*100; const sp=document.createElement("span"); sp.className="ev-pct"; sp.textContent=pct.toFixed(0)+"%";
      td.append(bars,sp); td.setAttribute("aria-label",runs.map(r=>r[0]+"/"+st.tests).join(", ")+" hidden tests, average "+pct.toFixed(0)+"%"); td.title="Runs: "+runs.map(r=>r[0]+"/"+st.tests).join(" · "); return [td,pct]; };
    const tdS=document.createElement("td"); tdS.className="ev-story"; tdS.innerHTML="<b></b><small></small>"; tdS.querySelector("b").textContent=st.id+" · "+st.title; tdS.querySelector("small").textContent=st.kind+" · "+st.lanes+" · "+st.tests+" hidden tests";
    const tdL=document.createElement("td"); tdL.className="hide-s ev-muted"; tdL.textContent=st.why;
    const [tdB,pb]=cell(B,"var(--muted)"), [tdA,pa]=cell(A,"var(--s1)"); const dd=pa-pb; const tdD=document.createElement("td"); const sp=document.createElement("span");
    sp.className="ev-delta "+(dd>=1?"up":dd<=-1?"down":"flat"); sp.textContent=(dd>=1?"▲ +":dd<=-1?"▼ ":"= ")+(Math.abs(dd)>=1?Math.round(dd)+" pts":"same"); tdD.append(sp);
    if(first){ const runs=A.runs[st.id].map(r=>r[0]/st.tests*100), spr=Math.max(...runs)-Math.min(...runs); sp.className="ev-delta "+(spr<=EV.targets.spread?"flat":"down"); sp.textContent=spr.toFixed(0)+" pts"; tr.append(tdS,tdL,tdA,tdD); }
    else tr.append(tdS,tdL,tdB,tdA,tdD);
    const pick=()=>{ evSel=st.id; renderEvals(); }; tr.addEventListener("click",pick); tr.addEventListener("keydown",e=>{ if(e.key==="Enter"||e.key===" "){ e.preventDefault(); pick(); }});
    body.append(tr); });
  tb.append(body);
  // detail for the selected story
  const st=EV.stories.find(s=>s.id===evSel), det=$("ev-detail");
  const rows=[["Hidden tests passed",0,true,r=>r+"/"+st.tests],["Major findings",1,false,String],["Fix rounds",2,false,String],["Human interventions",3,false,String],["Minutes",4,false,String]];
  let h="<table><caption class='ev-muted' style='text-align:left;padding-bottom:6px'></caption><thead><tr><th></th><th colspan='3' class='grp gb'></th><th colspan='3' class='grp ga'></th></tr><tr><th>"+st.id+", run by run</th><th>Run 1</th><th>Run 2</th><th>Run 3</th><th>Run 1</th><th>Run 2</th><th>Run 3</th></tr></thead><tbody>";
  rows.forEach(([lab,k,hi,f])=>{ const rb=B.runs[st.id].map(r=>r[k]), ra=A.runs[st.id].map(r=>r[k]); const ab=evAvg(rb), aa=evAvg(ra);
    const c=aa===ab?"":(hi?aa>ab:aa<ab)?"better":"worse";
    h+="<tr><td>"+lab+"</td>"+rb.map(x=>"<td>"+f(x)+"</td>").join("")+ra.map(x=>"<td class='"+c+"'>"+f(x)+"</td>").join("")+"</tr>"; });
  if(first){ h="<table><caption class='ev-muted' style='text-align:left;padding-bottom:6px'></caption><thead><tr><th>"+st.id+", run by run</th><th>Run 1</th><th>Run 2</th><th>Run 3</th></tr></thead><tbody>";
    rows.forEach(([lab,k,hi,f])=>{ h+="<tr><td>"+lab+"</td>"+A.runs[st.id].map(r=>"<td>"+f(r[k])+"</td>").join("")+"</tr>"; });
    det.innerHTML=h+"</tbody></table>"; det.querySelector("caption").textContent=st.id+" · "+st.title+": the three runs of the first exam. Similar numbers in each row mean a consistent squad."; return; }
  det.innerHTML=h+"</tbody></table>"; det.querySelector(".gb").textContent=evName(B); det.querySelector(".ga").textContent=evName(A);
  det.querySelector("caption").textContent=st.id+" · "+st.title+": "+evName(B)+" (left) and "+evName(A)+" (right). Green or red marks where the right-hand exam is better or worse on average.";
}
function renderEvalChart(){
  const box=$("ev-chart"); const W=Math.max(300,Math.round(box.clientWidth||760)), narrow=W<620, H=narrow?240:290, L=44, R=narrow?22:60, T=40, Bm=30;
  const ex=EV.exams, n=ex.length, vals=ex.map(e=>evStats(e).pct);
  const x=i=>L+(n===1?0:i*(W-L-R)/(n-1)), y=v=>T+(100-v)/(100-70)*(H-T-Bm);
  let s='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="Hidden tests passed at each exam"><g class="grid">';
  [70,80,90,100].forEach(v=>{ s+='<line x1="'+L+'" x2="'+(W-R)+'" y1="'+y(v)+'" y2="'+y(v)+'"/>'; }); s+="</g>";
  [70,80,90,100].forEach(v=>{ s+='<text class="ax" x="'+(L-8)+'" y="'+(y(v)+4)+'" text-anchor="end">'+v+'%</text>'; });
  ex.forEach((e,i)=>{ s+='<text class="ax" x="'+x(i)+'" y="'+(H-8)+'" text-anchor="middle">'+e.date+'</text>';
    if(e.reason!=="baseline"){ s+='<line class="mark" x1="'+x(i)+'" x2="'+x(i)+'" y1="'+(T-18)+'" y2="'+(H-Bm)+'"/><text class="mlab" x="'+x(i)+'" y="14" text-anchor="'+(i===n-1?"end":"middle")+'">'+e.label+'</text>'; }
    else s+='<text class="mlab" x="'+x(i)+'" y="14" text-anchor="'+(i===0?"start":"middle")+'">'+e.label+'</text>'; });
  s+='<line class="xh" id="ev-xh" y1="'+T+'" y2="'+(H-Bm)+'"/>';
  s+='<path class="ln ev-ln" d="M'+vals.map((v,i)=>x(i)+","+y(v)).join(" L")+'"/>';
  vals.forEach((v,i)=>{ const drop=i>0&&v-vals[i-1]<=-2; s+='<circle class="pt ev-pt'+(drop?" drop":"")+'" r="5" cx="'+x(i)+'" cy="'+y(v)+'"/>';
    s+='<text class="vlab" x="'+(x(i)+(i===n-1?-8:8))+'" y="'+(y(v)+20)+'" text-anchor="'+(i===n-1?"end":"start")+'">'+v.toFixed(0)+'%</text>'; });
  s+='<rect id="ev-hit" x="'+(L-10)+'" y="'+T+'" width="'+(W-L-R+20)+'" height="'+(H-T-Bm)+'" fill="transparent"/></svg>';
  box.querySelector("svg")?.remove(); box.insertAdjacentHTML("afterbegin",s);
  const svg=box.querySelector("svg"), tip=$("ev-tip"), xh=$("ev-xh");
  const show=evt=>{ const r=svg.getBoundingClientRect(); const vx=(evt.clientX-r.left)/r.width*W; const i=Math.max(0,Math.min(n-1,Math.round((vx-L)/((W-L-R)/(n-1)))));
    xh.setAttribute("x1",x(i)); xh.setAttribute("x2",x(i)); xh.style.opacity=1; const st=evStats(ex[i]);
    tip.innerHTML="<b></b><div></div><div></div><div></div>"; const d=tip.querySelectorAll("div");
    tip.querySelector("b").textContent=evName(ex[i]); d[0].textContent=ex[i].detail; d[1].textContent="Hidden tests "+st.pct.toFixed(0)+"% · spread "+st.spread.toFixed(0)+" pts"; d[2].textContent="Major findings "+st.major.toFixed(1)+"/run · interventions "+st.human;
    const px=x(i)/W*r.width; tip.style.left=Math.max(0,Math.min(px+12,r.width-260))+"px"; tip.style.top="40px"; tip.style.opacity=1; };
  svg.querySelector("#ev-hit").addEventListener("pointermove",show);
  svg.querySelector("#ev-hit").addEventListener("pointerleave",()=>{ tip.style.opacity=0; xh.style.opacity=0; });
  const ht=$("ev-histtable"); ht.innerHTML="<thead><tr><th>Exam</th><th>Why it ran</th><th>Hidden tests</th><th>Spread</th><th>Major findings / run</th><th>Interventions</th></tr></thead>";
  const tb=document.createElement("tbody"); ex.forEach(e=>{ const st=evStats(e); const tr=document.createElement("tr");
    [evName(e),e.detail,st.pct.toFixed(0)+"%",st.spread.toFixed(0)+" pts",st.major.toFixed(1),String(st.human)].forEach(t=>{ const td=document.createElement("td"); td.textContent=t; tr.append(td); }); tb.append(tr); }); ht.append(tb);
}
(function initEvals(){
  ["ev-a","ev-b"].forEach((id,k)=>{ const sel=$(id); EV.exams.slice().reverse().forEach(e=>{ const o=document.createElement("option"); o.value=e.id; o.textContent=evName(e); sel.append(o); });
    sel.value=k===0?EV.exams[EV.exams.length-1].id:EV.exams[EV.exams.length-2].id; sel.addEventListener("change",renderEvals); });
  renderEvals();
  let lastW=0; const draw=()=>{ const w=$("ev-chart").clientWidth; if(w&&w!==lastW){ lastW=w; renderEvalChart(); } };
  new ResizeObserver(draw).observe($("ev-chart"));
})();
