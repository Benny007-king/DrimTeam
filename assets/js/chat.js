/* ============================================================
   DrimTeam — community chat (logged-in members only)
   Floating button (bottom-left) + panel.
   Tabs: public room · private 1:1 (with user search) · groups.
   Data: Firestore "chat" / "dms" / "groups".
   ============================================================ */
(function () {
  "use strict";
  if (!window.DTDB || !DTDB.onUser) return;

  var btn, panel, listEl, inputEl, formEl, titleEl, backEl, tabsEl, searchRow, searchEl;
  var built = false, myUid = null, myName = "";
  var mode = "public";        // public | dmlist | groups | dm | group
  var conv = null, grp = null;
  var unsub = null;
  var recentDms = [];

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]; }); }
  function timeStr(ts) { try { var d = (ts && ts.toDate) ? ts.toDate() : (ts ? new Date(ts) : new Date()); return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }); } catch (e) { return ""; } }
  function stopSub() { if (unsub) { try { unsub(); } catch (e) {} unsub = null; } }
  function scrollBottom() { if (listEl) listEl.scrollTop = listEl.scrollHeight; }

  function build() {
    if (built) return; built = true;

    btn = document.createElement("button");
    btn.className = "dt-chat-btn"; btn.type = "button"; btn.setAttribute("aria-label", "צ'אט קהילתי");
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.2A8 8 0 1 1 21 12z" stroke-linejoin="round"/></svg>';

    panel = document.createElement("div");
    panel.className = "dt-chat-panel"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "צ'אט");
    panel.innerHTML =
      '<div class="dt-chat-head">' +
        '<button type="button" class="dt-chat-back" aria-label="חזרה" style="display:none">‹</button>' +
        '<span class="dt-chat-title">💬 צ\'אט הקהילה</span>' +
        '<button type="button" class="dt-chat-close" aria-label="סגור">×</button>' +
      '</div>' +
      '<div class="dt-chat-tabs">' +
        '<button type="button" class="dt-chat-tab active" data-tab="public">כללי</button>' +
        '<button type="button" class="dt-chat-tab" data-tab="dmlist">פרטי</button>' +
        '<button type="button" class="dt-chat-tab" data-tab="groups">קבוצות</button>' +
      '</div>' +
      '<div class="dt-chat-search" style="display:none"><input class="dt-chat-input" id="dtChatSearch" type="text" placeholder="חיפוש משתמש לשליחת הודעה…" autocomplete="off" /></div>' +
      '<div class="dt-chat-list" id="dtChatList"></div>' +
      '<form class="dt-chat-form" id="dtChatForm">' +
        '<input class="dt-chat-input" id="dtChatInput" type="text" maxlength="1000" placeholder="כתבו הודעה…" autocomplete="off" />' +
        '<button class="dt-chat-send" type="submit" aria-label="שלח">➤</button>' +
      '</form>';

    document.body.appendChild(btn);
    document.body.appendChild(panel);
    listEl = panel.querySelector("#dtChatList");
    inputEl = panel.querySelector("#dtChatInput");
    formEl = panel.querySelector("#dtChatForm");
    titleEl = panel.querySelector(".dt-chat-title");
    backEl = panel.querySelector(".dt-chat-back");
    tabsEl = panel.querySelector(".dt-chat-tabs");
    searchRow = panel.querySelector(".dt-chat-search");
    searchEl = panel.querySelector("#dtChatSearch");

    btn.addEventListener("click", function () { panel.classList.toggle("open"); if (panel.classList.contains("open")) openPublic(); });
    panel.querySelector(".dt-chat-close").addEventListener("click", function () { panel.classList.remove("open"); });
    backEl.addEventListener("click", function () { if (mode === "group") openGroups(); else openPublic(); });
    tabsEl.addEventListener("click", function (e) {
      var t = e.target.closest("[data-tab]"); if (!t) return;
      var tab = t.getAttribute("data-tab");
      if (tab === "public") openPublic(); else if (tab === "dmlist") openDmList(); else openGroups();
    });
    listEl.addEventListener("click", function (e) {
      var dm = e.target.closest("[data-dm-uid]");
      if (dm) { if (dm.getAttribute("data-dm-uid") !== myUid) openDm(dm.getAttribute("data-dm-uid"), dm.getAttribute("data-dm-name") || "משתמש"); return; }
      var g = e.target.closest("[data-group-id]");
      if (g) openGroup(g.getAttribute("data-group-id"), g.getAttribute("data-group-name") || "קבוצה");
    });
    var searchT = null;
    searchEl.addEventListener("input", function () {
      clearTimeout(searchT);
      var q = searchEl.value.trim();
      searchT = setTimeout(function () {
        if (!q) { renderDmList(recentDms); return; }
        DTDB.searchUsers(q).then(function (users) {
          if (mode !== "dmlist") return;
          listEl.innerHTML = users.length
            ? users.map(function (u) { return '<button type="button" class="dt-chat-conv" data-dm-uid="' + esc(u.uid) + '" data-dm-name="' + esc(u.name) + '"><span class="dt-chat-conv-name">' + esc(u.name) + "</span></button>"; }).join("")
            : '<div class="dt-chat-empty">לא נמצאו משתמשים.</div>';
        });
      }, 220);
    });
    formEl.addEventListener("submit", function (e) {
      e.preventDefault();
      var text = (inputEl.value || "").trim(); if (!text) return;
      inputEl.value = "";
      var p = (mode === "group" && grp) ? DTDB.sendGroupMessage(grp.id, text, myName)
            : (mode === "dm" && conv) ? DTDB.sendDM(conv.uid, conv.name, text, myName)
            : DTDB.sendChatMessage(text, myName);
      p.catch(function (err) { inputEl.value = text; alert("שליחה נכשלה: " + (DTDB.authErrorText ? DTDB.authErrorText(err) : (err.message || err))); });
    });
  }

  function setTabs(active) {
    tabsEl.style.display = (mode === "dm" || mode === "group") ? "none" : "";
    tabsEl.querySelectorAll(".dt-chat-tab").forEach(function (b) { b.classList.toggle("active", b.getAttribute("data-tab") === active); });
    searchRow.style.display = (mode === "dmlist") ? "" : "none";
  }

  function openPublic() {
    mode = "public"; conv = null; grp = null; stopSub();
    titleEl.textContent = "💬 צ'אט הקהילה"; backEl.style.display = "none";
    formEl.style.display = ""; inputEl.placeholder = "כתבו הודעה לכולם…";
    setTabs("public");
    unsub = DTDB.onChatMessages(renderPublic, 100);
  }
  function openDmList() {
    mode = "dmlist"; conv = null; grp = null; stopSub();
    titleEl.textContent = "✉️ הודעות פרטיות"; backEl.style.display = "none";
    formEl.style.display = "none"; setTabs("dmlist");
    searchEl.value = "";
    unsub = DTDB.onMyDMs(function (c) { recentDms = c; if (mode === "dmlist" && !searchEl.value.trim()) renderDmList(c); });
  }
  function openGroups() {
    mode = "groups"; conv = null; grp = null; stopSub();
    titleEl.textContent = "👥 קבוצות"; backEl.style.display = "none";
    formEl.style.display = "none"; setTabs("groups");
    unsub = DTDB.onMyGroups(renderGroupsList);
  }
  function openDm(uid, name) {
    mode = "dm"; conv = { uid: uid, name: name }; grp = null; stopSub();
    titleEl.textContent = "✉️ " + name; backEl.style.display = "";
    formEl.style.display = ""; inputEl.placeholder = "הודעה אל " + name + "…"; setTabs("dm");
    unsub = DTDB.onDM(DTDB.dmConvId(myUid, uid), renderDm); inputEl.focus();
  }
  function openGroup(id, name) {
    mode = "group"; grp = { id: id, name: name }; conv = null; stopSub();
    titleEl.textContent = "👥 " + name; backEl.style.display = "";
    formEl.style.display = ""; inputEl.placeholder = "הודעה לקבוצה…"; setTabs("group");
    unsub = DTDB.onGroupMessages(id, renderGroupMsgs); inputEl.focus();
  }

  function bubbleRow(m, mine, nameHtml) {
    return '<div class="dt-chat-msg' + (mine ? " mine" : "") + '">' + (mine ? "" : (nameHtml || "")) +
      '<div class="dt-chat-bubble">' + esc(m.text || "") + "</div>" +
      '<div class="dt-chat-time">' + esc(timeStr(m.createdAt)) + "</div></div>";
  }
  function renderPublic(msgs) {
    if (mode !== "public") return;
    if (!msgs.length) { listEl.innerHTML = '<div class="dt-chat-empty">עדיין אין הודעות — היו הראשונים לכתוב! 👋</div>'; return; }
    listEl.innerHTML = msgs.map(function (m) {
      var nameHtml = '<div class="dt-chat-name" data-dm-uid="' + esc(m.uid) + '" data-dm-name="' + esc(m.name || "משתמש") + '" title="לחצו לצ\'אט אישי">' + esc(m.name || "אורח") + "</div>";
      return bubbleRow(m, m.uid === myUid, nameHtml);
    }).join("");
    scrollBottom();
  }
  function renderDmList(convs) {
    if (mode !== "dmlist") return;
    if (!convs.length) { listEl.innerHTML = '<div class="dt-chat-empty">אין עדיין שיחות.<br>חפשו משתמש למעלה או לחצו על שם בצ\'אט הכללי 👤</div>'; return; }
    listEl.innerHTML = convs.map(function (c) {
      return '<button type="button" class="dt-chat-conv" data-dm-uid="' + esc(c.partnerUid) + '" data-dm-name="' + esc(c.partnerName) + '">' +
        '<span class="dt-chat-conv-name">' + esc(c.partnerName) + "</span>" +
        '<span class="dt-chat-conv-last">' + esc((c.last || "").slice(0, 40)) + "</span></button>";
    }).join("");
  }
  function renderGroupsList(groups) {
    if (mode !== "groups") return;
    if (!groups.length) { listEl.innerHTML = '<div class="dt-chat-empty">לא צורפת עדיין לאף קבוצה.</div>'; return; }
    listEl.innerHTML = groups.map(function (g) {
      return '<button type="button" class="dt-chat-conv" data-group-id="' + esc(g.id) + '" data-group-name="' + esc(g.name || "קבוצה") + '">' +
        '<span class="dt-chat-conv-name">👥 ' + esc(g.name || "קבוצה") + "</span>" +
        '<span class="dt-chat-conv-last">' + (g.members ? g.members.length : 0) + " חברים</span></button>";
    }).join("");
  }
  function renderDm(msgs) {
    if (mode !== "dm") return;
    if (!msgs.length) { listEl.innerHTML = '<div class="dt-chat-empty">התחילו שיחה עם ' + esc(conv.name) + " 👋</div>"; return; }
    listEl.innerHTML = msgs.map(function (m) { return bubbleRow(m, m.from === myUid, ""); }).join("");
    scrollBottom();
  }
  function renderGroupMsgs(msgs) {
    if (mode !== "group") return;
    if (!msgs.length) { listEl.innerHTML = '<div class="dt-chat-empty">אין עדיין הודעות בקבוצה — פתחו בשיחה 👋</div>'; return; }
    listEl.innerHTML = msgs.map(function (m) {
      var nameHtml = '<div class="dt-chat-name" style="cursor:default">' + esc(m.fromName || "משתמש") + "</div>";
      return bubbleRow(m, m.from === myUid, nameHtml);
    }).join("");
    scrollBottom();
  }

  function show() { build(); btn.style.display = "grid"; }
  function hide() { stopSub(); if (panel) panel.classList.remove("open"); if (btn) btn.style.display = "none"; }

  DTDB.onUser(function (user) {
    if (!user) { myUid = null; hide(); return; }
    myUid = user.uid;
    myName = (user.displayName || (user.email || "").split("@")[0] || "אורח");
    if (DTDB.upsertDirectory) DTDB.upsertDirectory(myName);
    if (DTDB.getMyMember) DTDB.getMyMember().then(function (m) {
      if (m && m.name) { myName = m.name.trim().split(/\s+/)[0]; if (DTDB.upsertDirectory) DTDB.upsertDirectory(myName); }
    }).catch(function () {});
    show();
  });
})();
