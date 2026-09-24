(() => {
  const root = document.getElementById("app");
  const pool = window.HAM_POOL;
  const SUPABASE_URL = "https://lrgpcfopvnpvasjkcbbz.supabase.co";
  const SUPABASE_KEY = "sb_publishable_7vx12v9ykwNuLkzKf65Y5Q_QAfu8GpW";
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const state = {
    learner: null,
    teacher: false,
    attempts: [],
    points: 0,
    teamScores: [],
    view: "loading",
    section: null,
    group: null,
    qIndex: 0,
    session: []
  };

  const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
  const groupQuestions = g => pool.questions.filter(x => x.group === g);

  function showMessage(text, type="info") {
    const box = document.getElementById("message");
    if (!box) return;
    box.className = "feedback";
    if (type === "error") box.style.background = "#fff1f1";
    else if (type === "success") box.style.background = "#edf8f2";
    else box.style.background = "#eef3f7";
    box.textContent = text;
  }

  async function bootstrap() {
    state.view = "loading";
    render();
    const { data: { session } } = await db.auth.getSession();
    if (!session) {
      state.view = "login";
      return render();
    }

    const { data: teacherRows } = await db
      .from("teachers")
      .select("auth_user_id,display_name")
      .limit(1);

    if (teacherRows && teacherRows.length) {
      state.teacher = true;
      state.view = "teacher";
      return render();
    }

    const { data: profileRows } = await db.rpc("get_my_profile");
    if (profileRows && profileRows.length) {
      state.learner = profileRows[0];
      await loadLearnerStats();
      state.view = "home";
      return render();
    }

    await db.auth.signOut();
    state.view = "login";
    render();
  }

  async function loadLearnerStats() {
    if (!state.learner) return;
    const [attemptsRes, pointsRes, scoresRes] = await Promise.all([
      db.from("attempts").select("question_id,subgroup,section,correct,mode,attempted_at").eq("learner_id", state.learner.learner_id).order("attempted_at", {ascending:false}),
      db.from("points_ledger").select("points,reason,created_at").eq("learner_id", state.learner.learner_id),
      db.rpc("get_team_scores")
    ]);
    state.attempts = attemptsRes.data || [];
    state.points = (pointsRes.data || []).reduce((n, x) => n + Number(x.points || 0), 0);
    state.teamScores = scoresRes.data || [];
  }

  function streakDays() {
    const days = [...new Set(state.attempts.map(a => new Date(a.attempted_at).toISOString().slice(0,10)))].sort().reverse();
    if (!days.length) return 0;
    let streak = 0;
    const today = new Date();
    today.setHours(0,0,0,0);
    for (let i=0;i<days.length;i++) {
      const d = new Date(days[i] + "T00:00:00");
      const expected = new Date(today);
      expected.setDate(today.getDate() - i);
      const diff = Math.abs(d - expected);
      if (diff <= 36e5) streak++;
      else if (i===0) {
        expected.setDate(expected.getDate()-1);
        if (Math.abs(d-expected)<=36e5) { streak++; today.setDate(today.getDate()-1); }
        else break;
      } else break;
    }
    return streak;
  }

  function masteredCount() {
    const by = {};
    state.attempts.forEach(a => {
      by[a.subgroup] ||= {c:0,n:0};
      by[a.subgroup].n++;
      if (a.correct) by[a.subgroup].c++;
    });
    return Object.values(by).filter(x => x.n >= 3 && x.c/x.n >= .8).length;
  }

  function renderLoading() {
    root.innerHTML = '<div class="login panel"><h2>Connecting to Mission Control…</h2><p class="muted">Loading your account.</p></div>';
  }

  function renderLogin() {
    root.innerHTML = `<div class="login panel">
      <span class="badge">Student / Parent Login</span>
      <h2 style="margin-top:10px">Enter Mission Control</h2>
      <p class="muted">Enter the first name and PIN your teacher gave you.</p>
      <form id="loginForm">
        <label class="field">First name<input id="name" autocomplete="given-name" required maxlength="30"></label>
        <label class="field">PIN<input id="pin" inputmode="numeric" pattern="[0-9]{4,6}" placeholder="4-6 digits" required></label>
        <button class="btn" type="submit">Start practicing</button>
      </form>
      <div id="message" class="notice">Your practice progress will be saved automatically.</div>
    </div>`;

    document.getElementById("loginForm").addEventListener("submit", async e => {
      e.preventDefault();
      const name = document.getElementById("name").value.trim();
      const pin = document.getElementById("pin").value.trim();
      const submit = e.submitter;
      submit.disabled = true;
      showMessage("Signing in…");

      await db.auth.signOut();
      const anon = await db.auth.signInAnonymously();
      if (anon.error) {
        submit.disabled = false;
        return showMessage("Could not start the secure session. " + anon.error.message, "error");
      }

      const result = await db.rpc("login_learner", { p_first_name: name, p_pin: pin });
      if (result.error || !result.data || !result.data.length) {
        await db.auth.signOut();
        submit.disabled = false;
        return showMessage("That name/PIN combination was not found.", "error");
      }

      state.learner = result.data[0];
      state.teacher = false;
      await loadLearnerStats();
      state.view = "home";
      render();
    });
  }

  function scoreboard() {
    const lookup = Object.fromEntries(state.teamScores.map(x => [x.team, x]));
    const score = team => Number(lookup[team]?.points_per_member || 0);
    const members = team => Number(lookup[team]?.active_members || 0);
    const kidsMembers = members("boys") + members("girls");
    const kidsTotal = Number(lookup.boys?.total_points || 0) + Number(lookup.girls?.total_points || 0);
    const kidsAvg = kidsMembers ? kidsTotal / kidsMembers : 0;
    const parentsAvg = score("parents");

    return `<div class="panel"><h3>Team Challenge</h3><div class="scoreboard">
      <div class="team"><span>Boys</span><strong>${score("boys").toFixed(1)}</strong></div>
      <div class="team"><span>Girls</span><strong>${score("girls").toFixed(1)}</strong></div>
      <div class="team"><span>Parents</span><strong>${score("parents").toFixed(1)}</strong></div>
      <div class="kids-vs-parents"><b>Kids vs. Parents</b>
        <div class="team"><span>Kids</span><strong>${kidsAvg.toFixed(1)}</strong></div>
        <div class="team"><span>Parents</span><strong>${parentsAvg.toFixed(1)}</strong></div>
      </div>
      <div class="notice">Team score = points per active member, so larger teams do not get an automatic advantage.</div>
    </div></div>`;
  }

  function renderHome() {
    const teamLabel = ({boys:"Boys",girls:"Girls",parents:"Parents"})[state.learner.team] || state.learner.team;
    root.innerHTML = `<div class="hero">
      <div class="panel"><div class="toolbar"><span class="badge">${esc(teamLabel)} Team</span><button id="logout" class="btn alt">Log out</button></div>
        <h2>Welcome, ${esc(state.learner.first_name)}!</h2>
        <p class="muted">Choose a section, practice a smaller subgroup, or work toward your Technician exam.</p>
        <div class="stats">
          <div class="stat"><b>${state.points}</b>Points</div>
          <div class="stat"><b>${streakDays()}</b>Day streak</div>
          <div class="stat"><b>${state.attempts.length}</b>Answered</div>
          <div class="stat"><b>${masteredCount()}</b>Mastered</div>
        </div>
      </div>${scoreboard()}</div>

      <div class="toolbar" style="margin-top:24px">
        <div><h2 style="margin:0">Choose Your Mission</h2><span class="muted">Current 2026-2030 pool: ${pool.meta.totalQuestions} questions</span></div>
        <button id="examBtn" class="btn">35-Question Practice Exam</button>
      </div>
      <div class="grid">${pool.sections.map(s => `<article class="card section-card" data-section="${s.id}">
        <div class="section-code">${s.id}</div><div class="section-title">${s.title}</div><span class="chip">${s.groups.length} groups</span>
      </article>`).join("")}</div>`;

    document.getElementById("logout").onclick = async () => {
      await db.auth.signOut();
      state.learner = null;
      state.attempts = [];
      state.points = 0;
      state.view = "login";
      render();
    };
    root.querySelectorAll("[data-section]").forEach(el => el.addEventListener("click", () => {
      state.section = el.dataset.section;
      state.view = "section";
      render();
    }));
    document.getElementById("examBtn").addEventListener("click", () => {
      alert("The real 35-question exam activates after the complete official 409-question pool is imported.");
    });
  }

  function renderSection() {
    const sec = pool.sections.find(s => s.id === state.section);
    root.innerHTML = `<div class="toolbar"><button id="back" class="btn alt">← All sections</button><span class="badge">${sec.id}</span></div>
      <div class="panel"><h2>${sec.id} — ${sec.title}</h2><p class="muted">Choose one smaller subgroup to practice.</p>
      <div class="grid">${sec.groups.map(g => {
        const n = groupQuestions(g).length;
        const mine = state.attempts.filter(a => a.subgroup === g);
        const accuracy = mine.length ? Math.round(100 * mine.filter(a => a.correct).length / mine.length) : null;
        return `<article class="card section-card" data-group="${g}">
          <div class="section-code">${g}</div>
          <div class="section-title">${n ? n+" questions loaded" : "Question import pending"}</div>
          <span class="chip">${accuracy===null ? "Not started" : accuracy+"% practice accuracy"}</span>
        </article>`;
      }).join("")}</div></div>`;

    document.getElementById("back").onclick = () => { state.view = "home"; render(); };
    root.querySelectorAll("[data-group]").forEach(el => el.onclick = () => {
      const qs = groupQuestions(el.dataset.group);
      if (!qs.length) {
        alert("This subgroup is ready in the menu; its official questions are being imported next.");
        return;
      }
      state.group = el.dataset.group;
      state.session = [...qs].sort(() => Math.random() - .5);
      state.qIndex = 0;
      state.view = "practice";
      render();
    });
  }

  function renderPractice() {
    const q = state.session[state.qIndex], total = state.session.length;
    root.innerHTML = `<div class="toolbar"><button id="back" class="btn alt">← ${state.section}</button>
      <div><b>${state.group}</b> <span class="muted">Question ${state.qIndex+1} of ${total}</span></div></div>
      <div class="progress"><span style="width:${((state.qIndex)/total)*100}%"></span></div>
      <div class="panel" style="margin-top:14px">
        <div class="question">${esc(q.q)}</div>
        <div id="answers" class="answer-list">${q.a.map((a,i) => `<button class="answer" data-i="${i}"><b>${String.fromCharCode(65+i)}.</b> ${esc(a)}</button>`).join("")}</div>
        <div id="fb"></div>
      </div>`;

    document.getElementById("back").onclick = () => { state.view = "section"; render(); };
    root.querySelectorAll(".answer").forEach(btn => btn.onclick = () => answerQuestion(q, Number(btn.dataset.i)));
  }

  async function answerQuestion(q, choice) {
    const correct = choice === q.correct;
    root.querySelectorAll(".answer").forEach((b,i) => {
      b.disabled = true;
      if (i === q.correct) b.classList.add("correct");
      else if (i === choice) b.classList.add("wrong");
    });

    const save = await db.from("attempts").insert({
      learner_id: state.learner.learner_id,
      question_id: q.id,
      section: q.group.slice(0,2),
      subgroup: q.group,
      correct,
      mode: "practice"
    });

    if (!save.error) {
      state.attempts.unshift({
        question_id:q.id, section:q.group.slice(0,2), subgroup:q.group,
        correct, mode:"practice", attempted_at:new Date().toISOString()
      });
    }

    const fb = document.getElementById("fb");
    fb.className = "feedback";
    fb.innerHTML = `<b>${correct ? "✓ Correct!" : "Not quite."}</b> ${esc(q.explain)}
      ${save.error ? '<div class="notice">Your answer could not be saved: '+esc(save.error.message)+'</div>' : ''}
      <div style="margin-top:10px"><button id="next" class="btn">${state.qIndex+1 < state.session.length ? "Next question" : "Finish subgroup"}</button></div>`;

    document.getElementById("next").onclick = async () => {
      if (state.qIndex+1 < state.session.length) {
        state.qIndex++;
        render();
      } else {
        await loadLearnerStats();
        state.view = "section";
        render();
      }
    };
  }

  function renderTeacherLogin() {
    root.innerHTML = `<div class="login panel">
      <span class="badge">Teacher Login</span><h2 style="margin-top:10px">Teacher Dashboard</h2>
      <form id="teacherLogin">
        <label class="field">Email<input id="email" type="email" autocomplete="email" required></label>
        <label class="field">Password<input id="password" type="password" autocomplete="current-password" required></label>
        <button class="btn" type="submit">Sign in</button>
      </form>
      <div id="message" class="notice">Use the teacher account you created in Supabase.</div>
      <div style="margin-top:14px"><button id="studentBack" class="btn alt">Student / Parent Login</button></div>
    </div>`;

    document.getElementById("studentBack").onclick = async () => {
      await db.auth.signOut();
      state.view = "login";
      render();
    };

    document.getElementById("teacherLogin").addEventListener("submit", async e => {
      e.preventDefault();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      e.submitter.disabled = true;
      showMessage("Signing in…");
      await db.auth.signOut();
      const auth = await db.auth.signInWithPassword({ email, password });
      if (auth.error) {
        e.submitter.disabled = false;
        return showMessage(auth.error.message, "error");
      }

      const check = await db.from("teachers").select("auth_user_id,display_name").limit(1);
      if (check.error || !check.data || !check.data.length) {
        await db.auth.signOut();
        e.submitter.disabled = false;
        return showMessage("This account is not marked as a teacher yet.", "error");
      }

      state.teacher = true;
      state.view = "teacher";
      render();
    });
  }

  async function renderTeacher() {
    root.innerHTML = '<div class="login panel"><h2>Loading teacher dashboard…</h2></div>';

    const [learnersRes, attemptsRes, pointsRes, scoresRes] = await Promise.all([
      db.from("learners").select("id,first_name,team,active,created_at").order("team").order("first_name"),
      db.from("attempts").select("learner_id,correct,attempted_at"),
      db.from("points_ledger").select("learner_id,points,reason,source,created_at"),
      db.rpc("get_team_scores")
    ]);

    if (learnersRes.error) {
      root.innerHTML = `<div class="panel"><h2>Teacher Dashboard</h2><div class="feedback">Could not load teacher data: ${esc(learnersRes.error.message)}</div><button id="logoutTeacher" class="btn">Log out</button></div>`;
      document.getElementById("logoutTeacher").onclick = async () => { await db.auth.signOut(); state.teacher=false; state.view="login"; render(); };
      return;
    }

    const learners = learnersRes.data || [];
    const attempts = attemptsRes.data || [];
    const ledger = pointsRes.data || [];
    state.teamScores = scoresRes.data || [];

    const counts = team => learners.filter(l => l.team===team && l.active).length;
    const weekAgo = Date.now() - 7*864e5;
    const weekAttempts = attempts.filter(a => new Date(a.attempted_at).getTime() >= weekAgo).length;
    const learnerRows = learners.map(l => {
      const la = attempts.filter(a => a.learner_id===l.id);
      const lp = ledger.filter(p => p.learner_id===l.id).reduce((n,p)=>n+Number(p.points||0),0);
      const accuracy = la.length ? Math.round(100*la.filter(a=>a.correct).length/la.length) : 0;
      return `<div class="card">
        <div class="toolbar"><div><b>${esc(l.first_name)}</b><div class="muted">${esc(l.team)}</div></div><span class="badge">${lp} pts</span></div>
        <div class="muted">${la.length} answered • ${accuracy}% accuracy</div>
        <div class="subnav">
          <button class="subbtn bonusBtn" data-id="${l.id}" data-name="${esc(l.first_name)}">+ Bonus</button>
          <button class="subbtn pinBtn" data-id="${l.id}" data-name="${esc(l.first_name)}">Reset PIN</button>
        </div>
      </div>`;
    }).join("");

    root.innerHTML = `<div class="toolbar"><div><span class="badge">Teacher</span><h2 style="margin:6px 0 0">Teacher Dashboard</h2></div><button id="logoutTeacher" class="btn alt">Log out</button></div>
      <div class="stats">
        <div class="stat"><b>${counts("boys")}</b>Boys</div>
        <div class="stat"><b>${counts("girls")}</b>Girls</div>
        <div class="stat"><b>${counts("parents")}</b>Parents</div>
        <div class="stat"><b>${weekAttempts}</b>Questions this week</div>
      </div>

      <div class="hero" style="margin-top:18px">
        <div class="panel">
          <h3>Add Learner</h3>
          <form id="addLearner">
            <label class="field">First name<input id="newName" required maxlength="30"></label>
            <label class="field">PIN<input id="newPin" inputmode="numeric" pattern="[0-9]{4,6}" placeholder="4-6 digits" required></label>
            <label class="field">Team<select id="newTeam"><option value="boys">Boys</option><option value="girls">Girls</option><option value="parents">Parents</option></select></label>
            <button class="btn" type="submit">Add learner</button>
          </form>
          <div id="message" class="notice">PINs are hashed in the database rather than stored as readable numbers.</div>
        </div>
        ${scoreboard()}
      </div>

      <div class="toolbar" style="margin-top:24px"><h3 style="margin:0">Roster</h3><span class="muted">${learners.length} total accounts</span></div>
      <div class="grid">${learnerRows || '<div class="card muted">No learners yet. Add the first one above.</div>'}</div>`;

    document.getElementById("logoutTeacher").onclick = async () => {
      await db.auth.signOut();
      state.teacher=false;
      state.view="login";
      render();
    };

    document.getElementById("addLearner").addEventListener("submit", async e => {
      e.preventDefault();
      const args = {
        p_first_name: document.getElementById("newName").value.trim(),
        p_pin: document.getElementById("newPin").value.trim(),
        p_team: document.getElementById("newTeam").value
      };
      e.submitter.disabled=true;
      const r=await db.rpc("create_learner",args);
      if(r.error){e.submitter.disabled=false;return showMessage(r.error.message,"error");}
      showMessage("Learner added!","success");
      setTimeout(()=>renderTeacher(),500);
    });

    root.querySelectorAll(".bonusBtn").forEach(b=>b.onclick=async()=>{
      const pts=Number(prompt("Bonus points for "+b.dataset.name+":","5"));
      if(!Number.isFinite(pts)||pts===0)return;
      const reason=prompt("Reason for the bonus:","Teacher bonus")||"Teacher bonus";
      const r=await db.rpc("teacher_bonus_points",{p_learner_id:b.dataset.id,p_points:Math.round(pts),p_reason:reason});
      if(r.error) alert(r.error.message); else renderTeacher();
    });

    root.querySelectorAll(".pinBtn").forEach(b=>b.onclick=async()=>{
      const pin=prompt("New 4-6 digit PIN for "+b.dataset.name+":","");
      if(pin===null)return;
      const r=await db.rpc("teacher_reset_pin",{p_learner_id:b.dataset.id,p_new_pin:pin.trim()});
      if(r.error) alert(r.error.message); else alert("PIN updated.");
    });
  }

  document.getElementById("teacherBtn").addEventListener("click", async () => {
    const { data:{session} } = await db.auth.getSession();
    if (session) await db.auth.signOut();
    state.teacher=false;
    state.learner=null;
    state.view="teacherLogin";
    render();
  });

  function render() {
    if (state.view==="loading") renderLoading();
    else if (state.view==="login") renderLogin();
    else if (state.view==="home") renderHome();
    else if (state.view==="section") renderSection();
    else if (state.view==="practice") renderPractice();
    else if (state.view==="teacherLogin") renderTeacherLogin();
    else if (state.view==="teacher") renderTeacher();
  }

  bootstrap();
})();