/* ============================================================
   Theme (light / dark) — default dark, remembered via cookie
   (so it persists even for logged-out visitors). Applied on every page.
   ============================================================ */
(function () {
  "use strict";
  var KEY = "dt_theme";
  function getCookie(n) { var m = document.cookie.match("(?:^|; )" + n + "=([^;]*)"); return m ? decodeURIComponent(m[1]) : null; }
  function setCookie(n, v) { document.cookie = n + "=" + encodeURIComponent(v) + ";path=/;max-age=" + (60 * 60 * 24 * 365) + ";SameSite=Lax"; }
  function current() { return document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark"; }
  function apply(t) { document.documentElement.setAttribute("data-theme", t === "light" ? "light" : "dark"); }
  // ברירת מחדל חשוך; נשמרת בחירת המשתמש בקוקי
  apply(getCookie(KEY) === "light" ? "light" : "dark");

  var SUN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2v2.4M12 19.6V22M4.2 4.2l1.7 1.7M18.1 18.1l1.7 1.7M2 12h2.4M19.6 12H22M4.2 19.8l1.7-1.7M18.1 5.9l1.7-1.7" stroke-linecap="round"/></svg>';
  var MOON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M21 12.8A8.5 8.5 0 1 1 11.2 3a6.6 6.6 0 0 0 9.8 9.8z"/></svg>';
  function icon(t) { return t === "light" ? MOON : SUN; } // מציג את היעד: כהה→שמש (מעבר לבהיר), בהיר→ירח

  function mount() {
    if (document.querySelector(".theme-toggle")) return;
    var b = document.createElement("button");
    b.className = "theme-toggle"; b.type = "button";
    b.setAttribute("aria-label", "מצב בהיר / כהה");
    b.title = "מצב בהיר / כהה";
    b.innerHTML = icon(current());
    b.addEventListener("click", function () {
      var t = current() === "light" ? "dark" : "light";
      apply(t); setCookie(KEY, t); b.innerHTML = icon(t);
    });
    var slot = document.querySelector(".nav__actions");
    if (slot) slot.insertBefore(b, slot.firstChild);
    else { b.classList.add("theme-toggle--float"); document.body.appendChild(b); }
  }
  if (document.readyState !== "loading") mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();

/* Inject "סטטיסטיקות" nav link on every page (menu item for the stats page) */
(function () {
  "use strict";
  function mount() {
    var nav = document.querySelector(".nav__links"); if (!nav) return;
    if (nav.querySelector('a[href="stats.html"]')) return; // כבר קיים
    var a = document.createElement("a");
    a.href = "stats.html"; a.textContent = "סטטיסטיקות";
    var anchor = nav.querySelector('a[href="takanon.html"]');
    if (anchor) nav.insertBefore(a, anchor); else nav.appendChild(a);
  }
  if (document.readyState !== "loading") mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();

/* DrimTeam — interactions */
(function () {
  // Mobile nav toggle
  var toggle = document.querySelector(".nav__toggle");
  var links = document.querySelector(".nav__links");
  if (toggle && links) {
    toggle.addEventListener("click", function () {
      links.classList.toggle("open");
      toggle.classList.toggle("active");
    });
    links.querySelectorAll("a").forEach(function (a) {
      a.addEventListener("click", function () {
        links.classList.remove("open");
        toggle.classList.remove("active");
      });
    });
  }

  // Schedule view tabs (demo)
  document.querySelectorAll(".view-tabs button").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll(".view-tabs button").forEach(function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
    });
  });

  // (Lightbox is handled per-page in gallery.html — supports images + video + arrows)

  // Simple client-side game filtering (demo)
  var cityFilter = document.querySelector("[data-filter-city]");
  if (cityFilter) {
    cityFilter.addEventListener("change", function () {
      var val = cityFilter.value;
      document.querySelectorAll(".game-card").forEach(function (card) {
        var city = card.getAttribute("data-city") || "";
        card.style.display = !val || city === val ? "" : "none";
      });
    });
  }
})();

/* ============================================================
   Accessibility widget (Israeli law / WCAG AA helpers)
   Self-injects a floating button + panel on every page.
   ============================================================ */
(function () {
  "use strict";
  if (document.querySelector(".a11y-btn")) return;
  var KEY = "dt_a11y";
  var FONT = [100, 108, 118, 130];
  var state = (function () { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })();

  function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
  function syncUI() {
    ["contrast", "grayscale", "links", "readable", "nomotion"].forEach(function (k) {
      var el = panel.querySelector('[data-toggle="' + k + '"]'); if (el) el.classList.toggle("active", !!state[k]);
    });
    var fl = panel.querySelector(".a11y-fontlevel"); if (fl) fl.textContent = (FONT[state.font || 0] || 100) + "%";
  }
  function apply() {
    var h = document.documentElement;
    h.classList.toggle("a11y-contrast", !!state.contrast);
    h.classList.toggle("a11y-grayscale", !!state.grayscale);
    h.classList.toggle("a11y-links", !!state.links);
    h.classList.toggle("a11y-readable", !!state.readable);
    h.classList.toggle("a11y-nomotion", !!state.nomotion);
    h.style.fontSize = (FONT[state.font || 0] || 100) + "%";
    syncUI();
  }

  var btn = document.createElement("button");
  btn.className = "a11y-btn"; btn.type = "button";
  btn.setAttribute("aria-label", "תפריט נגישות"); btn.setAttribute("aria-haspopup", "true"); btn.setAttribute("aria-expanded", "false");
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="3.6" r="2"/><path d="M21 8.5l-6.2 1.1v3.6L16 20h-2.1l-1.4-5.3h-1l-1.4 5.3H8L9.2 13.2V9.6L3 8.5l.3-2 5.9 1.1c1.9.3 3.7.3 5.6 0L20.7 6.5z"/></svg>';

  var panel = document.createElement("div");
  panel.className = "a11y-panel"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "אפשרויות נגישות");
  panel.innerHTML =
    "<h2>תפריט נגישות</h2>" +
    '<div class="a11y-row">' +
      '<button class="a11y-opt" data-font="-" aria-label="הקטנת טקסט">א−</button>' +
      '<span class="a11y-opt a11y-fontlevel" style="cursor:default">100%</span>' +
      '<button class="a11y-opt" data-font="+" aria-label="הגדלת טקסט">א+</button>' +
    "</div>" +
    '<div class="a11y-row"><button class="a11y-opt" data-toggle="contrast">ניגודיות גבוהה</button></div>' +
    '<div class="a11y-row"><button class="a11y-opt" data-toggle="grayscale">גווני אפור</button></div>' +
    '<div class="a11y-row"><button class="a11y-opt" data-toggle="links">הדגשת קישורים</button></div>' +
    '<div class="a11y-row"><button class="a11y-opt" data-toggle="readable">גופן קריא</button></div>' +
    '<div class="a11y-row"><button class="a11y-opt" data-toggle="nomotion">עצירת אנימציות</button></div>' +
    '<button class="a11y-opt a11y-reset">איפוס הגדרות נגישות</button>' +
    '<a class="a11y-link" href="accessibility.html">להצהרת הנגישות ←</a>';

  document.body.appendChild(btn); document.body.appendChild(panel);

  btn.addEventListener("click", function () { var o = panel.classList.toggle("open"); btn.setAttribute("aria-expanded", o ? "true" : "false"); });
  document.addEventListener("click", function (e) { if (!panel.contains(e.target) && !btn.contains(e.target)) { panel.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); } });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") { panel.classList.remove("open"); btn.setAttribute("aria-expanded", "false"); } });
  panel.querySelectorAll("[data-toggle]").forEach(function (el) {
    el.addEventListener("click", function () { var k = el.getAttribute("data-toggle"); state[k] = !state[k]; save(); apply(); });
  });
  panel.querySelector('[data-font="+"]').addEventListener("click", function () { state.font = Math.min(FONT.length - 1, (state.font || 0) + 1); save(); apply(); });
  panel.querySelector('[data-font="-"]').addEventListener("click", function () { state.font = Math.max(0, (state.font || 0) - 1); save(); apply(); });
  panel.querySelector(".a11y-reset").addEventListener("click", function () { state = {}; save(); apply(); });

  apply();
})();

