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

  // Lightbox for gallery
  var lb = document.getElementById("lightbox");
  if (lb) {
    var lbImg = document.getElementById("lbImg");
    var lbClose = document.getElementById("lbClose");
    document.querySelectorAll(".gallery__item img").forEach(function (img) {
      img.addEventListener("click", function () {
        lbImg.src = img.src;
        lbImg.alt = img.alt || "";
        lb.classList.add("open");
      });
    });
    function closeLb() { lb.classList.remove("open"); lbImg.src = ""; }
    lbClose.addEventListener("click", closeLb);
    lb.addEventListener("click", function (e) { if (e.target === lb) closeLb(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeLb(); });
  }

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
