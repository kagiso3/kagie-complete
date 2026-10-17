(function () {
  window.KagieNotificationsPageLoaded = true;

  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  const normalizeRole = (role) => {
    const value = String(role || "").trim().toLowerCase();
    if (["user", "learner", "student", "authenticated"].includes(value)) return "user";
    if (["assistant_admin", "assistant admin", "assistant-admin", "assistantadmin", "assistant", "admin", "staff"].includes(value)) return "assistant_admin";
    if (["master_admin", "master admin", "master-admin", "masteradmin", "super_admin", "super-admin", "super admin"].includes(value)) return "master_admin";
    return value || "user";
  };
  const dt = (v) => {
    if (!v) return "No date";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "No date" : d.toLocaleString("en-ZA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  async function main() {
    const api = window.KagieAPI;
    const restored = api.resolveSessionUser
      ? await api.resolveSessionUser({ attempts: 2, delayMs: 220 })
      : (api.currentUser?.() || await api.restoreSession().catch(() => null));
    if (!restored || normalizeRole(restored.role) !== "user") {
      window.location.href = "login.html";
      return;
    }

    const user = api.requireRole("user");
    const list = document.getElementById("list");
    const heroTitle = document.getElementById("heroTitle");
    const heroText = document.getElementById("heroText");
    const unreadMeta = document.getElementById("unreadMeta");
    const totalMeta = document.getElementById("totalMeta");
    const filters = [...document.querySelectorAll("[data-filter]")];
    let active = "all";
    let actionInFlight = false;
    let renderVersion = 0;
    let syncDelayed = false;
    let unreadCount = 0;
    const notice = document.createElement("p");
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    notice.hidden = true;
    list.before(notice);
    const markAllButton = document.getElementById("markAllBtn");

    const route = (item) => {
      const s = `${item.title || ""} ${item.message || ""}`.toLowerCase();
      if (s.includes("document")) return "upload.html";
      if (s.includes("payment")) return "Dashboard.html";
      if (s.includes("cart")) return "cart.html";
      if (s.includes("assistant") || s.includes("support")) return "personal-assistance.html";
      if (s.includes("welcome")) return "home.html";
      return "Dashboard.html";
    };
    const cls = (t) => {
      const v = String(t || "").toLowerCase();
      if (v.includes("success")) return "success";
      if (v.includes("warning")) return "pending";
      if (v.includes("error")) return "danger";
      if (v.includes("info")) return "review";
      return "default";
    };
    const normalizeItems = (items) => (Array.isArray(items) ? items : [])
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: String(item.id || "").trim(),
        title: String(item.title || "Notification").trim(),
        message: String(item.message || "").trim(),
        type: String(item.type || "info").trim().toLowerCase(),
        read: Boolean(item.read),
        createdAt: item.createdAt || ""
      }));

    async function loadItems() {
      try {
        const items = api.getNotificationsAsync ? await api.getNotificationsAsync(user.id) : api.getNotifications(user.id);
        syncDelayed = false;
        return normalizeItems(items);
      } catch (error) {
        console.warn("Notification sync fallback used:", error);
        syncDelayed = true;
        return normalizeItems(api.getNotifications?.(user.id) || []);
      }
    }

    async function render() {
      const version = ++renderVersion;
      const items = await loadItems();
      if (version !== renderVersion) return;
      const unread = items.filter((i) => !i.read).length;
      unreadCount = unread;
      heroTitle.textContent = `Hello, ${user.fullName || "Student"}`;
      heroText.textContent = syncDelayed ? "Showing saved notifications. Check your connection to load the latest updates." : unread ? `You have ${unread} unread Kagie notification${unread === 1 ? "" : "s"}.` : "You are fully caught up on Kagie updates.";
      unreadMeta.textContent = `${unread} unread`;
      totalMeta.textContent = `${items.length} total notifications`;
      const visible = items.filter((i) => active === "all" || active === "unread" && !i.read || active === "read" && i.read);
      list.innerHTML = visible.length ? visible.map((i) => `<div class="item ${i.read ? "" : "unread"}"><div class="row"><div><span class="chip ${cls(i.type)}">${esc(i.type || "update")}</span></div><div style="color:#64748b;font-size:12px;font-weight:700">${esc(dt(i.createdAt))}</div></div><div style="margin-top:10px"><strong>${esc(i.title || "Notification")}</strong><p>${esc(i.message || "")}</p></div><div class="item-actions">${i.read ? `<span class="mini" style="cursor:default">Read</span>` : `<button class="mini" data-read="${esc(i.id)}" type="button">Mark read</button>`}<a class="mini" href="${esc(route(i))}">Open</a></div></div>`).join("") : `<div class="empty">No notifications in this filter.</div>`;
      list.querySelectorAll("[data-read]").forEach((button) => { button.disabled = actionInFlight; });
      markAllButton.disabled = actionInFlight || !unread;
    }

    async function markRead(action) {
      if (actionInFlight) return;
      actionInFlight = true;
      notice.hidden = true;
      markAllButton.disabled = true;
      list.querySelectorAll("[data-read]").forEach((button) => { button.disabled = true; });
      list.setAttribute("aria-busy", "true");
      try {
        await action();
        await render();
      } catch (error) {
        console.warn("Could not mark notifications read:", error);
        notice.textContent = "Could not update your notifications. Check your connection and try again.";
        notice.hidden = false;
      } finally {
        actionInFlight = false;
        list.removeAttribute("aria-busy");
        list.querySelectorAll("[data-read]").forEach((button) => { button.disabled = false; });
        markAllButton.disabled = !unreadCount;
      }
    }

    filters.forEach((btn) => btn.addEventListener("click", async () => {
      filters.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filters.forEach((button) => button.setAttribute("aria-pressed", String(button === btn)));
      active = btn.dataset.filter;
      await render();
    }));

    markAllButton.addEventListener("click", () => {
      markRead(() => api.markAllNotificationsReadAsync ? api.markAllNotificationsReadAsync(user.id) : api.markAllNotificationsRead(user.id));
    });

    list.addEventListener("click", (e) => {
      const id = e.target.closest("[data-read]")?.getAttribute("data-read");
      if (!id) return;
      markRead(() => api.markNotificationReadAsync ? api.markNotificationReadAsync(id) : api.markNotificationRead(id));
    });

    await render();
  }

  const start = () => {
    main().catch((error) => {
      console.error(error);
      const active = window.KagieAPI?.currentUser?.();
      const heroTitle = document.getElementById("heroTitle");
      const heroText = document.getElementById("heroText");
      const list = document.getElementById("list");
      if (!active || normalizeRole(active.role) !== "user") {
        window.location.href = "login.html";
        return;
      }
      if (heroTitle) heroTitle.textContent = `Hello, ${active.fullName || "Student"}`;
      if (heroText) heroText.textContent = "Kagie hit a notification sync delay. Your account is still signed in.";
      if (list) list.innerHTML = `<div class="empty">Notifications could not fully load right now. Refresh again and Kagie will continue from your current session.</div>`;
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
