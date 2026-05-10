(function () {
  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn, { once: true });
    } else {
      fn();
    }
  }

  function cleanLabel(text) {
    return String(text || "")
      .replace(/\s+\d+\s*$/g, "")
      .replace(/\s+\.\.\.\s*$/g, "")
      .trim();
  }

  function tabTarget(tab) {
    const onclick = tab.getAttribute("onclick") || "";
    const match = onclick.match(/switchTab\(['"]([^'"]+)['"]/);
    return match ? match[1] : "";
  }

  function shortLabel(label) {
    const map = {
      "My desk": "Dashboard",
      "Applications queue": "Queue",
      "Communications": "Messages",
      "Commercial": "Services",
      "Catalogue": "Catalog",
      "Applicant view": "Profile"
    };
    return map[label] || label;
  }

  function iconFor(label) {
    const value = label.toLowerCase();
    if (value.includes("overview") || value.includes("desk") || value.includes("dashboard")) return "H";
    if (value.includes("learner") || value.includes("case")) return "U";
    if (value.includes("assistant")) return "A";
    if (value.includes("document")) return "D";
    if (value.includes("message") || value.includes("comm")) return "M";
    if (value.includes("transport")) return "T";
    if (value.includes("catalogue") || value.includes("course")) return "C";
    if (value.includes("commercial")) return "S";
    return "K";
  }

  function activateLinkedNav(originalTab, drawer, bottomNav) {
    if (!originalTab) return;
    const tabs = Array.from(document.querySelectorAll(".subnav .nav-tab"));
    const activeIndex = tabs.indexOf(originalTab);
    drawer?.querySelectorAll("[data-linked-tab]").forEach((button, index) => {
      button.classList.toggle("active", index === activeIndex);
    });
    bottomNav?.querySelectorAll("[data-linked-tab]").forEach((button) => {
      button.classList.toggle("active", Number(button.dataset.linkedTab) === activeIndex);
    });
  }

  function buildResponsiveAdminShell() {
    const subnav = document.querySelector(".subnav");
    const tabs = Array.from(document.querySelectorAll(".subnav .nav-tab"));
    const menuButton = document.querySelector("[data-admin-menu]");
    const brand = document.querySelector(".topbar-brand");
    if (!subnav || !tabs.length || !menuButton || document.querySelector(".admin-drawer")) return;

    const role = document.body.classList.contains("admin-master") ? "Master Admin" : "Assistant Admin";
    const nameNode = document.querySelector("#topbarAdminName, #assistantTopName");
    const name = nameNode?.textContent?.trim() || role;

    const backdrop = document.createElement("div");
    backdrop.className = "admin-drawer-backdrop";

    const drawer = document.createElement("aside");
    drawer.className = "admin-drawer";
    drawer.setAttribute("aria-hidden", "true");
    drawer.innerHTML = `
      <div class="drawer-head">
        <div class="drawer-avatar">${document.body.classList.contains("admin-master") ? "KW" : "AA"}</div>
        <div>
          <strong>${name}</strong>
          <span>${role}</span>
        </div>
        <button class="drawer-close" type="button" aria-label="Close menu">x</button>
      </div>
      <div class="drawer-section-label">Navigation</div>
      <nav class="drawer-nav"></nav>
      <div class="drawer-footer">
        <div class="brand-mark">K</div>
        <div>
          <strong>Kagie</strong>
          <span>Admin workspace</span>
        </div>
      </div>
    `;

    const drawerNav = drawer.querySelector(".drawer-nav");
    tabs.forEach((tab, index) => {
      const label = cleanLabel(tab.childNodes[0]?.textContent || tab.textContent);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `drawer-tab${tab.classList.contains("active") ? " active" : ""}`;
      button.dataset.linkedTab = String(index);
      button.innerHTML = `<span class="drawer-tab-icon">${iconFor(label)}</span><span>${shortLabel(label)}</span>`;
      button.addEventListener("click", () => {
        tab.click();
        closeDrawer();
        activateLinkedNav(tab, drawer, bottomNav);
      });
      drawerNav.appendChild(button);
    });

    const quickLinks = Array.from(document.querySelectorAll(".topbar-btn.ghost, .logout-btn.link-btn"));
    if (quickLinks.length) {
      const label = document.createElement("div");
      label.className = "drawer-section-label";
      label.textContent = "Quick links";
      drawerNav.appendChild(label);
      quickLinks.forEach((link) => {
        const item = document.createElement("a");
        item.className = "drawer-link";
        item.href = link.getAttribute("href") || "#";
        item.textContent = cleanLabel(link.textContent);
        drawerNav.appendChild(item);
      });
    }

    const logout = document.querySelector("#logoutBtn, #logoutLink");
    if (logout) {
      const logoutItem = document.createElement("button");
      logoutItem.type = "button";
      logoutItem.className = "drawer-action";
      logoutItem.textContent = "Sign out";
      logoutItem.addEventListener("click", () => {
        closeDrawer();
        logout.click();
      });
      drawerNav.appendChild(logoutItem);
    }

    const bottomNav = document.createElement("nav");
    bottomNav.className = "mobile-bottom-nav";
    tabs.slice(0, 5).forEach((tab, index) => {
      const label = cleanLabel(tab.childNodes[0]?.textContent || tab.textContent);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `mobile-bottom-item${tab.classList.contains("active") ? " active" : ""}`;
      button.dataset.linkedTab = String(index);
      button.dataset.target = tabTarget(tab);
      button.innerHTML = `<span>${iconFor(label)}</span><small>${shortLabel(label)}</small>`;
      button.addEventListener("click", () => {
        tab.click();
        activateLinkedNav(tab, drawer, bottomNav);
      });
      bottomNav.appendChild(button);
    });

    function openDrawer() {
      document.body.classList.add("admin-drawer-open");
      drawer.setAttribute("aria-hidden", "false");
      menuButton.setAttribute("aria-expanded", "true");
    }

    function closeDrawer() {
      document.body.classList.remove("admin-drawer-open");
      drawer.setAttribute("aria-hidden", "true");
      menuButton.setAttribute("aria-expanded", "false");
    }

    menuButton.setAttribute("aria-expanded", "false");
    menuButton.addEventListener("click", openDrawer);
    backdrop.addEventListener("click", closeDrawer);
    drawer.querySelector(".drawer-close")?.addEventListener("click", closeDrawer);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeDrawer();
    });

    const observer = new MutationObserver(() => {
      const activeTab = tabs.find((tab) => tab.classList.contains("active"));
      activateLinkedNav(activeTab, drawer, bottomNav);
    });
    tabs.forEach((tab) => observer.observe(tab, { attributes: true, attributeFilter: ["class"] }));

    document.body.append(backdrop, drawer, bottomNav);
    if (brand) brand.setAttribute("aria-label", "Kagie admin home");
  }

  ready(buildResponsiveAdminShell);
}());
