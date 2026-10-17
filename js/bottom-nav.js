(function () {
  "use strict";

  const items = [
    {
      key: "home",
      label: "App Home",
      icon: "home",
      path: "home.html"
    },
    {
      key: "career",
      label: "Plan Career",
      icon: "business_center",
      path: "career-guidance.html"
    },
    {
      key: "courses",
      label: "Match Courses",
      icon: "school",
      path: "recommendation.html"
    },
    {
      key: "housing",
      label: "Housing",
      icon: "apartment",
      path: "more-service/accommodation-assist.html"
    },
    {
      key: "transport",
      label: "Transport",
      icon: "directions_bus",
      path: "more-service/transport-assist.html"
    }
  ];

  function getPath() {
    return String(window.location.pathname || "").replace(/\\/g, "/").toLowerCase();
  }

  function isMoreServicePage() {
    return getPath().includes("/more-service/");
  }

  function toHref(path) {
    if (!isMoreServicePage()) return path;
    if (path.startsWith("more-service/")) return path.replace(/^more-service\//, "");
    return `../${path}`;
  }

  function getActiveKey() {
    const path = getPath();
    if (path.endsWith("/career-guidance.html") || path.includes("/more-service/career-guidance.html")) return "career";
    if (path.endsWith("/recommendation.html")) return "courses";
    if (path.includes("/more-service/accommodation-assist.html")) return "housing";
    if (path.includes("/more-service/transport-assist.html")) return "transport";
    if (path.endsWith("/home.html")) return "home";
    return "";
  }

  function activateClickedItem(event) {
    const target = event.target.closest(".bottom-nav.kagie-shared-bottom-nav .bottom-nav-item");
    if (!target) return;

    const nav = target.closest(".bottom-nav");
    if (!nav) return;

    nav.querySelectorAll(".bottom-nav-item").forEach((item) => {
      item.classList.remove("active");
      item.removeAttribute("aria-current");
    });
    target.classList.add("active");
    target.setAttribute("aria-current", "page");
  }

  function bindNavClicks() {
    if (document.documentElement.dataset.kagieBottomNavBound === "true") return;
    document.documentElement.dataset.kagieBottomNavBound = "true";
    document.addEventListener("click", activateClickedItem);
  }

  function buildNav() {
    // Staff catalog screens use their own workspace navigation.
    if (/\/(assistant|master-admin|admin)\//.test(getPath()) || /\/(institutions|question-papers)\.html$/.test(getPath())) {
      document.querySelectorAll(".bottom-nav").forEach((nav) => nav.remove());
      return;
    }
    const activeKey = getActiveKey();
    let nav = document.querySelector(".bottom-nav");
    if (!nav) {
      nav = document.createElement("nav");
      document.body.appendChild(nav);
    }

    nav.className = "bottom-nav kagie-shared-bottom-nav";
    nav.setAttribute("aria-label", "Primary");
    nav.innerHTML = items.map((item) => {
      const active = item.key === activeKey;
      const current = active ? ' aria-current="page"' : "";
      return `
        <a class="bottom-nav-item${active ? " active" : ""}" href="${toHref(item.path)}"${current}>
          <span class="material-icons-outlined bottom-nav-icon" aria-hidden="true">${item.icon}</span>
          <span class="bottom-nav-label">${item.label}</span>
        </a>
      `;
    }).join("");

    document.body.classList.add("kagie-bottom-nav-ready");
  }

  bindNavClicks();

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildNav, { once: true });
  } else {
    buildNav();
  }
})();
