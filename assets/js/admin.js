/* ============================================================
   DrimTeam — Admin panel (client-side prototype, localStorage)
   ============================================================ */
(function () {
  "use strict";

  /* ---- מנהל ראשי לאתחול (bootstrap). הרשאות אמיתיות נקבעות ע"י Custom Claims ---- */
  var DEFAULT_ADMINS = ["bennydaniel006@gmail.com"]; // משמש רק כשער גישה ראשוני + אתחול

  /* ---------- storage helpers (Firestore via DTDB, localStorage fallback) ---------- */
  var DB = window.DTDB || {
    _c: {},
    load: function () { return Promise.resolve(); },
    get: function (k, def) { try { var v = localStorage.getItem("dt_" + k); return v ? JSON.parse(v) : def; } catch (e) { return def; } },
    set: function (k, v) { localStorage.setItem("dt_" + k, JSON.stringify(v)); }
  };
  var uid = function () { return Math.random().toString(36).slice(2, 9); };
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); };

  /* ---------- seed demo data (only on a truly empty database) ---------- */
  function seed() {
    if (!DB.get("tournaments") && !DB.get("games")) {
      DB.set("tournaments", [
        { id: uid(), name: "טורניר בוטיק רחובות", format: "טורניר בוטיק", date: "2026-06-14", city: "רחובות", price: 55 },
        { id: uid(), name: "גביע הקיץ הרצליה", format: "כדורגל 7", date: "2026-07-04", city: "הרצליה", price: 60 }
      ]);
      var gSeed = "g_seed";
      DB.set("games", [
        { id: gSeed, title: "משחק שבועי — רחובות", format: "כדורגל 7", city: "רחובות", venue: "ספורטק רחובות", date: "2026-06-07", time: "20:00", max: 21 },
        { id: uid(), title: "פוטסל — מודיעין", format: "פוטסל", city: "מודיעין", venue: "העירוני מודיעין", date: "2026-06-09", time: "21:00", max: 18 },
        { id: uid(), title: "משחק שישי — ראשל\"צ", format: "כדורגל 7", city: "ראשל\"צ", venue: "קריית הספורט", date: "2026-06-12", time: "17:00", max: 21 }
      ]);
      var names = ["יוסי כהן", "דני לוי", "אבי מזרחי", "רון ביטון", "עידן פרץ", "ניר אזולאי", "גיא שטרן", "תומר דהן",
        "אלון בר", "משה חדד", "ליאור גל", "עומר נחמיאס", "שי אוחיון", "אורי קפלן", "יובל אדרי", "נדב סבן",
        "איתי רוזן", "ארז מלכה", "בועז שמש", "חן יוסף", "רועי טל"];
      var regs = {}; regs[gSeed] = names.map(function (n, i) {
        return { id: uid(), name: n, pos: ["שוער", "בלם", "קשר", "חלוץ"][i % 4], rating: (i % 7) + 1 };
      });
      DB.set("regs", regs);
      DB.set("settings", { waGroups: [] });
      DB.set("seeded", true);
    }
  }

  /* ---------- auth ---------- */
  // שער גישה ראשוני בלבד (לפני שה-claim קיים). האכיפה האמיתית ב-firestore.rules.
  function allowedEmails() {
    return DEFAULT_ADMINS.map(function (e) { return e.toLowerCase().trim(); });
  }
  function login(email) {
    email = (email || "").toLowerCase().trim();
    if (allowedEmails().indexOf(email) === -1) return false;
    DB.set("session", email);
    return true;
  }

  /* ============================================================
     RENDERERS
     ============================================================ */
  function renderDashboard() {
    var games = DB.get("games", []), tourn = DB.get("tournaments", []), regs = DB.get("regs", {});
    var todayStr = new Date().toISOString().slice(0, 10);
    var activeGames = games.filter(function (g) { return !g.date || g.date >= todayStr; });
    var endedGames  = games.filter(function (g) { return g.date && g.date < todayStr; });
    endedGames.sort(function (a, b) { return b.date.localeCompare(a.date); }); // חדש ראשון
    var total = 0; Object.keys(regs).forEach(function (k) { total += (regs[k] || []).length; });
    $("kpiGames").textContent  = activeGames.length;
    if ($("kpiEnded")) $("kpiEnded").textContent = endedGames.length;
    $("kpiTourn").textContent  = tourn.length;
    $("kpiRegs").textContent   = total;
    // רשימת משחקים שהסתיימו + כפתור "רשום תוצאה"
    var panel = $("endedGamesPanel"), list = $("endedGamesList");
    if (panel) panel.style.display = endedGames.length ? "" : "none";
    if (list) {
      list.innerHTML = endedGames.map(function (g) {
        var saved = false;
        try { saved = !!localStorage.getItem("dt_ts_" + g.id); } catch (e) {}
        return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--navy-line)">' +
          '<div><strong>' + esc(g.title) + '</strong>&nbsp;<span class="muted" style="font-size:.82rem">' + esc(g.date) + ' · ' + esc(g.city) + '</span>' +
          (saved ? ' <span class="badge" style="font-size:.72rem">כוחות שמורים ✔</span>' : '') + '</div>' +
          '<button class="btn btn--ghost btn--sm" data-go-result="' + esc(g.id) + '">רשום תוצאה</button>' +
          '</div>';
      }).join("");
    }
    if (DB.displayFirstName) DB.displayFirstName().then(function (n) { $("adminName").textContent = n || "מנהל"; });
    else $("adminName").textContent = DB.get("session", "מנהל");
  }

  /* ---- Tournaments ---- */
  function renderTournaments() {
    var list = DB.get("tournaments", []);
    var tb = $("tournRows"); tb.innerHTML = "";
    $("tournEmpty").style.display = list.length ? "none" : "block";
    list.forEach(function (t) {
      var tr = document.createElement("tr");
      tr.innerHTML = "<td><strong>" + esc(t.name) + "</strong></td><td>" + esc(t.format) + "</td><td>" + esc(t.date) +
        "</td><td>" + esc(t.city) + "</td><td>₪" + esc(t.price) + "</td>" +
        '<td><div class="row-actions">' +
        '<button class="icon-btn" data-edit-t="' + t.id + '" title="עריכה"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '<button class="icon-btn icon-btn--danger" data-del-t="' + t.id + '" title="מחיקה"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        "</div></td>";
      tb.appendChild(tr);
    });
  }
  function tournReset() { $("tId").value = ""; $("tName").value = ""; $("tDate").value = ""; $("tCity").value = ""; $("tPrice").value = ""; $("tFormTitle").textContent = "הוספת טורניר"; }
  function tournSave() {
    var list = DB.get("tournaments", []);
    var id = $("tId").value;
    var obj = { id: id || uid(), name: $("tName").value || "ללא שם", format: $("tFormat").value, date: $("tDate").value, city: $("tCity").value, price: $("tPrice").value || 0 };
    if (id) { list = list.map(function (t) { return t.id === id ? obj : t; }); }
    else { list.push(obj); }
    DB.set("tournaments", list); tournReset(); renderTournaments(); renderDashboard();
  }

  /* ---- Games ---- */
  function renderGames() {
    var list = DB.get("games", []);
    var tb = $("gameRows"); tb.innerHTML = "";
    $("gameEmpty").style.display = list.length ? "none" : "block";
    list.forEach(function (g) {
      var tr = document.createElement("tr");
      tr.innerHTML = "<td><strong>" + esc(g.title) + "</strong></td><td>" + (g.category ? '<span class="badge">' + esc(g.category) + "</span>" : "—") + "</td><td>" + esc(g.format) + "</td><td>" + esc(g.date) + " " + esc(g.time) +
        "</td><td>" + esc(g.venue || g.city) + "</td><td class='reg-count'>…/" + esc(g.max || "-") + "</td>" +
        '<td><div class="row-actions">' +
        '<button class="icon-btn" data-edit-g="' + g.id + '" title="עריכה"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        '<button class="icon-btn icon-btn--danger" data-del-g="' + g.id + '" title="מחיקה"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
        "</div></td>";
      tb.appendChild(tr);
      (function (row, game) {
        var st = DB.getGameStats ? DB.getGameStats(game.id) : Promise.resolve({ count: 0 });
        st.then(function (s) { var c = row.querySelector(".reg-count"); if (c) c.textContent = s.count + "/" + (game.max || "-"); });
      })(tr, g);
    });
  }
  function gameReset() { ["gId", "gTitle", "gFormat", "gCategory", "gCity", "gVenue", "gDate", "gTime", "gMax", "gPrice"].forEach(function (i) { $(i).value = ""; }); $("gFormTitle").textContent = "פתיחת משחק חדש"; }
  function gameSave() {
    var list = DB.get("games", []);
    var id = $("gId").value;
    var obj = { id: id || uid(), title: $("gTitle").value || "משחק", format: $("gFormat").value, category: $("gCategory").value, city: $("gCity").value, venue: $("gVenue").value, date: $("gDate").value, time: $("gTime").value, max: $("gMax").value || 21, price: parseInt($("gPrice").value, 10) || 0 };
    if (id) { list = list.map(function (g) { return g.id === id ? obj : g; }); }
    else { list.push(obj); }
    DB.set("games", list); gameReset(); renderGames(); renderDashboard(); fillGameSelects();
  }

  function gameLabel(g) { return g.title + " · " + g.date; }
  function fillGameSelects() {
    var games = DB.get("games", []);
    [["regGameSel", true], ["teamGameSel", false]].forEach(function (pair) {
      var sel = $(pair[0]); if (!sel) return;
      var prev = sel.value;
      sel.innerHTML = games.length ? "" : '<option value="">— אין משחקים —</option>';
      games.forEach(function (g) { var o = document.createElement("option"); o.value = g.id; o.textContent = gameLabel(g); sel.appendChild(o); });
      if (prev) sel.value = prev;
    });
  }

  /* ---- Registrations ---- */
  function renderRegs() {
    var gid = $("regGameSel").value;
    var tb = $("regRows");
    if (!gid) { tb.innerHTML = ""; $("regEmpty").style.display = "block"; $("regEmpty").textContent = "בחר משחק כדי לראות נרשמים."; return; }
    var getter = DB.getRegistrations ? DB.getRegistrations(gid) : Promise.resolve((DB.get("regs", {})[gid]) || []);
    getter.then(function (list) {
      tb.innerHTML = "";
      $("regEmpty").style.display = list.length ? "none" : "block";
      $("regEmpty").textContent = "אין נרשמים למשחק הזה עדיין.";
      list.forEach(function (p, i) {
        var tr = document.createElement("tr");
        tr.innerHTML = "<td>" + (i + 1) + "</td><td><strong>" + esc(p.name) + "</strong></td><td>" + esc(p.rating || "—") + "</td>" +
          '<td><button class="icon-btn icon-btn--danger" data-del-r="' + p.id + '" data-gid="' + esc(gid) + '" title="הסר"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14" stroke-linecap="round"/></svg></button></td>';
        tb.appendChild(tr);
      });
    });
  }
  function regAdd() {
    var gid = $("regGameSel").value; if (!gid) { alert("בחר משחק קודם"); return; }
    var player = { name: $("regName").value || "שחקן", rating: parseInt($("regRate").value, 10) || 4 };
    var p = DB.addRegistration ? DB.addRegistration(gid, player) : Promise.resolve();
    p.then(function () { $("regName").value = ""; $("regRate").value = ""; renderRegs(); });
  }

  /* ---- Members (terms signers) ---- */
  function renderMembers() {
    var tb = $("memberRows"); tb.innerHTML = "";
    (DB.getMembers ? DB.getMembers() : Promise.resolve([])).then(function (list) {
      $("memberEmpty").style.display = list.length ? "none" : "block";
      list.forEach(function (m, i) {
        var when = (m.createdAt && m.createdAt.toDate) ? m.createdAt.toDate().toLocaleDateString("he-IL") : (m.termsAccepted ? "✔" : "—");
        var tr = document.createElement("tr");
        tr.innerHTML = "<td>" + (i + 1) + "</td><td><strong>" + esc(m.name || "") + "</strong></td><td>" + esc(m.phone || "") + "</td><td>" + esc(m.email || "") + "</td><td>" + esc(m.city || "") + "</td><td>" + esc(when) + "</td>";
        tb.appendChild(tr);
      });
    });
  }

  /* ============================================================
     TEAM BUILDER
     ============================================================ */
  var STATE = { pool: [], teams: [[], [], []] };
  var COLORS = ["⚪", "🟡", "🟠"];
  var TEAM_NAMES = ["לבנה", "צהובה", "כתומה"];

  function playersFromSource() {
    var gid = $("teamGameSel").value;
    var getter = DB.getRegistrations ? DB.getRegistrations(gid) : Promise.resolve((DB.get("regs", {})[gid]) || []);
    return getter.then(function (list) { return list.map(function (p) { return { id: uid(), name: p.name, rating: p.rating || 4 }; }); });
  }
  function skill(p) { return 8 - (p.rating || 4); } // 1(best)->7 ... 7(weakest)->1

  function balance(players, shuffle) {
    var arr = players.slice();
    if (shuffle) { for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = arr[i]; arr[i] = arr[j]; arr[j] = t; } }
    arr.sort(function (a, b) { return skill(b) - skill(a) + (shuffle ? (Math.random() - 0.5) * 0.6 : 0); });
    var teams = [[], [], []];
    arr.forEach(function (p) {
      // pick team with fewest players, tie-break by lowest total skill
      var best = 0, bestLen = Infinity, bestSum = Infinity;
      for (var k = 0; k < 3; k++) {
        var len = teams[k].length;
        var sum = teams[k].reduce(function (s, x) { return s + skill(x); }, 0);
        if (len < bestLen || (len === bestLen && sum < bestSum)) { best = k; bestLen = len; bestSum = sum; }
      }
      teams[best].push(p);
    });
    return teams;
  }

  /* ---- שמירה/שחזור כוחות ב-localStorage (לרישום תוצאה בסוף משחק) ---- */
  function saveTeamState() {
    try {
      var gid = $("teamGameSel") ? $("teamGameSel").value : "";
      if (!gid) return;
      localStorage.setItem("dt_ts_" + gid, JSON.stringify({ teams: STATE.teams, pool: STATE.pool }));
      localStorage.setItem("dt_ts_last", gid);
    } catch (e) {}
  }
  function restoreTeamState(gid) {
    if (!gid) { try { gid = localStorage.getItem("dt_ts_last"); } catch (e) {} }
    if (!gid) return false;
    try {
      var saved = JSON.parse(localStorage.getItem("dt_ts_" + gid) || "null");
      if (!saved || !saved.teams) return false;
      STATE.pool  = saved.pool  || [];
      STATE.teams = saved.teams || [[], [], []];
      while (STATE.teams.length < 3) STATE.teams.push([]);
      var n = STATE.pool.length + STATE.teams.reduce(function (s, t) { return s + t.length; }, 0);
      if (!n) return false;
      renderTeams();
      $("teamsInfo").textContent = n + " שחקנים משוחזרים — ניתן לרשום תוצאה או לחלק מחדש.";
      return true;
    } catch (e) { return false; }
  }
  function clearTeamState(gid) {
    try { if (gid) localStorage.removeItem("dt_ts_" + gid); } catch (e) {}
  }

  function applyTeams(players, shuffle) {
    if (!players.length) { $("teamsInfo").textContent = "אין שחקנים — בחר משחק עם נרשמים או הדבק רשימה."; return; }
    STATE.teams = balance(players, shuffle);
    STATE.pool = [];
    var n = players.length;
    $("teamsInfo").textContent = n + " שחקנים → " + STATE.teams.map(function (t) { return t.length; }).join(" / ") +
      (n % 3 === 0 ? "  (חלוקה שווה ✅)" : "  (לא מתחלק ב-3 — חולק כמה שיותר שווה)");
    renderTeams();
    saveTeamState();
  }
  function genTeams(shuffle) {
    var existing = STATE.pool.concat(STATE.teams[0], STATE.teams[1], STATE.teams[2]);
    if (existing.length) { applyTeams(existing, shuffle); return; }
    $("teamsInfo").textContent = "טוען נרשמים…";
    playersFromSource().then(function (players) { applyTeams(players, shuffle); });
  }

  function chip(p, where, idx) {
    var moves = "";
    for (var k = 0; k < 3; k++) { if (k !== where) moves += '<button data-move="' + p.id + '|' + k + '" title="לקבוצה ' + (k + 1) + '">' + (k + 1) + "</button>"; }
    moves += '<button data-move="' + p.id + '|pool" title="להוצאה">↩</button>';
    return '<div class="player-chip"><span>' + esc(p.name) + '</span>' +
      '<span class="rate">' + esc(p.rating) + '</span><span class="move">' + moves + "</span></div>";
  }
  function findPlayer(id) {
    var arr = STATE.pool.concat(STATE.teams[0], STATE.teams[1], STATE.teams[2]);
    return arr.filter(function (p) { return p.id === id; })[0];
  }
  function removeEverywhere(id) {
    STATE.pool = STATE.pool.filter(function (p) { return p.id !== id; });
    STATE.teams = STATE.teams.map(function (t) { return t.filter(function (p) { return p.id !== id; }); });
  }
  function move(id, dest) {
    var p = findPlayer(id); if (!p) return;
    removeEverywhere(id);
    if (dest === "pool") STATE.pool.push(p); else STATE.teams[parseInt(dest, 10)].push(p);
    renderTeams();
    saveTeamState();
  }
  function renderTeams() {
    $("pool").innerHTML = STATE.pool.length ? STATE.pool.map(function (p) { return chip(p, -1); }).join("") : '<span class="muted">— ריק —</span>';
    for (var k = 0; k < 3; k++) {
      $("team" + k).innerHTML = STATE.teams[k].map(function (p) { return chip(p, k); }).join("");
      var sum = STATE.teams[k].reduce(function (s, p) { return s + skill(p); }, 0);
      var avg = STATE.teams[k].length ? (sum / STATE.teams[k].length).toFixed(1) : "0";
      $("sum" + k).textContent = STATE.teams[k].length + " שחקנים · עוצמה " + avg;
    }
    // מילוי בורר מלך השערים לפי השחקנים הנוכחיים
    var ks = $("kingScorer");
    if (ks) {
      var all = STATE.pool.concat(STATE.teams[0], STATE.teams[1], STATE.teams[2]);
      ks.innerHTML = '<option value="">—</option>' + all.map(function (p) { return '<option value="' + esc(p.name) + '">' + esc(p.name) + "</option>"; }).join("");
    }
  }
  function saveResult() {
    var msg = $("resultMsg"); msg.style.color = "var(--text-dim)";
    if (!STATE.teams.some(function (t) { return t.length; })) { msg.style.color = "#ff8a72"; msg.textContent = "חלק כוחות קודם."; return; }
    var gid = $("teamGameSel").value;
    var g = (DB.get("games", []) || []).filter(function (x) { return x.id === gid; })[0];
    var nm = function (i) { return STATE.teams[i].map(function (p) { return p.name; }); };
    var r = {
      gameId: gid || null, gameTitle: g ? g.title : "משחק",
      date: new Date().toISOString().slice(0, 10),
      winningTeam: $("winTeam").value || "",
      kingScorer: $("kingScorer").value || "",
      teams: { "לבנה": nm(0), "צהובה": nm(1), "כתומה": nm(2) }
    };
    msg.textContent = "שומר…";
    (DB.addResult ? DB.addResult(r) : Promise.resolve()).then(function () {
      msg.style.color = "var(--lime-400)"; msg.textContent = "✅ התוצאה נשמרה — מופיעה בכרטיסיית השחקן ובמלך השערים.";
      clearTeamState(gid); // מנקים את הכוחות השמורים — המשחק הסתיים
      renderDashboard();   // מעדכן את הסקירה (כוחות שמורים ✔ יוסר)
    }).catch(function (e) { msg.style.color = "#ff8a72"; msg.textContent = "⚠️ " + (DB.authErrorText ? DB.authErrorText(e) : e); });
  }
  function loadPaste() {
    var lines = ($("teamPaste").value || "").split("\n").map(function (l) { return l.trim(); }).filter(Boolean);
    if (!lines.length) return;
    STATE.pool = lines.map(function (l) {
      var parts = l.split(",");
      return { id: uid(), name: parts[0].trim(), rating: parseInt(parts[1], 10) || 4 };
    });
    STATE.teams = [[], [], []];
    $("teamsInfo").textContent = STATE.pool.length + " שחקנים נטענו — לחץ 'חלק כוחות'";
    renderTeams();
    saveTeamState();
  }

  function buildMessage() {
    var gid = $("teamGameSel").value, games = DB.get("games", []);
    var g = games.filter(function (x) { return x.id === gid; })[0];
    var head = g ? ("⚽ כוחות למשחק — " + g.title + " (" + g.date + " " + g.time + ")\nמגרש: " + (g.venue || g.city) + "\n") : "⚽ כוחות למשחק\n";
    var body = STATE.teams.map(function (t, k) {
      return "\n" + COLORS[k] + " קבוצה " + TEAM_NAMES[k] + "\n" + t.map(function (p, i) { return (i + 1) + ". " + p.name; }).join("\n");
    }).join("\n");
    return head + body + "\n\nנתראה במגרש! 💚 DrimTeam";
  }
  function sendToGroup(g, msg) {
    var link = g.link || "";
    if (/^https?:\/\//i.test(link)) {
      window.open(link, "_blank");
      $("waHint").textContent = "'" + esc(g.name) + "' נפתחה — ההודעה הועתקה ללוח, הדבק ושלח.";
    } else {
      window.open("https://wa.me/" + link.replace(/\D/g, "") + "?text=" + encodeURIComponent(msg), "_blank");
      $("waHint").textContent = "'" + esc(g.name) + "' — וואטסאפ נפתח עם ההודעה מוכנה, לחץ שלח.";
    }
  }
  function showGroupPicker(groups, msg) {
    var picker = $("waPicker"), btns = $("waPickerBtns");
    if (!picker || !btns) { sendToGroup(groups[0], msg); return; }
    window.__waPendingGroups = groups;
    window.__waPendingMsg = msg;
    btns.innerHTML = groups.map(function (g) {
      return '<button class="btn btn--ghost btn--sm" data-wa-group="' + esc(g.id) + '">' + esc(g.name) + '</button>';
    }).join("");
    picker.style.display = "";
    $("waHint").textContent = "ההודעה הועתקה ללוח. בחר לאיזו קבוצה לשלוח:";
  }
  function finish() {
    if (!STATE.teams.some(function (t) { return t.length; })) { alert("חלק כוחות קודם"); return; }
    var msg = buildMessage();
    var s = DB.get("settings", {});
    var groups = s.waGroups || [];
    // תמיכה אחורה בפורמט הישן
    if (!groups.length && (s.waPhone || s.waGroup)) {
      if (s.waPhone) groups = [{ id: "_p", name: "וואטסאפ", link: s.waPhone }];
      else groups = [{ id: "_g", name: "קבוצה", link: s.waGroup }];
    }
    copy(msg); // תמיד מעתיקים ללוח כגיבוי
    if (!groups.length) {
      $("waHint").textContent = "ההודעה הועתקה ללוח. הגדר קבוצות וואטסאפ ב'הגדרות'.";
      alert("הגדר קבוצות וואטסאפ ב'הגדרות'. בינתיים ההודעה הועתקה ללוח.");
      return;
    }
    if (groups.length === 1) { sendToGroup(groups[0], msg); return; }
    showGroupPicker(groups, msg);
  }
  function copy(text) {
    if (navigator.clipboard) { navigator.clipboard.writeText(text).catch(function () { }); }
    else { var ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch (e) { } document.body.removeChild(ta); }
  }

  /* ---- Settings ---- */
  function renderSettings() {
    var s = DB.get("settings", {});
    var groups = s.waGroups || [];
    // one-time migration from old waPhone/waGroup single fields
    if (!groups.length && (s.waPhone || s.waGroup)) {
      if (s.waPhone) groups.push({ id: uid(), name: "וואטסאפ", link: s.waPhone });
      if (s.waGroup) groups.push({ id: uid(), name: "קבוצה", link: s.waGroup });
      s.waGroups = groups; delete s.waPhone; delete s.waGroup; DB.set("settings", s);
    }
    var tb = $("waGroupsList");
    if (tb) {
      tb.innerHTML = groups.length ? groups.map(function (g) {
        return "<tr><td><strong>" + esc(g.name) + "</strong></td><td style='word-break:break-all;font-size:.82rem'>" + esc(g.link) + "</td>" +
          "<td><button class='icon-btn icon-btn--danger' data-del-wa='" + esc(g.id) + "'>✕</button></td></tr>";
      }).join("") : "<tr><td colspan='3' class='muted' style='padding:8px 0'>אין קבוצות עדיין. הוסף למטה.</td></tr>";
    }
    if (DB.getMyMember) DB.getMyMember().then(function (m) { if (m && m.name) $("setMyName").value = m.name; });
    var atb = $("adminRows"); atb.innerHTML = "<tr><td colspan='2' class='muted' style='padding:8px 0'>טוען…</td></tr>";
    var defaults = DEFAULT_ADMINS.map(function (e) { return e.toLowerCase().trim(); });
    (DB.listAdmins ? DB.listAdmins() : Promise.resolve(defaults)).then(function (emails) {
      // ודא שהמנהל הראשי תמיד מוצג, גם אם טרם בוצע אתחול
      defaults.forEach(function (d) { if (emails.indexOf(d) === -1) emails.unshift(d); });
      atb.innerHTML = "";
      emails.forEach(function (e) {
        var isDefault = defaults.indexOf((e || "").toLowerCase().trim()) !== -1;
        var tr = document.createElement("tr");
        tr.innerHTML = "<td>" + esc(e) + (isDefault ? ' <span class="badge">ראשי</span>' : "") + "</td>" +
          "<td style='text-align:left'>" + (isDefault ? "" : '<button class="icon-btn icon-btn--danger" data-del-admin="' + esc(e) + '">✕</button>') + "</td>";
        atb.appendChild(tr);
      });
    });
  }
  function addWaGroup() {
    var name = ($("setWaName") && $("setWaName").value.trim()) || "";
    var link = ($("setWaLink") && $("setWaLink").value.trim()) || "";
    if (!name || !link) { alert("מלא שם וקישור/מספר"); return; }
    var s = DB.get("settings", {});
    var groups = s.waGroups || [];
    groups.push({ id: uid(), name: name, link: link });
    s.waGroups = groups;
    DB.set("settings", s);
    if ($("setWaName")) $("setWaName").value = "";
    if ($("setWaLink")) $("setWaLink").value = "";
    renderSettings();
  }
  function removeWaGroup(id) {
    var s = DB.get("settings", {});
    s.waGroups = (s.waGroups || []).filter(function (g) { return g.id !== id; });
    DB.set("settings", s);
    renderSettings();
  }

  /* ---- Payments (PayPlus orders) ---- */
  function loadPaySettings() { var s = DB.get("settings", {}); var el = $("payEnabled"); if (el) el.checked = !!s.payEnabled; }
  function savePaySettings() { var s = DB.get("settings", {}); s.payEnabled = $("payEnabled").checked; DB.set("settings", s); alert("נשמר ✅"); }
  function renderOrders() {
    var tb = $("orderRows"); if (!tb) return; tb.innerHTML = "";
    (DB.getOrders ? DB.getOrders() : Promise.resolve([])).then(function (list) {
      $("orderEmpty").style.display = list.length ? "none" : "block";
      list.forEach(function (o) {
        var when = (o.createdAt && o.createdAt.toDate) ? o.createdAt.toDate().toLocaleString("he-IL") : "";
        var cust = (o.customer && (o.customer.name || o.customer.email)) || "";
        var st = o.status === "paid" ? '<span class="badge">שולם</span>' : (o.status === "failed" ? '<span class="badge badge--low">נכשל</span>' : '<span class="badge">ממתין</span>');
        var tr = document.createElement("tr");
        tr.innerHTML = "<td>" + esc(when) + "</td><td>" + esc(cust) + "</td><td>₪" + esc(o.amount || 0) + "</td><td>" + st + "</td>";
        tb.appendChild(tr);
      });
    });
  }

  /* ---- OTP (admin 2FA) ---- */
  var OTP_TMP = null;
  function renderOtpStatus() {
    var uid = DB.currentUid ? DB.currentUid() : null;
    var st = $("otpStatus"); if (!st) return;
    if (!uid) { st.textContent = "זמין רק כשמחוברים דרך Firebase."; $("otpEnableBtn").style.display = "none"; $("otpDisableBtn").style.display = "none"; return; }
    (DB.getOtp ? DB.getOtp(uid) : Promise.resolve(null)).then(function (otp) {
      var on = otp && otp.enabled;
      st.textContent = on ? "סטטוס: OTP פעיל ✅" : "סטטוס: OTP כבוי";
      st.style.color = on ? "var(--lime-400)" : "var(--text-dim)";
      $("otpEnableBtn").style.display = on ? "none" : "";
      $("otpDisableBtn").style.display = on ? "" : "none";
      $("otpSetup").style.display = "none";
    });
  }
  function otpEnableStart() {
    if (!window.OTP) { alert("מודול OTP לא נטען"); return; }
    OTP_TMP = window.OTP.genSecret();
    var email = DB.get("session", "admin");
    $("otpQr").src = window.OTP.qrURL(window.OTP.otpauthURL(email, OTP_TMP));
    $("otpSecretText").textContent = OTP_TMP;
    $("otpSetup").style.display = "";
    $("otpMsg").textContent = "";
  }
  function otpConfirm() {
    if (!OTP_TMP) return;
    var code = ($("otpVerify").value || "").trim();
    window.OTP.verify(OTP_TMP, code).then(function (ok) {
      if (!ok) { $("otpMsg").style.color = "#ff8a72"; $("otpMsg").textContent = "קוד שגוי — ודא שהשעון באפליקציה מסונכרן ונסה שוב."; return; }
      var uid = DB.currentUid ? DB.currentUid() : null;
      (DB.setOtp ? DB.setOtp(uid, { enabled: true, secret: OTP_TMP }) : Promise.resolve()).then(function () {
        OTP_TMP = null; $("otpVerify").value = ""; renderOtpStatus(); alert("אימות דו-שלבי הופעל ✅");
      }).catch(function (e) { $("otpMsg").style.color = "#ff8a72"; $("otpMsg").textContent = DB.authErrorText ? DB.authErrorText(e) : "שמירה נכשלה"; });
    });
  }
  function otpDisable() {
    if (!confirm("לכבות אימות דו-שלבי (OTP)?")) return;
    var uid = DB.currentUid ? DB.currentUid() : null;
    (DB.setOtp ? DB.setOtp(uid, { enabled: false, secret: null }) : Promise.resolve()).then(renderOtpStatus);
  }

  /* ---- Gallery management ---- */
  function ytId(url) { var m = (url || "").match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/); return m ? m[1] : null; }
  function videoThumb(url) {
    var id = ytId(url);
    if (id) return '<img src="https://img.youtube.com/vi/' + id + '/hqdefault.jpg" alt="">';
    if (url && (url.indexOf("firebasestorage") !== -1 || /\.mp4/i.test(url)))
      return '<video src="' + url + '" style="width:100%;height:100%;object-fit:cover" muted preload="metadata"></video>';
    return '<div style="display:grid;place-items:center;height:100%;background:#15120d;color:var(--lime-400);font-weight:700">▶ וידאו</div>';
  }
  function fillGalleryTournaments() {
    var dl = $("galTournOptions"); if (!dl) return;
    var t = DB.get("tournaments", []);
    dl.innerHTML = '<option value="כללי"></option>' + t.map(function (x) { return '<option value="' + esc(x.name) + '"></option>'; }).join("");
  }
  function renderGalleryAdmin() {
    var grid = $("galAdminGrid"); if (!grid) return; grid.innerHTML = "";
    (DB.getGallery ? DB.getGallery() : Promise.resolve([])).then(function (list) {
      $("galEmpty").style.display = list.length ? "none" : "block";
      list.forEach(function (it) {
        var media = it.type === "video" ? videoThumb(it.url) : ('<img src="' + it.url + '" alt="">');
        var div = document.createElement("div");
        div.className = "gal-admin-item";
        div.innerHTML = '<div class="gal-admin-media">' + media + "</div>" +
          '<div class="gal-admin-foot"><span>' + (it.type === "video" ? "▶ " : "") + esc(it.tournamentName || "כללי") + "</span>" +
          '<button class="btn btn--ghost btn--sm gal-del" data-del-gal="' + it.id + '">הסר</button></div>';
        grid.appendChild(div);
      });
    });
  }
  function galTypeToggle() {
    var v = $("galType").value;
    $("galFileField").style.display = v === "image" ? "" : "none";
    $("galUrlField").style.display = v === "video" ? "" : "none";
    $("galVideoFileField").style.display = v === "video-upload" ? "" : "none";
  }
  function galAdd() {
    var msg = $("galMsg"); msg.style.color = "var(--text-dim)";
    var type = $("galType").value;
    var tournamentName = $("galTournament").value.trim() || "כללי";
    var caption = $("galCaption").value.trim();
    function save(url, saveType) {
      return DB.addGalleryItem({ type: saveType || type, url: url, tournamentName: tournamentName, caption: caption }).then(function () {
        msg.style.color = "var(--lime-400)"; msg.textContent = "✅ נוסף לגלריה";
        $("galCaption").value = ""; $("galFile").value = ""; $("galUrl").value = "";
        if ($("galVideoFile")) $("galVideoFile").value = "";
        renderGalleryAdmin();
      }).catch(function (e) { msg.style.color = "#ff8a72"; msg.textContent = "⚠️ " + (DB.authErrorText ? DB.authErrorText(e) : e); });
    }
    if (type === "image") {
      var f = $("galFile").files[0];
      if (!f) { msg.style.color = "#ff8a72"; msg.textContent = "בחר קובץ תמונה."; return; }
      msg.textContent = "מעלה…";
      DB.imageToDataUrl(f, 900).then(save).catch(function () { msg.style.color = "#ff8a72"; msg.textContent = "עיבוד התמונה נכשל."; });
    } else if (type === "video-upload") {
      var vf = $("galVideoFile").files[0];
      if (!vf) { msg.style.color = "#ff8a72"; msg.textContent = "בחר קובץ MP4."; return; }
      var MB = vf.size / (1024 * 1024);
      if (MB > 200) { msg.style.color = "#ff8a72"; msg.textContent = "הקובץ גדול מדי (" + Math.round(MB) + "MB). מקסימום 200MB — כדאי לכווץ את הוידאו."; return; }
      var sizeNote = MB > 40 ? " (קובץ של " + Math.round(MB) + "MB — עשוי לקחת דקה)" : "";
      var addBtn = $("galAdd"); if (addBtn) addBtn.disabled = true;
      msg.style.color = "var(--text-dim)"; msg.textContent = "מעלה וידאו…" + sizeNote;
      DB.uploadVideoToStorage(vf, function (pct) {
        msg.textContent = "מעלה וידאו… " + pct + "%" + sizeNote;
      }).then(function (url) {
        return save(url, "video");
      }).catch(function (e) {
        msg.style.color = "#ff8a72"; msg.textContent = "⚠️ " + (e.message || "העלאת הוידאו נכשלה");
      }).then(function () { if (addBtn) addBtn.disabled = false; });
    } else {
      var u = $("galUrl").value.trim();
      if (!u) { msg.style.color = "#ff8a72"; msg.textContent = "הדבק קישור YouTube."; return; }
      msg.textContent = "שומר…"; save(u);
    }
  }

  /* ============================================================
     NAVIGATION + EVENTS
     ============================================================ */
  var currentView = "dashboard";
  function showView(name) {
    currentView = name;
    document.querySelectorAll(".admin-view").forEach(function (v) { v.classList.remove("active"); });
    var el = $("view-" + name); if (el) el.classList.add("active");
    document.querySelectorAll(".admin-nav-btn[data-view]").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-view") === name); });
    if (name === "dashboard") renderDashboard();
    if (name === "tournaments") renderTournaments();
    if (name === "games") { renderGames(); }
    if (name === "regs") { fillGameSelects(); renderRegs(); }
    if (name === "members") renderMembers();
    if (name === "teams") {
      fillGameSelects();
      try {
        var lastGid = localStorage.getItem("dt_ts_last");
        if (lastGid && $("teamGameSel")) $("teamGameSel").value = lastGid;
        restoreTeamState(lastGid || null);
      } catch (e) {}
    }
    if (name === "gallery") { renderGalleryAdmin(); fillGalleryTournaments(); galTypeToggle(); }
    if (name === "payments") { renderOrders(); loadPaySettings(); }
    if (name === "settings") { renderSettings(); renderOtpStatus(); }
  }

  var pendingOtp = null, pendingUid = null, pendingEmail = null;

  function showLogin() {
    $("loginScreen").style.display = "";
    $("appShell").style.display = "none";
    var pf = $("loginPass").closest(".field"); if (pf) pf.style.display = "";
    $("loginEmail").readOnly = false;
    $("loginOtpField").style.display = "none";
  }

  // לאחר התחברות מוצלחת (כולל שחזור סשן) — בודקים הרשאה ואז OTP
  function gateOtp(user) {
    var uid = user.uid;
    var email = (user.email || "").toLowerCase().trim();
    var isDefault = allowedEmails().indexOf(email) !== -1;
    // הרשאה אמיתית = Custom Claim בטוקן; המנהל הראשי מורשה גם לפני אתחול
    var check = DB.isCurrentUserAdmin ? DB.isCurrentUserAdmin() : Promise.resolve(false);
    check.then(function (isAdmin) {
      if (!isAdmin && !isDefault) {
        (DB.signOut ? DB.signOut() : Promise.resolve()).catch(function () {}).then(function () {
          location.href = "index.html";
        });
        return;
      }
      // אתחול אוטומטי של המנהל הראשי (פעם ראשונה אחרי deploy) — מעניק claim
      if (!isAdmin && isDefault && DB.bootstrapAdmin) {
        DB.bootstrapAdmin().catch(function () {}).then(function () { gateOtpContinue(user); });
        return;
      }
      gateOtpContinue(user);
    });
  }
  function gateOtpContinue(user) {
    var uid = user.uid;
    if (sessionStorage.getItem("dt_otp_ok") === uid) { DB.set("session", user.email); startApp(); return; }
    (DB.getOtp ? DB.getOtp(uid) : Promise.resolve(null)).then(function (otp) {
      if (otp && otp.enabled && otp.secret && window.OTP) {
        pendingOtp = otp.secret; pendingUid = uid; pendingEmail = user.email;
        showLogin();
        $("loginEmail").value = user.email; $("loginEmail").readOnly = true;
        var pf = $("loginPass").closest(".field"); if (pf) pf.style.display = "none";
        $("loginOtpField").style.display = "";
        $("loginError").style.color = "var(--text-muted)";
        $("loginError").textContent = "הזן קוד אימות (OTP) מאפליקציית האימות.";
        $("loginError").style.display = "block";
        $("loginOtp").focus();
      } else {
        sessionStorage.setItem("dt_otp_ok", uid);
        DB.set("session", user.email); startApp();
      }
    });
  }

  function boot() {
    var ready = DB.load ? DB.load() : Promise.resolve();
    ready.catch(function () { }).then(function () {
      seed();
      // סנכרון בזמן אמת בין מנהלים — שינוי של מנהל אחד מתעדכן מיד אצל השני
      if (DB.onChange) DB.onChange(function () {
        if (currentView && $("appShell") && getComputedStyle($("appShell")).display !== "none") showView(currentView);
      });
      if (DB.onUser) DB.onUser(function (u) { if (u) gateOtp(u); else showLogin(); });
      if (!DB.firebaseOn && DB.get("session")) startApp();
    });

    $("loginForm").addEventListener("submit", function () {
      $("loginError").style.display = "none";
      function showErr(t) { $("loginError").style.color = "#ff8a72"; $("loginError").textContent = t; $("loginError").style.display = "block"; }

      // שלב OTP (כבר מחוברים, נדרש קוד)
      if (pendingOtp) {
        var code = ($("loginOtp").value || "").trim();
        if (!code) { showErr("הזן את קוד האימות מהאפליקציה."); return; }
        window.OTP.verify(pendingOtp, code).then(function (ok) {
          if (ok) { sessionStorage.setItem("dt_otp_ok", pendingUid); DB.set("session", pendingEmail); pendingOtp = null; startApp(); }
          else { showErr("קוד האימות שגוי. נסה שוב."); }
        });
        return;
      }

      // שלב סיסמה
      var email = $("loginEmail").value, pass = $("loginPass").value;
      var attempt = DB.signIn ? DB.signIn(email, pass) : Promise.resolve(null);
      attempt.then(function (res) {
        if (res === true) return; // onUser → gateOtp ימשיך
        if (login(email)) { DB.set("session", email); startApp(); }
        else { showErr("אימייל לא מורשה לניהול."); }
      }).catch(function (e) { showErr(DB.authErrorText ? DB.authErrorText(e) : "התחברות נכשלה"); });
    });
  }

  function startApp() {
    $("loginScreen").style.display = "none";
    $("appShell").style.display = "grid";
    // טעינת נתוני המנהל (settings/regs — קריאים למנהלים בלבד) לפני רינדור
    (DB.loadAdmin ? DB.loadAdmin() : Promise.resolve()).catch(function () {}).then(function () {
      renderDashboard(); fillGameSelects();
      showView("dashboard");
    });
  }

  /* ---- Idle auto-logout (15 min) ---- */
  (function () {
    var IDLE_MS = 15 * 60 * 1000;
    var timer = null;
    function idleLogout() {
      localStorage.removeItem("dt_session");
      try { sessionStorage.removeItem("dt_otp_ok"); } catch (_) {}
      var done = DB.signOut ? DB.signOut() : Promise.resolve();
      done.catch(function () {}).then(function () { location.href = "index.html?idle=1"; });
    }
    function resetTimer() {
      clearTimeout(timer);
      if ($("appShell") && getComputedStyle($("appShell")).display !== "none") {
        timer = setTimeout(idleLogout, IDLE_MS);
      }
    }
    ["mousemove", "keydown", "touchstart", "pointerdown", "click", "scroll"].forEach(function (ev) {
      document.addEventListener(ev, resetTimer, { passive: true, capture: true });
    });
  })();

  /* event delegation */
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-view],[data-jump],[data-edit-t],[data-del-t],[data-edit-g],[data-del-g],[data-del-r],[data-move],[data-del-admin],[data-del-gal],[data-del-wa],[data-wa-group],[data-go-result]");
    if (!t) return;
    var a;
    if (t.hasAttribute("data-view")) showView(t.getAttribute("data-view"));
    else if (t.hasAttribute("data-jump")) showView(t.getAttribute("data-jump"));
    else if ((a = t.getAttribute("data-edit-t"))) {
      var tt = DB.get("tournaments", []).filter(function (x) { return x.id === a; })[0];
      if (tt) { $("tId").value = tt.id; $("tName").value = tt.name; $("tFormat").value = tt.format; $("tDate").value = tt.date; $("tCity").value = tt.city; $("tPrice").value = tt.price; $("tFormTitle").textContent = "עריכת טורניר"; window.scrollTo(0, 0); }
    }
    else if ((a = t.getAttribute("data-del-t"))) {
      if (confirm("למחוק את הטורניר?")) { DB.set("tournaments", DB.get("tournaments", []).filter(function (x) { return x.id !== a; })); renderTournaments(); renderDashboard(); }
    }
    else if ((a = t.getAttribute("data-edit-g"))) {
      var gg = DB.get("games", []).filter(function (x) { return x.id === a; })[0];
      if (gg) { $("gId").value = gg.id; $("gTitle").value = gg.title; $("gFormat").value = gg.format; $("gCategory").value = gg.category || ""; $("gCity").value = gg.city; $("gVenue").value = gg.venue; $("gDate").value = gg.date; $("gTime").value = gg.time; $("gMax").value = gg.max; $("gPrice").value = gg.price || ""; $("gFormTitle").textContent = "עריכת משחק"; window.scrollTo(0, 0); }
    }
    else if ((a = t.getAttribute("data-del-g"))) {
      if (confirm("למחוק את המשחק?")) { DB.set("games", DB.get("games", []).filter(function (x) { return x.id !== a; })); renderGames(); renderDashboard(); fillGameSelects(); }
    }
    else if ((a = t.getAttribute("data-del-r"))) {
      var gid = t.getAttribute("data-gid") || $("regGameSel").value;
      (DB.deleteRegistration ? DB.deleteRegistration(a, gid) : Promise.resolve()).then(function () { renderRegs(); });
    }
    else if ((a = t.getAttribute("data-move"))) { var pr = a.split("|"); move(pr[0], pr[1]); }
    else if ((a = t.getAttribute("data-del-admin"))) {
      if (!confirm("לשלול הרשאת ניהול מ-" + a + "?")) return;
      (DB.setAdminClaim ? DB.setAdminClaim(a, false) : Promise.reject(new Error("לא זמין")))
        .then(function () { renderSettings(); })
        .catch(function (e) { alert("⚠️ " + (DB.authErrorText ? DB.authErrorText(e) : (e.message || e))); });
    }
    else if ((a = t.getAttribute("data-del-gal"))) {
      if (confirm("למחוק פריט מהגלריה?")) (DB.deleteGalleryItem ? DB.deleteGalleryItem(a) : Promise.resolve()).then(renderGalleryAdmin);
    }
    else if ((a = t.getAttribute("data-go-result"))) {
      // מהסקירה: פותח חלוקת כוחות עם המשחק הזה ומשחזר כוחות שמורים
      showView("teams");
      if ($("teamGameSel")) $("teamGameSel").value = a;
      restoreTeamState(a);
    }
    else if ((a = t.getAttribute("data-del-wa"))) { removeWaGroup(a); }
    else if ((a = t.getAttribute("data-wa-group"))) {
      var pg = (window.__waPendingGroups || []).filter(function (x) { return x.id === a; })[0];
      if (pg) { sendToGroup(pg, window.__waPendingMsg || ""); $("waPicker").style.display = "none"; }
    }
  });

  /* form buttons (wired after DOM ready) */
  document.addEventListener("DOMContentLoaded", function () {
    boot();
    $("logoutBtn").addEventListener("click", function () {
      localStorage.removeItem("dt_session");
      try { sessionStorage.removeItem("dt_otp_ok"); } catch (_) { }
      var done = DB.signOut ? DB.signOut() : Promise.resolve();
      done.catch(function () { }).then(function () { location.href = "index.html"; });
    });
    $("tSave").addEventListener("click", tournSave);
    $("tReset").addEventListener("click", tournReset);
    $("gSave").addEventListener("click", gameSave);
    $("gReset").addEventListener("click", gameReset);
    $("regGameSel").addEventListener("change", renderRegs);
    $("regAdd").addEventListener("click", regAdd);
    $("genTeams").addEventListener("click", function () { genTeams(false); });
    $("shuffleTeams").addEventListener("click", function () { genTeams(true); });
    $("loadPaste").addEventListener("click", loadPaste);
    $("finishTeams").addEventListener("click", finish);
    $("saveResult").addEventListener("click", saveResult);
    $("copyTeams").addEventListener("click", function () { if (STATE.teams.some(function (x) { return x.length; })) { copy(buildMessage()); $("waHint").textContent = "ההודעה הועתקה ללוח ✅"; } });
    $("addWaGroup").addEventListener("click", addWaGroup);
    $("addAdmin").addEventListener("click", function () {
      var v = $("setAdminEmail").value.trim(); if (!v) return;
      var btn = $("addAdmin"); btn.disabled = true;
      (DB.setAdminClaim ? DB.setAdminClaim(v, true) : Promise.reject(new Error("לא זמין")))
        .then(function () { $("setAdminEmail").value = ""; renderSettings(); alert("✅ " + v + " הוגדר כמנהל"); })
        .catch(function (e) { alert("⚠️ " + (DB.authErrorText ? DB.authErrorText(e) : (e.message || e))); })
        .then(function () { btn.disabled = false; });
    });
    $("saveMyName").addEventListener("click", function () {
      var n = $("setMyName").value.trim(); if (!n) return;
      (DB.saveMember ? DB.saveMember({ name: n }) : Promise.resolve()).then(function () { renderDashboard(); alert("נשמר ✅"); }).catch(function (e) { alert("שגיאה: " + (DB.authErrorText ? DB.authErrorText(e) : e)); });
    });
    $("savePay").addEventListener("click", savePaySettings);
    $("galAdd").addEventListener("click", galAdd);
    $("galType").addEventListener("change", galTypeToggle);
    $("otpEnableBtn").addEventListener("click", otpEnableStart);
    $("otpConfirmBtn").addEventListener("click", otpConfirm);
    $("otpDisableBtn").addEventListener("click", otpDisable);
  });
})();
