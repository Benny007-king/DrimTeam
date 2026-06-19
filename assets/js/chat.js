/* ============================================================
   DrimTeam — community chat (logged-in members only)
   Floating button (bottom-left) + panel. Visible & usable only
   when a user is signed in. Messages live in Firestore "chat".
   ============================================================ */
(function () {
  "use strict";
  if (!window.DTDB || !DTDB.onUser) return;

  var btn, panel, listEl, inputEl, unsub = null, built = false, myUid = null, myName = "";

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c];
    });
  }
  function timeStr(ts) {
    try {
      var d = (ts && ts.toDate) ? ts.toDate() : (ts ? new Date(ts) : new Date());
      return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" });
    } catch (e) { return ""; }
  }

  function build() {
    if (built) return;
    built = true;

    btn = document.createElement("button");
    btn.className = "dt-chat-btn"; btn.type = "button";
    btn.setAttribute("aria-label", "צ'אט קהילתי");
    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1-4.2A8 8 0 1 1 21 12z" stroke-linejoin="round"/></svg>';

    panel = document.createElement("div");
    panel.className = "dt-chat-panel"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "צ'אט קהילתי");
    panel.innerHTML =
      '<div class="dt-chat-head"><span>💬 צ\'אט הקהילה</span><button type="button" class="dt-chat-close" aria-label="סגור">×</button></div>' +
      '<div class="dt-chat-list" id="dtChatList"></div>' +
      '<form class="dt-chat-form" id="dtChatForm">' +
        '<input class="dt-chat-input" id="dtChatInput" type="text" maxlength="1000" placeholder="כתבו הודעה…" autocomplete="off" />' +
        '<button class="dt-chat-send" type="submit" aria-label="שלח">➤</button>' +
      '</form>';

    document.body.appendChild(btn);
    document.body.appendChild(panel);
    listEl = panel.querySelector("#dtChatList");
    inputEl = panel.querySelector("#dtChatInput");

    btn.addEventListener("click", function () { panel.classList.toggle("open"); if (panel.classList.contains("open")) { scrollBottom(); inputEl.focus(); } });
    panel.querySelector(".dt-chat-close").addEventListener("click", function () { panel.classList.remove("open"); });
    panel.querySelector("#dtChatForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var text = (inputEl.value || "").trim();
      if (!text) return;
      inputEl.value = "";
      DTDB.sendChatMessage(text, myName).catch(function (err) {
        inputEl.value = text;
        alert("שליחה נכשלה: " + (DTDB.authErrorText ? DTDB.authErrorText(err) : (err.message || err)));
      });
    });
  }

  function scrollBottom() { if (listEl) listEl.scrollTop = listEl.scrollHeight; }

  function render(msgs) {
    if (!listEl) return;
    if (!msgs.length) { listEl.innerHTML = '<div class="dt-chat-empty">עדיין אין הודעות — היו הראשונים לכתוב! 👋</div>'; return; }
    listEl.innerHTML = msgs.map(function (m) {
      var mine = m.uid === myUid;
      return '<div class="dt-chat-msg' + (mine ? " mine" : "") + '">' +
        (mine ? "" : '<div class="dt-chat-name">' + esc(m.name || "אורח") + "</div>") +
        '<div class="dt-chat-bubble">' + esc(m.text || "") + "</div>" +
        '<div class="dt-chat-time">' + esc(timeStr(m.createdAt)) + "</div>" +
        "</div>";
    }).join("");
    scrollBottom();
  }

  function show() {
    build();
    btn.style.display = "";
    if (!unsub) unsub = DTDB.onChatMessages(render, 100);
  }
  function hide() {
    if (unsub) { try { unsub(); } catch (e) {} unsub = null; }
    if (panel) panel.classList.remove("open");
    if (btn) btn.style.display = "none";
  }

  DTDB.onUser(function (user) {
    if (!user) { myUid = null; hide(); return; }
    myUid = user.uid;
    var fb = (user.displayName || (user.email || "").split("@")[0] || "אורח");
    myName = fb;
    if (DTDB.getMyMember) DTDB.getMyMember().then(function (m) { if (m && m.name) myName = m.name.trim().split(/\s+/)[0]; }).catch(function () {});
    show();
  });
})();
