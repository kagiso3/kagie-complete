(function () {
  "use strict";

  var toggle = document.querySelector(".menu-toggle");
  var menu = document.getElementById("mobile-navigation");
  if (!toggle || !menu) return;

  function setOpen(open, returnFocus) {
    menu.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
    if (!open && returnFocus) toggle.focus();
  }

  toggle.addEventListener("click", function () {
    setOpen(menu.hidden);
  });

  menu.addEventListener("click", function (event) {
    if (event.target.closest("a")) setOpen(false);
  });

  document.addEventListener("click", function (event) {
    if (menu.hidden || toggle.contains(event.target) || menu.contains(event.target)) return;
    setOpen(false);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !menu.hidden) setOpen(false, true);
  });

  window.addEventListener("resize", function () {
    if (innerWidth > 980 && !menu.hidden) setOpen(false);
  });
})();
