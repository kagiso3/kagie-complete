(function () {
  window.KagieHomePageLoaded = true;

  const $ = (selector) => document.querySelector(selector);
  const safe = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const normalizeRole = (role) => {
    const value = String(role || "").trim().toLowerCase();
    if (["master_admin", "master admin", "master-admin", "masteradmin", "super_admin", "super-admin", "super admin", "superadmin", "owner"].includes(value)) return "master_admin";
    if (["assistant_admin", "assistant admin", "assistant-admin", "assistantadmin", "assistant", "admin", "staff", "administrator", "support", "support_staff", "support-staff", "support staff"].includes(value)) return "assistant_admin";
    return "user";
  };

  async function main() {
    const api = window.KagieAPI;
    if (!api) throw new Error("Kagie home services are still loading. Refresh and try again.");
    const currentStudent = api.resolveSessionUser
      ? await api.resolveSessionUser({ attempts: 2, delayMs: 220 })
      : await api?.restoreSession?.();
    if (!currentStudent) {
      window.location.href = "login.html";
      return;
    }
    const currentRole = normalizeRole(currentStudent.role);
    if (currentRole === "assistant_admin") {
      window.location.href = "assistant/dashboard.html";
      return;
    }
    if (currentRole === "master_admin") {
      window.location.href = "master-admin/dashboard.html";
      return;
    }
    if (currentRole !== "user") {
      window.location.href = "login.html";
      return;
    }

    const storedName =
      currentStudent.fullName ||
      currentStudent.name ||
      localStorage.getItem("kagieUserName") ||
      localStorage.getItem("username") ||
      localStorage.getItem("name") ||
      "User";

    const heroTitle = $("#heroTitle");
    const heroSubtitle = $(".hero-subtitle");
    const dashboardBar = $(".dashboard-bar");
    const dashboardPills = Array.from(document.querySelectorAll(".dashboard-bar .dash-pill"));
    const homeQuickStrip = $("#homeQuickStrip");
    const insightStack = $(".insight-stack");
    const homeJourney = $("#homeJourney");
    const homeFocus = $("#homeFocus");
    const homeServiceHub = $("#homeServiceHub");
    const footerZone = $(".footer-zone");
    const carouselHint = $(".carousel-hint");
    const profilePhoto = $("#profilePhoto");
    const profilePlaceholder = $("#profilePlaceholder");
      const menuBtn = $("#menuBtn");
      const menuSheet = $("#menuSheet");
      const closeMenu = $("#closeMenu");
      const logoutBtn = $("#logoutBtn");
      const headerLogoutBtn = $("#headerLogoutBtn");
      const menuLinks = Array.from(document.querySelectorAll("[data-menu-link]"));
      const carousel = $("#carousel");

    let experiencePrefs = api?.getUserExperiencePreferences
      ? api.getUserExperiencePreferences(currentStudent.id)
      : { lowDataMode: false, reducedMotion: false };
    let carouselAnimationEnabled = true;
    let angle = 0;
    let velocity = -0.28;
    let isDragging = false;
    let lastX = 0;
    let dragDistance = 0;
    let dashboardWheelFrame = 0;
    let isDashboardDragging = false;
    let dashboardDragStartX = 0;
    let dashboardStartScrollLeft = 0;
    let dashboardDragMoved = false;
    let applyNavigationLocked = false;
    const bootScreen = window.KagieUX?.showBootScreen?.({
      title: "Kagie",
      message: "Loading your dashboard..."
    }) || null;

    const DEFAULT_AVATAR =
      "data:image/svg+xml;utf8," +
      encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="60" fill="#e6ebf0"/>
          <circle cx="60" cy="60" r="58" fill="none" stroke="#ffffff" stroke-width="4"/>
          <circle cx="60" cy="45" r="22" fill="#ffffff" fill-opacity="0.96"/>
          <path d="M22 98c5-18 22-28 38-28s33 10 38 28" fill="#f8fafc" fill-opacity="0.98"/>
        </svg>
      `);

    function isLegacyGeneratedAvatar(value) {
      const text = String(value || "");
      if (!text.startsWith("data:image/svg+xml")) return false;
      return text.includes("d50000")
        || text.includes("2f7cff")
        || text.includes("linearGradient")
        || text.includes("url(%23bg)")
        || text.includes("url(#bg)");
    }

    function toneTag(tone) {
      return String(tone || "blue").toLowerCase();
    }

    function updateDashboardWheelState() {
      if (!dashboardBar || !dashboardPills.length) return;
      const wheelRect = dashboardBar.getBoundingClientRect();
      const wheelCenter = wheelRect.left + (wheelRect.width / 2);
      let activePill = dashboardPills[0] || null;
      let shortestDistance = Number.POSITIVE_INFINITY;

      dashboardPills.forEach((pill) => {
        const rect = pill.getBoundingClientRect();
        const pillCenter = rect.left + (rect.width / 2);
        const distance = Math.abs(pillCenter - wheelCenter);
        if (distance < shortestDistance) {
          shortestDistance = distance;
          activePill = pill;
        }
      });

      dashboardPills.forEach((pill) => pill.classList.toggle("is-active", pill === activePill));
    }

    function queueDashboardWheelState() {
      if (dashboardWheelFrame) window.cancelAnimationFrame(dashboardWheelFrame);
      dashboardWheelFrame = window.requestAnimationFrame(() => {
        dashboardWheelFrame = 0;
        updateDashboardWheelState();
      });
    }

    function startDashboardDrag(clientX) {
      if (!dashboardBar) return;
      isDashboardDragging = true;
      dashboardDragMoved = false;
      dashboardDragStartX = clientX;
      dashboardStartScrollLeft = dashboardBar.scrollLeft;
      dashboardBar.classList.add("is-dragging");
    }

    function moveDashboardDrag(clientX) {
      if (!dashboardBar || !isDashboardDragging) return;
      const delta = clientX - dashboardDragStartX;
      if (Math.abs(delta) > 4) dashboardDragMoved = true;
      dashboardBar.scrollLeft = dashboardStartScrollLeft - delta;
      queueDashboardWheelState();
    }

    function endDashboardDrag() {
      if (!dashboardBar) return;
      isDashboardDragging = false;
      dashboardBar.classList.remove("is-dragging");
      window.setTimeout(() => {
        dashboardDragMoved = false;
      }, 0);
    }

    function showProfilePhoto(src) {
      profilePhoto.src = src || DEFAULT_AVATAR;
      profilePhoto.style.display = "block";
      profilePlaceholder.style.display = "none";
    }

    function loadSharedProfilePhoto() {
      let savedPhoto = "";
      if (api?.getSharedProfilePhoto) {
        savedPhoto = api.getSharedProfilePhoto();
      } else {
        savedPhoto =
          localStorage.getItem("kagie_profile_photo") ||
          localStorage.getItem("kagieProfileImage") ||
          localStorage.getItem("kagie_profile_avatar_v1") ||
          "";
      }
      if (isLegacyGeneratedAvatar(savedPhoto)) {
        savedPhoto = "";
        try {
          localStorage.removeItem("kagie_profile_avatar_v1");
        } catch (_error) {
          // Ignore storage cleanup issues and continue with the new neutral fallback.
        }
      }
      showProfilePhoto(savedPhoto);
    }

    function applyExperienceMode(prefs) {
      experiencePrefs = { ...experiencePrefs, ...(prefs || {}) };
      document.body.classList.toggle("low-data-mode", !!experiencePrefs.lowDataMode);
      document.body.classList.toggle("reduced-motion", !!experiencePrefs.reducedMotion);
      carouselAnimationEnabled = !(experiencePrefs.lowDataMode || experiencePrefs.reducedMotion);
      if (carouselHint) {
        carouselHint.textContent = "Tap a logo to open the institution guide";
      }
      if (footerZone) {
        footerZone.style.display = "flex";
      }
      updateCarousel();
    }

    function syncInsightStackVisibility() {
      if (!insightStack) return;
      const visibleCards = [...insightStack.querySelectorAll(".insight-card")]
        .filter((card) => !card.classList.contains("is-hidden"));
      insightStack.classList.toggle("is-empty", visibleCards.length === 0);
    }

    function setInsightCard(node, html) {
      if (!node) return;
      const content = String(html || "").trim();
      node.innerHTML = content;
      node.classList.toggle("is-hidden", !content);
      syncInsightStackVisibility();
    }

    function hideInsightCards() {
      [homeJourney, homeFocus, homeServiceHub].forEach((node) => {
        if (!node) return;
        node.innerHTML = "";
        node.classList.add("is-hidden");
      });
      syncInsightStackVisibility();
    }

    function setQuickStripLegacy(summary) {
      return;
      if (!homeQuickStrip) return;
      const latest = summary?.latestApplication || {};
      const packageUsage = summary?.packageUsage || {};
      const serviceOverview = summary?.serviceOverview || {};
      const totalServices =
        Number(serviceOverview.funding || 0) +
        Number(serviceOverview.accommodation || 0) +
        Number(serviceOverview.transport || 0) +
        Number(serviceOverview.correction || 0);
      const shortlistCount = Array.isArray(latest.institutions) ? latest.institutions.length : 0;
      const remainingSlots = packageUsage.remainingSlots === "Unlimited"
        ? "Unlimited"
        : `${packageUsage.remainingSlots || 0} left`;

      homeQuickStrip.innerHTML = `
        <a class="quick-link" href="forms.html">
          <div class="quick-label">Application</div>
          <div class="quick-value">${safe(packageUsage.packageName || "Open application")}</div>
          <div class="quick-copy">${safe(packageUsage.packageName ? `Used ${packageUsage.usedSlots || 0} slot(s) · ${remainingSlots}` : "Manage your shortlist, forms, and next Kagie steps in one place.")}</div>
        </a>
        <a class="quick-link" href="cart.html">
          <div class="quick-label">Cart</div>
          <div class="quick-value">${safe(latest.paymentStatus || "Continue checkout")}</div>
          <div class="quick-copy">${safe(latest.paymentStatus ? "Review your package and finish payment when you are ready." : "Review your package and services before you pay.")}</div>
        </a>
        <a class="quick-link" href="more-service/index.html">
          <div class="quick-label">Services</div>
          <div class="quick-value">${safe(totalServices || 0)} active</div>
          <div class="quick-copy">Funding, corrections, accommodation, and transport support.</div>
        </a>
        <a class="quick-link" href="recommendation.html">
          <div class="quick-label">Recommendations</div>
          <div class="quick-value">${safe(shortlistCount || 0)} shortlisted</div>
          <div class="quick-copy">Check suggestions and safer options based on your profile.</div>
        </a>
      `;
    }

    function setQuickStrip(summary) {
      if (!homeQuickStrip) return;
      const latest = summary?.latestApplication || {};
      const packageUsage = summary?.packageUsage || {};
      const serviceOverview = summary?.serviceOverview || {};
      const totalServices =
        Number(serviceOverview.funding || 0) +
        Number(serviceOverview.accommodation || 0) +
        Number(serviceOverview.transport || 0) +
        Number(serviceOverview.correction || 0);
      const shortlistCount = Array.isArray(latest.institutions) ? latest.institutions.length : 0;
      const remainingSlots = packageUsage.remainingSlots === "Unlimited"
        ? "Unlimited"
        : `${packageUsage.remainingSlots || 0} left`;

      homeQuickStrip.innerHTML = `
        <a class="quick-link" href="forms.html">
          <div class="quick-label">Application</div>
          <div class="quick-value">${safe(packageUsage.packageName || "Open application")}</div>
          <div class="quick-copy">${safe(packageUsage.packageName ? `Used ${packageUsage.usedSlots || 0} slot(s) - ${remainingSlots}` : "Manage your shortlist, forms, and next Kagie steps in one place.")}</div>
        </a>
        <a class="quick-link" href="cart.html">
          <div class="quick-label">Cart</div>
          <div class="quick-value">${safe(latest.paymentStatus || "Continue checkout")}</div>
          <div class="quick-copy">${safe(latest.paymentStatus ? "Review your package and finish payment when you are ready." : "Review your package and services before you pay.")}</div>
        </a>
        <a class="quick-link" href="more-service/index.html">
          <div class="quick-label">Services</div>
          <div class="quick-value">${safe(totalServices || 0)} active</div>
          <div class="quick-copy">Funding, corrections, accommodation, and transport support.</div>
        </a>
        <a class="quick-link" href="recommendation.html">
          <div class="quick-label">Recommendations</div>
          <div class="quick-value">${safe(shortlistCount || 0)} shortlisted</div>
          <div class="quick-copy">Check suggestions and safer options based on your profile.</div>
        </a>
      `;
    }

    function animateGreeting(text) {
      if (!heroTitle) return;
      if (experiencePrefs.reducedMotion || experiencePrefs.lowDataMode) {
        heroTitle.textContent = text;
        heroTitle.classList.remove("typing");
        return;
      }
      heroTitle.classList.add("typing");
      heroTitle.textContent = "";
      let index = 0;
      const tick = () => {
        heroTitle.textContent = text.slice(0, index);
        index += 1;
        if (index <= text.length) {
          window.setTimeout(tick, index < 6 ? 80 : 42);
        } else {
          window.setTimeout(() => heroTitle.classList.remove("typing"), 700);
        }
      };
      tick();
    }

    async function hydrateHomeControlCenter() {
      try {
        const summary = api?.getDashboardSummaryAsync
          ? await api.getDashboardSummaryAsync(currentStudent.id)
          : api?.getDashboardSummary?.(currentStudent.id);
        if (!summary) return;

        applyExperienceMode(summary.preferences || experiencePrefs);
        if (heroSubtitle) {
          heroSubtitle.textContent = "One application. Endless opportunities";
        }
        hideInsightCards();
        setQuickStrip(summary);
      } catch (error) {
        console.warn("Could not load the richer home summary:", error);
        setQuickStrip({});
        hideInsightCards();
      }
    }

    function openMenu() {
      if (menuSheet) menuSheet.classList.add("open");
    }

    function shutMenu() {
      if (menuSheet) menuSheet.classList.remove("open");
    }

    function buildCarousel() {
      if (!carousel) return;
      const institutionLogos = [
        { id: "ukzn", name: "UKZN", file: "images/logos/ukzn.png" },
        { id: "uj", name: "UJ", file: "images/logos/uj.png" },
        { id: "unisa", name: "UNISA", file: "images/logos/unisa.png" },
        { id: "dut", name: "DUT", file: "images/logos/dut.png" },
        { id: "wits", name: "Wits", file: "images/logos/wits.png" },
        { id: "uct", name: "UCT", file: "images/logos/uct.png" },
        { id: "ufs", name: "UFS", file: "images/logos/ufs.png" },
        { id: "nwu", name: "NWU", file: "images/logos/nwu.png" },
        { id: "up", name: "UP", file: "images/logos/up.png" },
        { id: "tut", name: "TUT", file: "images/logos/tut.png" }
      ];

      carousel.innerHTML = institutionLogos.map((logo) => `
        <button class="carousel-item" type="button" title="${safe(logo.name)}" data-prospectus="${safe(logo.id)}" aria-label="Open ${safe(logo.name)} guide">
          <img src="${safe(logo.file)}" alt="${safe(logo.name)} logo" loading="lazy" draggable="false" />
        </button>
      `).join("");
      updateCarousel();
    }

    function updateCarousel() {
      if (!carousel) return;
      const items = [...document.querySelectorAll(".carousel-item")];
      const total = items.length;
      const radius = 170;

      items.forEach((item, index) => {
        const itemAngle = (360 / total) * index + angle;
        const rad = itemAngle * (Math.PI / 180);
        const x = Math.sin(rad) * radius;
        const z = Math.cos(rad) * radius;
        const scale = 0.72 + ((z + radius) / (2 * radius)) * 0.42;
        const opacity = 0.30 + ((z + radius) / (2 * radius)) * 0.70;
        item.style.transform = `translate3d(${x}px, -50%, ${z}px) scale(${scale})`;
        item.style.left = "50%";
        item.style.top = "50%";
        item.style.opacity = opacity;
        item.style.zIndex = Math.round(z + radius);
        item.style.boxShadow = z > 0 ? "0 24px 38px rgba(2,6,23,.20)" : "0 10px 18px rgba(2,6,23,.08)";
      });
    }

    function animateCarousel() {
      const shouldAnimate = !document.hidden && (isDragging || carouselAnimationEnabled || Math.abs(velocity) > 0.12);
      if (!shouldAnimate) {
        requestAnimationFrame(animateCarousel);
        return;
      }
      if (carouselAnimationEnabled && !isDragging) {
        angle += velocity;
        velocity *= 0.992;
        if (Math.abs(velocity) < 0.12) velocity = velocity < 0 ? -0.12 : 0.12;
      }
      updateCarousel();
      requestAnimationFrame(animateCarousel);
    }

    function pointerStart(clientX) {
      if (!carousel) return;
      isDragging = true;
      carousel.classList.add("dragging");
      lastX = clientX;
      dragDistance = 0;
    }

    function pointerMove(clientX) {
      if (!isDragging) return;
      const delta = clientX - lastX;
      dragDistance += Math.abs(delta);
      angle += delta * 0.35;
      velocity = delta * 0.08;
      lastX = clientX;
      updateCarousel();
    }

    function pointerEnd() {
      if (!carousel) return;
      isDragging = false;
      carousel.classList.remove("dragging");
    }

    loadSharedProfilePhoto();
    applyExperienceMode(experiencePrefs);
    hideInsightCards();
    if (homeQuickStrip && window.KagieUX?.skeletonQuickLinks) {
      homeQuickStrip.innerHTML = window.KagieUX.skeletonQuickLinks(4);
    }
    if (window.KagieUX) {
      const insightSkeleton = `
        <div class="kagie-skeleton-stack">
          <div class="kagie-skeleton kagie-skeleton-line sm w-36"></div>
          <div class="kagie-skeleton kagie-skeleton-line w-80"></div>
          <div class="kagie-skeleton kagie-skeleton-line sm w-96"></div>
          <div class="kagie-skeleton kagie-skeleton-line sm w-72"></div>
        </div>
      `;
      [homeJourney, homeFocus, homeServiceHub].forEach((node) => {
        if (!node) return;
        node.innerHTML = insightSkeleton;
        node.classList.remove("is-hidden");
      });
      syncInsightStackVisibility();
    }
    const displayName = String(storedName || "User").trim().split(/\s+/)[0] || "User";
    animateGreeting(`Hello ${displayName}`);
    await hydrateHomeControlCenter();
    bootScreen?.hide?.();

    document.querySelectorAll(".tile, .dash-pill, .menu-btn").forEach((el) => {
      el.addEventListener("pointerdown", () => el.classList.add("is-pressed"));
      el.addEventListener("pointerup", () => el.classList.remove("is-pressed"));
      el.addEventListener("pointercancel", () => el.classList.remove("is-pressed"));
      el.addEventListener("pointerleave", () => el.classList.remove("is-pressed"));
    });

      if (menuBtn) menuBtn.addEventListener("click", (e) => { e.preventDefault(); openMenu(); });
      if (closeMenu) closeMenu.addEventListener("click", shutMenu);
      if (menuSheet) menuSheet.addEventListener("click", (e) => { if (e.target === menuSheet) shutMenu(); });
      menuLinks.forEach((link) => link.addEventListener("click", () => shutMenu()));
      document.addEventListener("keydown", (e) => { if (e.key === "Escape") shutMenu(); });

    async function performLogout() {
      shutMenu();
      const startBusy = (button) => {
        if (!button) return;
        if (window.KagieUX?.setButtonLoading) window.KagieUX.setButtonLoading(button, true, { busyText: "Signing out..." });
        else {
          button.disabled = true;
          button.style.opacity = "0.7";
        }
      };
      startBusy(logoutBtn);
      startBusy(headerLogoutBtn);
      try {
        if (api?.setLoginPersistence) api.setLoginPersistence(false);
        if (api?.logoutReal) await api.logoutReal();
        else if (api?.logout) await Promise.resolve(api.logout());
      } catch (err) {
        console.error("Logout error:", err);
      } finally {
        try {
          localStorage.removeItem("kagie_current_user");
          sessionStorage.removeItem("kagie_current_user");
        } catch (storageError) {
          console.warn("Local logout cleanup failed:", storageError);
        }
        window.location.replace("login.html?switch=1");
      }
    }

    function goToApply(event) {
      if (event) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (applyNavigationLocked) return;
      applyNavigationLocked = true;
      window.location.href = "forms.html";
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        await performLogout();
      });
    }

    if (headerLogoutBtn) {
      headerLogoutBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        await performLogout();
      });
    }

    document.querySelectorAll('a[href="forms.html"], a[href="forms.html?step=apply"], a[href="forms.html?step=pack"]').forEach((link) => {
      link.addEventListener("click", goToApply);
    });

    if (carousel) {
      buildCarousel();
      animateCarousel();
      carousel.addEventListener("mousedown", (e) => { e.preventDefault(); pointerStart(e.clientX); });
      window.addEventListener("mousemove", (e) => pointerMove(e.clientX));
      window.addEventListener("mouseup", pointerEnd);
      carousel.addEventListener("touchstart", (e) => pointerStart(e.touches[0].clientX), { passive: true });
      window.addEventListener("touchmove", (e) => { if (isDragging) pointerMove(e.touches[0].clientX); }, { passive: true });
      window.addEventListener("touchend", pointerEnd);
      carousel.addEventListener("click", (event) => {
        const target = event.target.closest("[data-prospectus]");
        if (!target || dragDistance > 8) return;
        const institutionId = String(target.getAttribute("data-prospectus") || "").trim();
        if (!institutionId) return;
        window.location.href = `prospectus.html?institution=${encodeURIComponent(institutionId)}`;
      });
    }

    if (dashboardBar && dashboardPills.length) {
      queueDashboardWheelState();
      dashboardBar.addEventListener("scroll", queueDashboardWheelState, { passive: true });
      dashboardBar.addEventListener("wheel", (event) => {
        const dominantDelta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
        if (!dominantDelta) return;
        event.preventDefault();
        dashboardBar.scrollLeft += dominantDelta;
        queueDashboardWheelState();
      }, { passive: false });
      dashboardBar.addEventListener("mousedown", (event) => {
        if (event.button !== 0) return;
        event.preventDefault();
        startDashboardDrag(event.clientX);
      });
      window.addEventListener("mousemove", (event) => moveDashboardDrag(event.clientX));
      window.addEventListener("mouseup", endDashboardDrag);
      dashboardBar.addEventListener("mouseleave", endDashboardDrag);
      dashboardBar.addEventListener("touchstart", (event) => {
        if (!event.touches || !event.touches.length) return;
        startDashboardDrag(event.touches[0].clientX);
      }, { passive: true });
      window.addEventListener("touchmove", (event) => {
        if (!isDashboardDragging || !event.touches || !event.touches.length) return;
        moveDashboardDrag(event.touches[0].clientX);
      }, { passive: true });
      window.addEventListener("touchend", endDashboardDrag);
      dashboardBar.addEventListener("click", (event) => {
        if (!dashboardDragMoved) return;
        event.preventDefault();
        event.stopPropagation();
      }, true);
      window.addEventListener("resize", queueDashboardWheelState);
      dashboardPills.forEach((pill) => {
        pill.addEventListener("focus", queueDashboardWheelState);
        pill.addEventListener("mouseenter", queueDashboardWheelState);
      });
    }
  }

  const start = () => {
    main().catch((error) => {
      console.error(error);
      window.KagieUX?.showBootScreen && document.getElementById("kagie-dashboard-boot")?.classList.add("is-hidden");
      const api = window.KagieAPI;
      const active = api?.currentUser?.();
      if (!active) {
        window.location.href = "login.html";
        return;
      }
      const heroTitle = $("#heroTitle");
      const heroSubtitle = $(".hero-subtitle");
      if (heroTitle) heroTitle.textContent = `Hello ${String(active.fullName || "User").trim().split(/\s+/)[0] || "User"}`;
      if (heroSubtitle) heroSubtitle.textContent = "Kagie hit a startup delay. Refresh once and continue.";
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
