(function () {
  "use strict";

  const STATUS_LABELS = {
    open: "Open",
    in_progress: "In progress",
    awaiting_user: "Awaiting learner",
    resolved: "Resolved",
    closed: "Closed"
  };

  const STATUS_OPTIONS = Object.keys(STATUS_LABELS);

  function asArray(value) {
    return Array.isArray(value) ? value : [];
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#2d9df9;");
  }

  function normalizeStatus(value) {
    const normalized = String(value || "open").trim().toLowerCase().replace(/[\s-]+/g, "_");
    return STATUS_OPTIONS.includes(normalized) ? normalized : "open";
  }

  function statusLabel(value) {
    return STATUS_LABELS[normalizeStatus(value)] || STATUS_LABELS.open;
  }

  function formatDate(value) {
    const date = new Date(value || 0);
    if (Number.isNaN(date.getTime())) return "Recently";
    return new Intl.DateTimeFormat("en-ZA", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function initials(value) {
    const parts = String(value || "Learner").trim().split(/\s+/).filter(Boolean);
    return (parts.slice(0, 2).map((part) => part[0]).join("") || "L").toUpperCase();
  }

  async function init() {
    const root = document.querySelector("[data-staff-support-inbox]");
    const api = window.KagieAPI;
    if (!root || !api) return;

    let actor = api.getCurrentUser?.() || api.currentUser?.();
    if (!actor && api.resolveSessionUser) {
      actor = await api.resolveSessionUser({ attempts: 2, delayMs: 220 }).catch(() => null);
    }
    if (!actor || !["assistant_admin", "master_admin"].includes(String(actor.role || "").toLowerCase())) return;

    const elements = {
      search: root.querySelector("[data-support-search]"),
      filter: root.querySelector("[data-support-filter]"),
      refresh: root.querySelector("[data-support-refresh]"),
      summary: root.querySelector("[data-support-summary]"),
      list: root.querySelector("[data-support-list]"),
      detail: root.querySelector("[data-support-detail]"),
      feedback: root.querySelector("[data-support-feedback]"),
      countBadges: Array.from(document.querySelectorAll("[data-support-count]"))
    };

    const state = {
      tickets: [],
      users: [],
      messages: [],
      selectedTicketId: "",
      search: "",
      status: "all",
      loading: false,
      requestId: 0
    };

    function identityKeys(user) {
      return [user?.id, user?.supabaseUserId, user?.userId, user?.email]
        .map((value) => String(value || "").trim().toLowerCase())
        .filter(Boolean);
    }

    function findUser(reference) {
      const key = String(reference || "").trim().toLowerCase();
      if (!key) return null;
      return state.users.find((user) => identityKeys(user).includes(key)) || null;
    }

    function learnerFor(ticket) {
      return findUser(ticket?.userId) || {
        id: ticket?.userId || "",
        fullName: "Learner",
        email: "Learner account"
      };
    }

    function selectedTicket() {
      return state.tickets.find((ticket) => ticket.id === state.selectedTicketId) || null;
    }

    function visibleTickets() {
      const query = state.search.trim().toLowerCase();
      return state.tickets.filter((ticket) => {
        const statusMatch = state.status === "all" || normalizeStatus(ticket.status) === state.status;
        if (!statusMatch) return false;
        if (!query) return true;
        const learner = learnerFor(ticket);
        return [ticket.subject, ticket.category, learner.fullName, learner.email, ticket.id]
          .some((value) => String(value || "").toLowerCase().includes(query));
      });
    }

    function setFeedback(message, tone = "") {
      if (!elements.feedback) return;
      elements.feedback.textContent = message || "";
      elements.feedback.dataset.tone = tone;
    }

    function setLoading(loading) {
      state.loading = loading;
      root.classList.toggle("is-loading", loading);
      if (elements.refresh) {
        elements.refresh.disabled = loading;
        elements.refresh.textContent = loading ? "Refreshing..." : "Refresh";
      }
    }

    function renderSummary() {
      const counts = state.tickets.reduce((result, ticket) => {
        const status = normalizeStatus(ticket.status);
        result[status] = (result[status] || 0) + 1;
        return result;
      }, {});
      const activeCount = (counts.open || 0) + (counts.in_progress || 0) + (counts.awaiting_user || 0);
      elements.countBadges.forEach((badge) => {
        badge.textContent = String(activeCount);
        badge.hidden = activeCount === 0;
      });
      if (!elements.summary) return;
      const summaryItems = [
        ["All", state.tickets.length, "all"],
        ["Open", counts.open || 0, "open"],
        ["In progress", counts.in_progress || 0, "in_progress"],
        ["Awaiting learner", counts.awaiting_user || 0, "awaiting_user"],
        ["Resolved", counts.resolved || 0, "resolved"]
      ];
      elements.summary.innerHTML = summaryItems.map(([label, count, status]) => `
        <button class="staff-support-metric${state.status === status ? " is-active" : ""}" type="button" data-support-summary-filter="${escapeHtml(status)}">
          <strong>${escapeHtml(count)}</strong>
          <span>${escapeHtml(label)}</span>
        </button>
      `).join("");
    }

    function renderList() {
      if (!elements.list) return;
      const tickets = visibleTickets();
      if (state.loading && !state.tickets.length) {
        elements.list.innerHTML = '<div class="staff-support-empty"><strong>Loading support tickets...</strong><span>Connecting to the Kagie support queue.</span></div>';
        return;
      }
      if (!tickets.length) {
        elements.list.innerHTML = '<div class="staff-support-empty"><strong>No matching tickets</strong><span>Try a different search or status filter.</span></div>';
        return;
      }
      elements.list.innerHTML = tickets.map((ticket) => {
        const learner = learnerFor(ticket);
        const status = normalizeStatus(ticket.status);
        return `
          <button class="staff-support-ticket${ticket.id === state.selectedTicketId ? " is-active" : ""}" type="button" data-support-ticket-id="${escapeHtml(ticket.id)}">
            <span class="staff-support-avatar">${escapeHtml(initials(learner.fullName))}</span>
            <span class="staff-support-ticket-copy">
              <span class="staff-support-ticket-line">
                <strong>${escapeHtml(ticket.subject || "Support request")}</strong>
                <span class="staff-support-status is-${escapeHtml(status)}">${escapeHtml(statusLabel(status))}</span>
              </span>
              <span class="staff-support-ticket-meta">${escapeHtml(learner.fullName || "Learner")} · ${escapeHtml(ticket.category || "General")}</span>
              <span class="staff-support-ticket-time">Updated ${escapeHtml(formatDate(ticket.lastMessageAt || ticket.updatedAt || ticket.createdAt))}</span>
            </span>
          </button>
        `;
      }).join("");
    }

    function messageIsStaff(message) {
      return String(message?.senderRole || "").toLowerCase() !== "user";
    }

    function renderDetail() {
      if (!elements.detail) return;
      const ticket = selectedTicket();
      if (!ticket) {
        elements.detail.innerHTML = `
          <div class="staff-support-empty is-detail">
            <strong>Select a support ticket</strong>
            <span>The full learner conversation will appear here.</span>
          </div>
        `;
        return;
      }
      const learner = learnerFor(ticket);
      const status = normalizeStatus(ticket.status);
      const messages = state.messages.filter((message) => message.threadId === ticket.id);
      elements.detail.innerHTML = `
        <div class="staff-support-detail-head">
          <div>
            <span class="staff-support-kicker">${escapeHtml(ticket.category || "General support")}</span>
            <h3>${escapeHtml(ticket.subject || "Support request")}</h3>
            <p>${escapeHtml(learner.fullName || "Learner")} · ${escapeHtml(learner.email || "Learner account")}</p>
          </div>
          <label class="staff-support-status-control">
            <span>Ticket status</span>
            <select class="field-control" data-support-status-select>
              ${STATUS_OPTIONS.map((value) => `<option value="${value}"${value === status ? " selected" : ""}>${escapeHtml(statusLabel(value))}</option>`).join("")}
            </select>
          </label>
        </div>
        <div class="staff-support-messages" data-support-messages>
          ${messages.length ? messages.map((message) => `
            <article class="staff-support-message${messageIsStaff(message) ? " is-staff" : " is-learner"}">
              <div class="staff-support-message-meta">
                <strong>${escapeHtml(message.senderName || (messageIsStaff(message) ? "Kagie Support" : learner.fullName))}</strong>
                <span>${escapeHtml(formatDate(message.createdAt))}</span>
              </div>
              <p>${escapeHtml(message.text || message.message || "")}</p>
            </article>
          `).join("") : '<div class="staff-support-empty"><strong>No messages yet</strong><span>Reply below to start the conversation.</span></div>'}
        </div>
        <form class="staff-support-reply" data-support-reply-form>
          <label for="staffSupportReply">Reply to ${escapeHtml(learner.fullName || "learner")}</label>
          <textarea id="staffSupportReply" rows="3" maxlength="2000" placeholder="Write a clear support response..." required data-support-reply></textarea>
          <div class="staff-support-reply-actions">
            <span>Replies are visible to the learner immediately.</span>
            <button class="action-button primary" type="submit" data-support-send>Send reply</button>
          </div>
        </form>
      `;
      const messagePanel = elements.detail.querySelector("[data-support-messages]");
      if (messagePanel) messagePanel.scrollTop = messagePanel.scrollHeight;
    }

    function render() {
      renderSummary();
      renderList();
      renderDetail();
    }

    async function loadMessages(ticketId) {
      if (!ticketId) {
        state.messages = [];
        return;
      }
      const rows = api.getSupportTicketMessagesAsync
        ? await api.getSupportTicketMessagesAsync(ticketId)
        : api.getSupportTicketMessages(ticketId);
      state.messages = asArray(rows);
    }

    async function loadUsers() {
      try {
        const rows = api.getAllUsersAsync ? await api.getAllUsersAsync() : api.getAllUsers?.();
        state.users = asArray(rows);
      } catch (error) {
        console.warn("Support inbox could not load the full learner directory:", error?.message || error);
        state.users = asArray(api.getAllUsers?.());
      }
    }

    async function loadTickets() {
      const rows = api.getSupportTicketsAsync
        ? await api.getSupportTicketsAsync({})
        : api.getSupportTickets({});
      state.tickets = asArray(rows).sort((left, right) => (
        new Date(right.lastMessageAt || right.updatedAt || 0) - new Date(left.lastMessageAt || left.updatedAt || 0)
      ));
      if (!state.tickets.some((ticket) => ticket.id === state.selectedTicketId)) {
        state.selectedTicketId = state.tickets[0]?.id || "";
      }
    }

    async function refresh({ preserveFeedback = false } = {}) {
      const requestId = ++state.requestId;
      setLoading(true);
      if (!preserveFeedback) setFeedback("");
      renderList();
      try {
        await Promise.all([loadUsers(), loadTickets()]);
        if (requestId !== state.requestId) return;
        await loadMessages(state.selectedTicketId);
        if (requestId !== state.requestId) return;
        render();
      } catch (error) {
        console.error("Could not load staff support inbox:", error);
        setFeedback(error?.message || "Could not load the support inbox.", "error");
        render();
      } finally {
        if (requestId === state.requestId) setLoading(false);
      }
    }

    async function selectTicket(ticketId) {
      if (!ticketId || ticketId === state.selectedTicketId) return;
      state.selectedTicketId = ticketId;
      state.messages = [];
      setFeedback("");
      render();
      try {
        await loadMessages(ticketId);
        renderDetail();
      } catch (error) {
        setFeedback(error?.message || "Could not load this conversation.", "error");
      }
    }

    async function updateStatus(value) {
      const ticket = selectedTicket();
      if (!ticket || state.loading) return;
      const status = normalizeStatus(value);
      setFeedback("Updating ticket status...", "info");
      try {
        const updated = api.updateSupportTicketStatusAsync
          ? await api.updateSupportTicketStatusAsync(ticket.id, status)
          : api.updateSupportTicketStatus(ticket.id, status);
        Object.assign(ticket, updated || {}, { status });
        setFeedback(`Ticket marked ${statusLabel(status).toLowerCase()}.`, "success");
        render();
      } catch (error) {
        setFeedback(error?.message || "Could not update the ticket status.", "error");
        renderDetail();
      }
    }

    async function sendReply(form) {
      const ticket = selectedTicket();
      const input = form.querySelector("[data-support-reply]");
      const button = form.querySelector("[data-support-send]");
      const message = String(input?.value || "").trim();
      if (!ticket || !message || button?.disabled) return;
      if (button) {
        button.disabled = true;
        button.textContent = "Sending...";
      }
      setFeedback("Sending reply...", "info");
      try {
        if (api.replySupportTicketAsync) await api.replySupportTicketAsync(ticket.id, message);
        else api.replySupportTicket(ticket.id, message);
        await Promise.all([loadTickets(), loadMessages(ticket.id)]);
        state.selectedTicketId = ticket.id;
        setFeedback("Reply sent to the learner.", "success");
        render();
      } catch (error) {
        setFeedback(error?.message || "Could not send the support reply.", "error");
        if (button) {
          button.disabled = false;
          button.textContent = "Send reply";
        }
      }
    }

    elements.search?.addEventListener("input", (event) => {
      state.search = event.target.value || "";
      renderList();
    });

    elements.filter?.addEventListener("change", (event) => {
      state.status = event.target.value || "all";
      renderSummary();
      renderList();
    });

    elements.refresh?.addEventListener("click", () => refresh());

    root.addEventListener("click", (event) => {
      const ticketButton = event.target.closest("[data-support-ticket-id]");
      if (ticketButton) {
        selectTicket(ticketButton.dataset.supportTicketId);
        return;
      }
      const summaryButton = event.target.closest("[data-support-summary-filter]");
      if (summaryButton) {
        state.status = summaryButton.dataset.supportSummaryFilter || "all";
        if (elements.filter) elements.filter.value = state.status;
        renderSummary();
        renderList();
      }
    });

    root.addEventListener("change", (event) => {
      if (event.target.matches("[data-support-status-select]")) updateStatus(event.target.value);
    });

    root.addEventListener("submit", (event) => {
      const form = event.target.closest("[data-support-reply-form]");
      if (!form) return;
      event.preventDefault();
      sendReply(form);
    });

    render();
    refresh();
  }

  function start() {
    init().catch((error) => console.error("Staff support inbox failed to start:", error));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
