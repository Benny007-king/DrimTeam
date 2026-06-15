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