/* ============================================================
   Cookie consent popup — choice remembered for 48 hours
   ============================================================ */
(function () {
  "use strict";
  if (document.querySelector(".cookie-pop")) return;
  var KEY = "dt_cookie";
  var TTL = 48 * 60 * 60 * 1000; // 48 שעות
  var saved = (function () { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch (e) { return null; } })();
  if (saved && saved.t && (Date.now() - saved.t) < TTL) return; // הבחירה עדיין בתוקף

  function decide(choice) {
    try { localStorage.setItem(KEY, JSON.stringify({ choice: choice, t: Date.now() })); } catch (e) {}
    pop.classList.remove("show");
    setTimeout(function () { if (pop.parentNode) pop.parentNode.removeChild(pop); }, 350);
  }

  var pop = document.createElement("div");
  pop.className = "cookie-pop";
  pop.setAttribute("role", "dialog");
  pop.setAttribute("aria-label", "הסכמה לעוגיות");
  pop.innerHTML =
    '<div class="cookie-pop__text">' +
      '<strong>🍪 אנחנו משתמשים בעוגיות</strong>' +
      '<span>אתר DrimTeam משתמש בעוגיות כדי לשפר את חוויית הגלישה ולשמור את ההעדפות שלכם. ' +
      'ניתן לקרוא עוד ב<a href="accessibility.html">הצהרת הנגישות</a>.</span>' +
    "</div>" +
    '<div class="cookie-pop__btns">' +
      '<button type="button" class="btn btn--primary btn--sm" data-cookie="accept">אישור</button>' +
      '<button type="button" class="btn btn--ghost btn--sm" data-cookie="decline">דחייה</button>' +
    "</div>";

  document.body.appendChild(pop);
  requestAnimationFrame(function () { pop.classList.add("show"); });
  pop.querySelector('[data-cookie="accept"]').addEventListener("click", function () { decide("accept"); });
  pop.querySelector('[data-cookie="decline"]').addEventListener("click", function () { decide("decline"); });
})();

