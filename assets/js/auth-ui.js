/* ============================================================
   DrimTeam — auth UI on public pages
   מחובר: אווטאר (תמונה/ראשי תיבות) + העלאת תמונה + יציאה.
   מנהל: גם קישור "ניהול". מחובר → אין כפתור הרשמה/התחברות.
   ============================================================ */
(function () {
  "use strict";
  if (!window.DTDB || !DTDB.onUser) return;

  function rm() { document.querySelectorAll("[data-auth-injected]").forEach(function (e) { e.remove(); }); }
  function initials(s) {
    s = (s || "").trim(); if (!s) return "👤";
    var p = s.split(/\s+/); return ((p[0] && p[0][0]) || "") + ((p[1] && p[1][0]) || "");
  }
  function showDefaultBtns(actions, show) {
    if (!actions) return;
    actions.querySelectorAll("a.btn").forEach(function (b) { b.style.display = show ? "" : "none"; });
  }

  DTDB.onUser(function (user) {
    var actions = document.querySelector(".nav__actions");
    var links = document.querySelector(".nav__links");
    rm();
    if (!user) { showDefaultBtns(actions, true); return; } // לא מחובר → כפתורי התחברות/הרשמה

    Promise.all([DTDB.isAdminEmail(user.email), DTDB.getMyMember()]).then(function (r) {
      var isAdmin = r[0], m = r[1] || {};
      rm();
      showDefaultBtns(actions, false); // מחובר → מסתירים הרשמה/התחברות
      if (!actions) return;

      var full = m.name || user.displayName || "";
      var firstName = full ? full.split(/\s+/)[0] : ((user.email || "").split("@")[0]);
      var name = firstName; // בפרופיל מציגים שם פרטי, לא מייל
      var photo = m.photo || user.photoURL || "";

      var wrap = document.createElement("div");
      wrap.className = "user-menu";
      wrap.setAttribute("data-auth-injected", "1");
      wrap.innerHTML =
        '<button class="user-avatar" aria-label="תפריט משתמש">' +
        (photo ? '<img src="' + photo + '" alt="">' : '<span>' + initials(full || firstName) + "</span>") +
        "</button>" +
        '<div class="user-dropdown">' +
        '<div class="user-name">' + name + "</div>" +
        '<a href="player.html"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M5 17a4 4 0 0 1 8 0M15 9h4M15 13h3" stroke-linecap="round"/></svg> כרטיס שחקן</a>' +
        '<button type="button" data-act="upload"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 16v3a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-3M7 9l5-5 5 5M12 4v12" stroke-linecap="round" stroke-linejoin="round"/></svg> העלאת תמונה</button>' +
        '<button type="button" data-act="reset"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 4v4h4" stroke-linecap="round" stroke-linejoin="round"/></svg> איפוס סיסמה</button>' +
        (isAdmin ? '<a href="admin.html"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6z" stroke-linejoin="round"/></svg> ניהול</a>' : "") +
        '<button type="button" data-act="logout" class="user-logout"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 12H4M9 7l-5 5 5 5M14 4h5v16h-5" stroke-linecap="round" stroke-linejoin="round"/></svg> יציאה</button>' +
        "</div>" +
        '<input type="file" accept="image/*" hidden>';
      actions.appendChild(wrap);

      var av = wrap.querySelector(".user-avatar");
      var dd = wrap.querySelector(".user-dropdown");
      var fi = wrap.querySelector('input[type="file"]');

      av.addEventListener("click", function (e) { e.stopPropagation(); dd.classList.toggle("open"); });
      document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) dd.classList.remove("open"); });
      wrap.querySelector('[data-act="upload"]').addEventListener("click", function () { fi.click(); });
      var rb = wrap.querySelector('[data-act="reset"]');
      if (rb) rb.addEventListener("click", function () {
        dd.classList.remove("open");
        DTDB.resetPassword(user.email)
          .then(function () { alert("✅ נשלח קישור לאיפוס סיסמה ל-" + user.email + " (בדקו גם בספאם)."); })
          .catch(function (e) { alert("⚠️ " + (DTDB.authErrorText ? DTDB.authErrorText(e) : "שגיאה באיפוס סיסמה")); });
      });
      wrap.querySelector('[data-act="logout"]').addEventListener("click", function () {
        DTDB.signOut().then(function () { location.href = "index.html"; });
      });
      fi.addEventListener("change", function () {
        if (!fi.files[0]) return;
        var prev = av.innerHTML; av.innerHTML = "<span>…</span>";
        DTDB.uploadAvatar(fi.files[0]).then(function (url) { av.innerHTML = '<img src="' + url + '" alt="">'; })
          .catch(function () { av.innerHTML = prev; alert("העלאת התמונה נכשלה"); });
      });

      if (isAdmin && links && !links.querySelector('a[href="admin.html"]')) {
        var a = document.createElement("a");
        a.href = "admin.html"; a.textContent = "ניהול"; a.style.color = "var(--lime-400)";
        a.setAttribute("data-auth-injected", "1");
        links.appendChild(a);
      }
    });
  });
})();
