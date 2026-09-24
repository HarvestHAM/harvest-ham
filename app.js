(() => {
  const root=document.getElementById("app"), pool=window.HAM_POOL;
  const state={user:null,team:null,points:0,streak:0,attempts:[],view:"login",section:null,group:null,qIndex:0,session:[]};
  const teams={boys:{label:"Boys",points:0,members:0},girls:{label:"Girls",points:0,members:0},parents:{label:"Parents",points:0,members:0}};
  const esc=s=>String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  const groupQuestions=g=>pool.questions.filter(x=>x.group===g);
  const sectionQuestions=s=>pool.questions.filter(x=>x.group.startsWith(s));

  function renderLogin(){
    root.innerHTML=`<div class="login panel">
      <span class="badge">Student / Parent Login</span>
      <h2 style="margin-top:10px">Enter Mission Control</h2>
      <p class="muted">Use your first name and simple PIN. This prototype stores progress only in this browser until the database is connected.</p>
      <form id="loginForm">
        <label class="field">First name<input id="name" autocomplete="given-name" required maxlength="30"></label>
        <label class="field">PIN<input id="pin" inputmode="numeric" pattern="[0-9]{4,6}" placeholder="4-6 digits" required></label>
        <label class="field">Team<select id="team"><option value="boys">Boys</option><option value="girls">Girls</option><option value="parents">Parents</option></select></label>
        <button class="btn" type="submit">Start practicing</button>
      </form>
      <div class="notice">Teacher accounts and secure PIN verification will be enabled when Supabase is connected.</div>
    </div>`;
    document.getElementById("loginForm").addEventListener("submit",e=>{e.preventDefault();state.user=document.getElementById("name").value.trim();state.team=document.getElementById("team").value;state.view="home";render();});
  }

  function scoreboard(){
    const kid=(teams.boys.points+teams.girls.points)/Math.max(1,teams.boys.members+teams.girls.members);
    const par=teams.parents.points/Math.max(1,teams.parents.members);
    return `<div class="panel"><h3>Team Challenge</h3><div class="scoreboard">
      ${Object.entries(teams).map(([k,t])=>`<div class="team"><span>${t.label}</span><strong>${Math.round(t.points/Math.max(1,t.members))}</strong></div>`).join("")}
      <div class="kids-vs-parents"><b>Kids vs. Parents</b><div class="team"><span>Kids</span><strong>${Math.round(kid)}</strong></div><div class="team"><span>Parents</span><strong>${Math.round(par)}</strong></div></div>
    </div></div>`;
  }

  function renderHome(){
    root.innerHTML=`<div class="hero">
      <div class="panel"><span class="badge">${esc(teams[state.team].label)} Team</span><h2 style="margin-top:10px">Welcome, ${esc(state.user)}!</h2>
        <p class="muted">Choose a section, practice a small subgroup, or take a full Technician practice exam.</p>
        <div class="stats"><div class="stat"><b>${state.points}</b>Points</div><div class="stat"><b>${state.streak}</b>Day streak</div><div class="stat"><b>${state.attempts.length}</b>Answered</div><div class="stat"><b>0</b>Mastered</div></div>
      </div>${scoreboard()}</div>
      <div class="toolbar" style="margin-top:24px"><div><h2 style="margin:0">Choose Your Mission</h2><span class="muted">Current pool: ${pool.meta.totalQuestions} questions</span></div>
        <button id="examBtn" class="btn">35-Question Practice Exam</button></div>
      <div class="grid">${pool.sections.map(s=>`<article class="card section-card" data-section="${s.id}"><div class="section-code">${s.id}</div><div class="section-title">${s.title}</div><span class="chip">${s.groups.length} groups</span></article>`).join("")}</div>`;
    root.querySelectorAll("[data-section]").forEach(el=>el.addEventListener("click",()=>{state.section=el.dataset.section;state.view="section";render();}));
    document.getElementById("examBtn").addEventListener("click",()=>alert("Exam mode is wired into the interface; it will activate when the complete 409-question import is added."));
  }

  function renderSection(){
    const sec=pool.sections.find(s=>s.id===state.section);
    root.innerHTML=`<div class="toolbar"><button id="back" class="btn alt">← All sections</button><span class="badge">${sec.id}</span></div>
      <div class="panel"><h2>${sec.id} — ${sec.title}</h2><p class="muted">Choose one small subgroup to practice.</p>
      <div class="grid">${sec.groups.map(g=>{const n=groupQuestions(g).length;return `<article class="card section-card" data-group="${g}"><div class="section-code">${g}</div><div class="section-title">${n?n+" questions loaded":"Question import pending"}</div><span class="chip">Practice subgroup</span></article>`}).join("")}</div></div>`;
    document.getElementById("back").onclick=()=>{state.view="home";render()};
    root.querySelectorAll("[data-group]").forEach(el=>el.onclick=()=>{const qs=groupQuestions(el.dataset.group);if(!qs.length){alert("This subgroup is ready in the navigation; its official questions are being imported next.");return;}state.group=el.dataset.group;state.session=[...qs];state.qIndex=0;state.view="practice";render();});
  }

  function renderPractice(){
    const q=state.session[state.qIndex], total=state.session.length;
    root.innerHTML=`<div class="toolbar"><button id="back" class="btn alt">← ${state.section}</button><div><b>${state.group}</b> <span class="muted">Question ${state.qIndex+1} of ${total}</span></div></div>
      <div class="progress"><span style="width:${((state.qIndex)/total)*100}%"></span></div>
      <div class="panel" style="margin-top:14px"><div class="question">${esc(q.q)}</div><div id="answers" class="answer-list">${q.a.map((a,i)=>`<button class="answer" data-i="${i}"><b>${String.fromCharCode(65+i)}.</b> ${esc(a)}</button>`).join("")}</div><div id="fb"></div></div>`;
    document.getElementById("back").onclick=()=>{state.view="section";render()};
    root.querySelectorAll(".answer").forEach(btn=>btn.onclick=()=>answerQuestion(q,Number(btn.dataset.i)));
  }

  function answerQuestion(q,choice){
    const correct=choice===q.correct;
    state.attempts.push({id:q.id,correct,at:Date.now()});
    if(correct) state.points+=1;
    root.querySelectorAll(".answer").forEach((b,i)=>{b.disabled=true;if(i===q.correct)b.classList.add("correct");else if(i===choice)b.classList.add("wrong")});
    const fb=document.getElementById("fb");
    fb.className="feedback";
    fb.innerHTML=`<b>${correct?"✓ Correct!":"Not quite."}</b> ${esc(q.explain)}<div style="margin-top:10px"><button id="next" class="btn">${state.qIndex+1<state.session.length?"Next question":"Finish subgroup"}</button></div>`;
    document.getElementById("next").onclick=()=>{if(state.qIndex+1<state.session.length){state.qIndex++;render()}else{state.view="section";render()}};
  }

  function renderTeacher(){
    root.innerHTML=`<div class="toolbar"><button id="back" class="btn alt">← Back</button><span class="badge">Teacher prototype</span></div>
    <div class="panel"><h2>Teacher Dashboard</h2><p class="muted">This is the dashboard structure that will become live when Supabase is connected.</p>
    <div class="stats"><div class="stat"><b>0</b>Boys active</div><div class="stat"><b>0</b>Girls active</div><div class="stat"><b>0</b>Parents active</div><div class="stat"><b>0</b>Questions this week</div></div>
    <h3 style="margin-top:24px">Controls</h3><div class="grid"><div class="card"><b>+ Add learner</b><p class="muted">First name, PIN, team.</p></div><div class="card"><b>+ Bonus points</b><p class="muted">Manual rewards.</p></div><div class="card"><b>Reset PIN</b><p class="muted">Teacher-only control.</p></div><div class="card"><b>Progress detail</b><p class="muted">Accuracy, streaks, mastered groups, missed questions.</p></div></div></div>`;
    document.getElementById("back").onclick=()=>{state.view=state.user?"home":"login";render()};
  }

  document.getElementById("teacherBtn").addEventListener("click",()=>{state.view="teacher";render()});
  function render(){ if(state.view==="login")renderLogin(); else if(state.view==="home")renderHome(); else if(state.view==="section")renderSection(); else if(state.view==="practice")renderPractice(); else if(state.view==="teacher")renderTeacher(); }
  render();
})();