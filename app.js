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
    examResults: [],
    points: 0,
    teamScores: [],
    view: "loading",
    section: null,
    group: null,
    mode: "practice",
    qIndex: 0,
    session: [],
    sessionCorrect: 0,
    examAnswers: [],
    examResult: null
  };

  const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[m]));
  const shuffle = list => {
    const a = [...list];
    for (let i=a.length-1;i>0;i--) {
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  };
  const groupQuestions = g => pool.questions.filter(x => x.group === g);
  const questionById = id => pool.questions.find(x => x.id === id);
  const allGroups = () => pool.sections.flatMap(x => x.groups);

  function sectionIcon(id) {
    const common='viewBox="0 0 48 48" aria-hidden="true" class="section-icon-svg"';
    const icons = {
      T1: `<svg ${common}><path d="M24 5l14 6v10c0 10-5.8 17.3-14 22-8.2-4.7-14-12-14-22V11l14-6z"/><path d="M18 20h12M18 26h12M21 14h6"/></svg>`,
      T2: `<svg ${common}><rect x="16" y="7" width="16" height="25" rx="8"/><path d="M11 24c0 7.2 5.8 13 13 13s13-5.8 13-13M24 37v6M17 43h14"/></svg>`,
      T3: `<svg ${common}><path d="M5 24c4-8 8-8 12 0s8 8 12 0 8-8 14 0"/><path d="M8 13c3-4 6-4 9 0M31 35c3-4 6-4 9 0"/></svg>`,
      T4: `<svg ${common}><rect x="7" y="9" width="34" height="30" rx="4"/><circle cx="16" cy="20" r="4"/><circle cx="32" cy="20" r="4"/><path d="M13 31h22M18 31v5M30 31v5"/></svg>`,
      T5: `<svg ${common}><path d="M28 4L14 26h10l-4 18 14-24H24l4-16z"/></svg>`,
      T6: `<svg ${common}><rect x="12" y="12" width="24" height="24" rx="3"/><path d="M18 18h12v12H18zM12 7v5M20 7v5M28 7v5M36 7v5M12 36v5M20 36v5M28 36v5M36 36v5M7 12h5M7 20h5M7 28h5M7 36h5M36 12h5M36 20h5M36 28h5M36 36h5"/></svg>`,
      T7: `<svg ${common}><path d="M7 14h10l4 7h8l4-7h8M7 34h10l4-7h8l4 7h8"/><circle cx="7" cy="14" r="2"/><circle cx="41" cy="14" r="2"/><circle cx="7" cy="34" r="2"/><circle cx="41" cy="34" r="2"/></svg>`,
      T8: `<svg ${common}><path d="M5 25h6l3-9 5 18 5-25 5 31 5-15h9"/><path d="M7 8h34M7 40h34"/></svg>`,
      T9: `<svg ${common}><path d="M24 10v33M17 43h14M14 18l10-8 10 8"/><path d="M11 13c-6 6-6 16 0 22M37 13c6 6 6 16 0 22M7 8c-10 10-10 24 0 34M41 8c10 10 10 24 0 34"/></svg>`,
      T0: `<svg ${common}><path d="M24 5l15 6v11c0 10-6 17-15 21C15 39 9 32 9 22V11l15-6z"/><path d="M24 14v12M24 33v1"/></svg>`
    };
    return icons[id] || icons.T4;
  }

  function radioHeroGraphic() {
    return `<div class="radio-hero-art" aria-hidden="true">
      <svg viewBox="0 0 320 210">
        <g class="tower-lines">
          <path d="M160 30v142M138 172h44M146 172l14-54 14 54M148 112h24"/>
          <path d="M132 54c-26 24-26 58 0 82M188 54c26 24 26 58 0 82"/>
          <path d="M112 34c-40 38-40 88 0 126M208 34c40 38 40 88 0 126"/>
        </g>
        <g class="console-lines">
          <rect x="48" y="150" width="84" height="42" rx="6"/>
          <circle cx="65" cy="171" r="8"/>
          <path d="M82 165h34M82 173h24M82 181h29"/>
          <rect x="188" y="150" width="84" height="42" rx="6"/>
          <path d="M202 171h13l5-10 8 20 8-17 7 7h15"/>
        </g>
        <circle class="signal-node" cx="160" cy="30" r="5"/>
      </svg>
      <div class="hero-frequency">146.520 MHz</div>
      <div class="hero-caption">LEARN • PRACTICE • TRANSMIT</div>
    </div>`;
  }

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
    const [attemptsRes, pointsRes, scoresRes, examsRes] = await Promise.all([
      db.from("attempts").select("question_id,subgroup,section,correct,mode,attempted_at").eq("learner_id", state.learner.learner_id).order("attempted_at", {ascending:false}),
      db.from("points_ledger").select("points,reason,created_at").eq("learner_id", state.learner.learner_id),
      db.rpc("get_team_scores"),
      db.from("exam_results").select("id,score,total,passed,completed_at").eq("learner_id", state.learner.learner_id).order("completed_at", {ascending:false})
    ]);
    state.attempts = attemptsRes.data || [];
    state.points = (pointsRes.data || []).reduce((n, x) => n + Number(x.points || 0), 0);
    state.teamScores = scoresRes.data || [];
    state.examResults = examsRes.data || [];
  }


  function latestAttemptMap(filterGroup=null) {
    const map = new Map();
    for (const a of state.attempts) {
      if (filterGroup && a.subgroup !== filterGroup) continue;
      if (!map.has(a.question_id)) map.set(a.question_id, a);
    }
    return map;
  }

  function groupProgress(group) {
    const total = groupQuestions(group).length;
    const latest = latestAttemptMap(group);
    let correct = 0;
    for (const a of latest.values()) if (a.correct) correct++;
    const attempted = latest.size;
    const percent = total ? Math.round(100 * correct / total) : 0;
    return {
      total,
      attempted,
      correct,
      percent,
      complete: total > 0 && attempted >= total,
      mastered: total > 0 && attempted >= total && percent >= 80,
      perfect: total > 0 && attempted >= total && correct >= total
    };
  }

  function masteredCount() {
    return allGroups().filter(g => groupProgress(g).mastered).length;
  }

  function currentMissedQuestions() {
    const latest = latestAttemptMap();
    return [...latest.entries()]
      .filter(([,a]) => !a.correct)
      .map(([id]) => questionById(id))
      .filter(Boolean);
  }

  function streakDays() {
    const days = [...new Set(state.attempts.map(a => new Date(a.attempted_at).toISOString().slice(0,10)))].sort().reverse();
    if (!days.length) return 0;
    const dayMs = 86400000;
    const today = new Date();
    today.setUTCHours(0,0,0,0);
    const first = new Date(days[0] + "T00:00:00Z");
    const firstGap = Math.round((today - first) / dayMs);
    if (firstGap > 1) return 0;
    let streak = 1;
    let prev = first;
    for (let i=1;i<days.length;i++) {
      const d = new Date(days[i] + "T00:00:00Z");
      const gap = Math.round((prev - d) / dayMs);
      if (gap === 1) { streak++; prev = d; }
      else break;
    }
    return streak;
  }

  function bestExam() {
    if (!state.examResults.length) return null;
    return Math.max(...state.examResults.map(x => Number(x.score || 0)));
  }

  function questionFigure(q) {
    if (!q.figure) return "";
    return `<div class="figure-wrap"><img src="${esc(q.figure)}" alt="Diagram for ${esc(q.id)}" class="question-figure"></div>`;
  }

  async function syncRewards(subgroup=null, groupTotal=null, sessionScore=null, sessionTotal=null) {
    const payload = {
      p_subgroup: subgroup,
      p_group_total: groupTotal,
      p_session_score: sessionScore,
      p_session_total: sessionTotal
    };
    const r = await db.rpc("sync_rewards", payload);
    if (r.error) return [];
    const row = Array.isArray(r.data) ? r.data[0] : r.data;
    return row?.messages || [];
  }


  function renderLoading() {
    root.innerHTML = '<div class="login panel"><h2>Connecting to Mission Control…</h2><p class="muted">Loading your account.</p></div>';
  }

  function renderLogin() {
    root.innerHTML = `<div class="login-shell">
      <div class="login panel mission-panel">
        <div class="login-copy">
          <span class="eyebrow">HARVEST HAM • TECHNICIAN TRAINING</span>
          <h2>Enter Mission Control</h2>
          <p class="muted">Build your radio knowledge one mission at a time. Enter the first name and PIN your teacher gave you.</p>
          <form id="loginForm">
            <label class="field">First name<input id="name" autocomplete="given-name" required maxlength="30"></label>
            <label class="field">PIN<input id="pin" inputmode="numeric" pattern="[0-9]{4,6}" placeholder="4-6 digits" required></label>
            <button class="btn mission-btn" type="submit"><span>Start Mission</span><span aria-hidden="true">→</span></button>
          </form>
          <div id="message" class="notice">Your practice progress will be saved automatically.</div>
        </div>
        <div class="login-visual">
          ${radioHeroGraphic()}
        </div>
      </div>
      <div class="login-footer-marks">
        <span>⌁ RADIO</span><span>◫ ELECTRONICS</span><span>⌁ SIGNALS</span><span>△ ANTENNAS</span>
      </div>
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
    const maxScore = Math.max(score("boys"),score("girls"),score("parents"),1);
    const row = (team,label,icon) => `<div class="signal-team team-${team}">
      <div class="team-label"><span class="team-icon">${icon}</span><span>${label}</span></div>
      <div class="signal-meter"><span style="width:${Math.max(6,Math.round(score(team)/maxScore*100))}%"></span></div>
      <strong>${score(team).toFixed(1)}</strong>
    </div>`;

    return `<div class="panel scoreboard-panel">
      <div class="scoreboard-heading"><div><span class="eyebrow">LIVE TEAM SIGNAL</span><h3>Team Challenge</h3></div><span class="signal-live"><i></i> ON AIR</span></div>
      <div class="scoreboard">
        ${row("boys","Boys","B")}
        ${row("girls","Girls","G")}
        ${row("parents","Parents","P")}
        <div class="kids-vs-parents">
          <div class="versus-title"><span>KIDS</span><b>VS</b><span>PARENTS</span></div>
          <div class="versus-scores"><strong>${kidsAvg.toFixed(1)}</strong><span class="radio-wave-mini">)))</span><strong>${parentsAvg.toFixed(1)}</strong></div>
        </div>
        <div class="notice">Scores are points per active team member, keeping the competition fair.</div>
      </div>
    </div>`;
  }

  function renderHome() {
    const teamLabel = ({boys:"Boys",girls:"Girls",parents:"Parents"})[state.learner.team] || state.learner.team;
    const missed = currentMissedQuestions();
    const best = bestExam();

    root.innerHTML = `<div class="hero">
      <div class="panel"><div class="toolbar"><span class="badge">${esc(teamLabel)} Team</span><button id="logout" class="btn alt">Log out</button></div>
        <h2>Welcome, ${esc(state.learner.first_name)}!</h2>
        <p class="muted">Choose a section, fix missed questions, or take a full Technician practice exam.</p>
        <div class="stats">
          <div class="stat"><b>${state.points}</b>Points</div>
          <div class="stat"><b>${streakDays()}</b>Day streak</div>
          <div class="stat"><b>${state.attempts.length}</b>Answered</div>
          <div class="stat"><b>${masteredCount()}</b>Mastered</div>
        </div>
        <div class="mission-actions">
          <button id="examBtn" class="btn">35-Question Practice Exam</button>
          <button id="missedBtn" class="btn alt" ${missed.length ? "" : "disabled"}>Practice Missed (${missed.length})</button>
        </div>
        <div class="notice">${best === null ? "No full practice exam yet." : `Best practice exam: ${best}/35`}</div>
      </div>${scoreboard()}</div>

      <div class="toolbar" style="margin-top:24px">
        <div><h2 style="margin:0">Choose Your Mission</h2><span class="muted">Current 2026-2030 pool: ${pool.meta.totalQuestions} questions</span></div>
      </div>
      <div class="grid">${pool.sections.map(s => {
        const mastered = s.groups.filter(g => groupProgress(g).mastered).length;
        return `<article class="card section-card" data-section="${s.id}">
          <div class="section-card-top"><div class="section-icon">${sectionIcon(s.id)}</div><div class="section-code">${s.id}</div></div>
          <div class="section-title">${s.title}</div>
          <span class="chip">${mastered}/${s.groups.length} groups mastered</span>
        </article>`;
      }).join("")}</div>`;

    document.getElementById("logout").onclick = async () => {
      await db.auth.signOut();
      state.learner = null;
      state.attempts = [];
      state.points = 0;
      state.view = "login";
      render();
    };

    document.getElementById("examBtn").onclick = startExam;
    document.getElementById("missedBtn").onclick = () => startMissed(missed);
    root.querySelectorAll("[data-section]").forEach(el => el.addEventListener("click", () => {
      state.section = el.dataset.section;
      state.view = "section";
      render();
    }));
  }


  function renderSection() {
    const sec = pool.sections.find(s => s.id === state.section);
    root.innerHTML = `<div class="toolbar"><button id="back" class="btn alt"><- All sections</button><span class="badge">${sec.id}</span></div>
      <div class="panel section-panel"><div class="section-heading"><div class="section-icon large">${sectionIcon(sec.id)}</div><div><span class="eyebrow">MISSION ${sec.id}</span><h2>${sec.id} - ${sec.title}</h2></div></div><p class="muted">Choose one smaller subgroup to practice. Mastery requires every question in the subgroup to be attempted and at least 80% correct on the latest attempt.</p>
      <div class="grid">${sec.groups.map(g => {
        const p = groupProgress(g);
        const status = p.perfect ? "Perfect" : p.mastered ? "Mastered" : p.attempted ? "In progress" : "Not started";
        return `<article class="card section-card" data-group="${g}">
          <div class="toolbar compact"><div class="section-code">${g}</div><span class="badge ${p.mastered ? "mastered" : ""}">${status}</span></div>
          <div class="section-title">${p.total} questions</div>
          <div class="mini-progress"><span style="width:${p.total ? Math.round(100*p.attempted/p.total) : 0}%"></span></div>
          <div class="card-meta">${p.attempted}/${p.total} attempted${p.attempted ? ` - ${p.percent}% latest accuracy` : ""}</div>
        </article>`;
      }).join("")}</div></div>`;

    document.getElementById("back").onclick = () => { state.view = "home"; render(); };
    root.querySelectorAll("[data-group]").forEach(el => el.onclick = () => startGroup(el.dataset.group));
  }


  function startGroup(group) {
    state.group = group;
    state.mode = "practice";
    state.session = shuffle(groupQuestions(group));
    state.qIndex = 0;
    state.sessionCorrect = 0;
    state.view = "practice";
    render();
  }

  function startMissed(missed=currentMissedQuestions()) {
    if (!missed.length) return;
    state.group = "MISSED";
    state.mode = "missed";
    state.session = shuffle(missed);
    state.qIndex = 0;
    state.sessionCorrect = 0;
    state.view = "practice";
    render();
  }

  function renderPractice() {
    const q = state.session[state.qIndex], total = state.session.length;
    const label = state.mode === "missed" ? "Missed Question Rescue" : state.group;
    root.innerHTML = `<div class="toolbar"><button id="back" class="btn alt"><- ${state.mode === "missed" ? "Home" : state.section}</button>
      <div><b>${esc(label)}</b> <span class="muted">Question ${state.qIndex+1} of ${total}</span></div></div>
      <div class="progress"><span style="width:${((state.qIndex)/total)*100}%"></span></div>
      <div class="panel" style="margin-top:14px">
        <div class="question-id">${esc(q.id)}${q.refs ? ` - ${esc(q.refs)}` : ""}</div>
        <div class="question">${esc(q.q)}</div>
        ${questionFigure(q)}
        <div id="answers" class="answer-list">${q.a.map((a,i) => `<button class="answer" data-i="${i}"><b>${String.fromCharCode(65+i)}.</b> ${esc(a)}</button>`).join("")}</div>
        <div id="fb"></div>
      </div>`;

    document.getElementById("back").onclick = () => {
      state.view = state.mode === "missed" ? "home" : "section";
      render();
    };
    root.querySelectorAll(".answer").forEach(btn => btn.onclick = () => answerPractice(q, Number(btn.dataset.i)));
  }

  async function answerPractice(q, choice) {
    const correct = choice === q.correct;
    if (correct) state.sessionCorrect++;

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
      mode: state.mode === "missed" ? "missed" : "practice"
    });

    if (!save.error) {
      state.attempts.unshift({
        question_id:q.id,
        section:q.group.slice(0,2),
        subgroup:q.group,
        correct,
        mode:state.mode === "missed" ? "missed" : "practice",
        attempted_at:new Date().toISOString()
      });
      await syncRewards(q.group, groupQuestions(q.group).length, null, null);
    }

    const fb = document.getElementById("fb");
    fb.className = "feedback";
    fb.innerHTML = `<b>${correct ? "Correct!" : "Not quite."}</b> ${esc(q.explain)}
      ${save.error ? '<div class="notice">Your answer could not be saved: '+esc(save.error.message)+'</div>' : ''}
      <div style="margin-top:10px"><button id="next" class="btn">${state.qIndex+1 < state.session.length ? "Next question" : "Finish practice"}</button></div>`;

    document.getElementById("next").onclick = async () => {
      if (state.qIndex+1 < state.session.length) {
        state.qIndex++;
        render();
      } else {
        let rewardMessages = [];
        if (state.mode === "practice") {
          rewardMessages = await syncRewards(state.group, groupQuestions(state.group).length, state.sessionCorrect, state.session.length);
        }
        await loadLearnerStats();
        state.examResult = {
          practiceSummary: true,
          title: state.mode === "missed" ? "Missed Question Rescue Complete" : `${state.group} Practice Complete`,
          score: state.sessionCorrect,
          total: state.session.length,
          rewards: rewardMessages
        };
        state.view = "practiceResult";
        render();
      }
    };
  }

  function renderPracticeResult() {
    const r = state.examResult;
    const pct = r.total ? Math.round(100*r.score/r.total) : 0;
    root.innerHTML = `<div class="result-card panel">
      <span class="badge">Practice Complete</span>
      <h2>${esc(r.title)}</h2>
      <div class="big-score">${r.score}/${r.total}</div>
      <p class="muted">${pct}% correct this round</p>
      ${r.rewards?.length ? `<div class="reward-box"><b>Rewards earned</b>${r.rewards.map(x=>`<div>${esc(x)}</div>`).join("")}</div>` : ""}
      <div class="mission-actions"><button id="home" class="btn">Back to Mission Control</button>${state.mode === "practice" ? '<button id="again" class="btn alt">Practice this subgroup again</button>' : ""}</div>
    </div>`;
    document.getElementById("home").onclick = () => { state.view="home"; render(); };
    const again = document.getElementById("again");
    if (again) again.onclick = () => startGroup(state.group);
  }

  function startExam() {
    state.mode = "exam";
    state.session = allGroups().map(g => {
      const qs = groupQuestions(g);
      return qs[Math.floor(Math.random()*qs.length)];
    });
    state.qIndex = 0;
    state.examAnswers = [];
    state.view = "exam";
    render();
  }

  function renderExam() {
    const q = state.session[state.qIndex];
    const total = state.session.length;
    root.innerHTML = `<div class="toolbar"><button id="quit" class="btn alt">Quit exam</button>
      <div><b>Technician Practice Exam</b> <span class="muted">Question ${state.qIndex+1} of ${total}</span></div></div>
      <div class="progress"><span style="width:${(state.qIndex/total)*100}%"></span></div>
      <div class="panel" style="margin-top:14px">
        <div class="exam-note">No answers are shown until the exam is finished.</div>
        <div class="question-id">${esc(q.id)}</div>
        <div class="question">${esc(q.q)}</div>
        ${questionFigure(q)}
        <div class="answer-list">${q.a.map((a,i) => `<button class="answer exam-answer" data-i="${i}"><b>${String.fromCharCode(65+i)}.</b> ${esc(a)}</button>`).join("")}</div>
      </div>`;

    document.getElementById("quit").onclick = () => {
      if (confirm("Quit this practice exam? Your unfinished exam will not be saved.")) {
        state.view="home";
        render();
      }
    };
    root.querySelectorAll(".exam-answer").forEach(btn => btn.onclick = () => answerExam(q, Number(btn.dataset.i)));
  }

  function answerExam(q, choice) {
    state.examAnswers.push({q, choice, correct: choice === q.correct});
    state.qIndex++;
    if (state.qIndex >= state.session.length) finishExam();
    else render();
  }

  async function finishExam() {
    state.view = "loading";
    render();
    const score = state.examAnswers.filter(x=>x.correct).length;
    const passed = score >= pool.meta.passingScore;
    const rows = state.examAnswers.map(x => ({
      learner_id: state.learner.learner_id,
      question_id: x.q.id,
      section: x.q.group.slice(0,2),
      subgroup: x.q.group,
      correct: x.correct,
      mode: "exam"
    }));

    const attemptsSave = await db.from("attempts").insert(rows);
    let examId = null;
    let examError = attemptsSave.error;
    if (!attemptsSave.error) {
      const examSave = await db.from("exam_results").insert({
        learner_id: state.learner.learner_id,
        score,
        total: pool.meta.examLength,
        passed
      }).select("id").single();
      examId = examSave.data?.id || null;
      examError = examSave.error || null;
      await syncRewards(null, null, null, null);
    }

    const breakdown = {};
    for (const x of state.examAnswers) {
      const s = x.q.group.slice(0,2);
      breakdown[s] ||= {correct:0,total:0};
      breakdown[s].total++;
      if (x.correct) breakdown[s].correct++;
    }

    state.examResult = {
      practiceSummary:false,
      score,
      total:pool.meta.examLength,
      passed,
      answers:[...state.examAnswers],
      breakdown,
      saveError:examError?.message || null,
      examId
    };
    await loadLearnerStats();
    state.view="examResult";
    render();
  }

  function renderExamResult() {
    const r = state.examResult;
    const missed = r.answers.filter(x=>!x.correct);
    const rows = pool.sections.map(s => {
      const b = r.breakdown[s.id] || {correct:0,total:0};
      return `<div class="breakdown-row"><span>${s.id} - ${esc(s.title)}</span><b>${b.correct}/${b.total}</b></div>`;
    }).join("");

    root.innerHTML = `<div class="result-card panel ${r.passed ? "pass" : "not-pass"}">
      <span class="badge">35-Question Practice Exam</span>
      <h2>${r.passed ? "PASS" : "Keep Practicing"}</h2>
      <div class="big-score">${r.score}/${r.total}</div>
      <p>${r.passed ? "You reached the Technician passing score of 26/35." : `You need 26/35 to pass. You are ${Math.max(0,26-r.score)} question(s) away.`}</p>
      ${r.saveError ? `<div class="feedback">Your exam result could not be saved: ${esc(r.saveError)}</div>` : ""}
      <div class="breakdown"><h3>Section Breakdown</h3>${rows}</div>
      <div class="mission-actions"><button id="home" class="btn">Mission Control</button><button id="again" class="btn alt">Take Another Exam</button>${missed.length ? `<button id="fix" class="btn alt">Practice These ${missed.length} Missed</button>` : ""}</div>
    </div>
    ${missed.length ? `<div class="panel" style="margin-top:18px"><h3>Questions Missed</h3>${missed.map(x=>`<div class="review-item"><b>${esc(x.q.id)}</b> ${esc(x.q.q)}<div class="muted">Correct: ${String.fromCharCode(65+x.q.correct)}. ${esc(x.q.a[x.q.correct])}</div></div>`).join("")}</div>` : ""}`;

    document.getElementById("home").onclick = () => { state.view="home"; render(); };
    document.getElementById("again").onclick = startExam;
    const fix = document.getElementById("fix");
    if (fix) fix.onclick = () => startMissed(missed.map(x=>x.q));
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

    const [learnersRes, attemptsRes, pointsRes, scoresRes, examsRes] = await Promise.all([
      db.from("learners").select("id,first_name,team,active,created_at").order("team").order("first_name"),
      db.from("attempts").select("learner_id,question_id,subgroup,correct,mode,attempted_at"),
      db.from("points_ledger").select("learner_id,points,reason,source,created_at"),
      db.rpc("get_team_scores"),
      db.from("exam_results").select("learner_id,score,total,passed,completed_at")
    ]);

    if (learnersRes.error) {
      root.innerHTML = `<div class="panel"><h2>Teacher Dashboard</h2><div class="feedback">Could not load teacher data: ${esc(learnersRes.error.message)}</div><button id="logoutTeacher" class="btn">Log out</button></div>`;
      document.getElementById("logoutTeacher").onclick = async () => { await db.auth.signOut(); state.teacher=false; state.view="login"; render(); };
      return;
    }

    const learners = learnersRes.data || [];
    const attempts = attemptsRes.data || [];
    const ledger = pointsRes.data || [];
    const exams = examsRes.data || [];
    state.teamScores = scoresRes.data || [];

    const counts = team => learners.filter(l => l.team===team && l.active).length;
    const weekAgo = Date.now() - 7*864e5;
    const weekAttempts = attempts.filter(a => new Date(a.attempted_at).getTime() >= weekAgo).length;
    const learnerRows = learners.map(l => {
      const la = attempts.filter(a => a.learner_id===l.id);
      const lp = ledger.filter(p => p.learner_id===l.id).reduce((n,p)=>n+Number(p.points||0),0);
      const le = exams.filter(e => e.learner_id===l.id);
      const accuracy = la.length ? Math.round(100*la.filter(a=>a.correct).length/la.length) : 0;
      const best = le.length ? Math.max(...le.map(e=>Number(e.score))) : null;
      const latest = la.length ? new Date(Math.max(...la.map(a=>new Date(a.attempted_at).getTime()))).toLocaleDateString() : "Not yet";
      return `<div class="card">
        <div class="toolbar"><div><b>${esc(l.first_name)}</b><div class="muted">${esc(l.team)}</div></div><span class="badge">${lp} pts</span></div>
        <div class="learner-metrics"><span>${la.length} answered</span><span>${accuracy}% accuracy</span><span>Best exam: ${best===null ? "-" : best+"/35"}</span><span>Last practice: ${latest}</span></div>
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
    else if (state.view==="practiceResult") renderPracticeResult();
    else if (state.view==="exam") renderExam();
    else if (state.view==="examResult") renderExamResult();
    else if (state.view==="teacherLogin") renderTeacherLogin();
    else if (state.view==="teacher") renderTeacher();
  }

  bootstrap();
})();