/* ============================================================
   Post-meeting rating prompt — invites participants of a game that
   just ended to rate it (sent to WhatsApp only, never the site chat).
   Games the user registered for are remembered locally (dt_my_games).
   ============================================================ */
(function () {
  "use strict";
  function lsGet(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function todayStr() { return new Date().toISOString().slice(0, 10); }
  function endMs(g) { return g.endTime ? new Date(g.date + "T" + g.endTime + ":00").getTime() : new Date(g.date + "T23:59:00").getTime(); }
  function ended(g) { return Date.now() > endMs(g); }

  var mine = lsGet("dt_my_games", []);
  if (!mine.length) return;
  var rated = lsGet("dt_rated", []);
  var dismissed = lsGet("dt_rate_dismiss", []);
  var WINDOW = 3 * 24 * 60 * 60 * 1000; // מציעים לדרג עד 3 ימים אחרי המפגש
  var now = Date.now();
  var cand = mine.filter(function (g) {
    return g && g.date && ended(g) && (now - endMs(g)) < WINDOW &&
      rated.indexOf(g.id) === -1 && dismissed.indexOf(g.id) === -1;
  });
  if (!cand.length) return;
  cand.sort(function (a, b) { return endMs(b) - endMs(a); });
  var g = cand[0];

  function show() {
    if (document.querySelector(".survey-pop")) return;
    var pop = document.createElement("div");
    pop.className = "cookie-pop survey-pop";
    pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "דירוג מפגש");
    pop.innerHTML =
      '<div class="cookie-pop__text"><strong>⭐ איך היה המפגש?</strong>' +
      '<span>' + (g.title ? (g.title + " — ") : "") + 'נשמח לדירוג קצר. המשוב נשלח אלינו בוואטסאפ בלבד.</span></div>' +
      '<div class="cookie-pop__btns">' +
      '<a class="btn btn--primary btn--sm" href="rate.html?game=' + encodeURIComponent(g.id) + '">לדירוג ←</a>' +
      '<button type="button" class="btn btn--ghost btn--sm" data-skip>לא עכשיו</button></div>';
    // לא להתנגש עם פופאפ העוגיות (אם מוצג)
    if (document.querySelector(".cookie-pop:not(.survey-pop)")) pop.style.bottom = "112px";
    document.body.appendChild(pop);
    requestAnimationFrame(function () { pop.classList.add("show"); });
    pop.querySelector("[data-skip]").addEventListener("click", function () {
      dismissed.push(g.id); lsSet("dt_rate_dismiss", dismissed);
      pop.classList.remove("show");
      setTimeout(function () { if (pop.parentNode) pop.parentNode.removeChild(pop); }, 350);
    });
  }
  setTimeout(show, 1600);
})();
