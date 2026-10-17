(function () {
  window.KagiePersonalAssistancePageLoaded = true;

  const $ = (id) => document.getElementById(id);
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
  const isRecoverable = (error) => {
    const message = String(error?.message || error || "").toLowerCase();
    return message.includes("stack depth limit exceeded")
      || message.includes("infinite recursion")
      || message.includes("policy")
      || message.includes("row-level security")
      || message.includes("failed to fetch")
      || message.includes("networkerror")
      || message.includes("load failed")
      || message.includes("network request failed");
  };

  function showSoftSupportStatus(message) {
    const heroText = $("heroText");
    if (!heroText) return;
    heroText.textContent = message || "Support is still available. Kagie will keep your latest local activity visible while live sync reconnects.";
  }

  let pollTimer = 0;

  function stopPolling() {
    if (!pollTimer) return;
    window.clearInterval(pollTimer);
    pollTimer = 0;
  }

  function startPolling(task) {
    stopPolling();
    pollTimer = window.setInterval(() => {
      if (document.hidden) return;
      task().catch(console.warn);
    }, 15000);
  }

  function setButtonBusy(button, busyText, busy) {
    if (!button) return "";
    if (window.KagieUX?.setButtonLoading) {
      window.KagieUX.setButtonLoading(button, Boolean(busy), { busyText: busyText || "Working..." });
      return button.dataset.originalText || button.textContent || "";
    }
    const originalText = button.dataset.originalText || button.textContent || "";
    if (!button.dataset.originalText) button.dataset.originalText = originalText;
    button.disabled = Boolean(busy);
    button.setAttribute("aria-busy", busy ? "true" : "false");
    button.textContent = busy ? busyText : originalText;
    return originalText;
  }

  async function main() {
    const api = window.KagieAPI;
    const restored = api.resolveSessionUser
      ? await api.resolveSessionUser({ attempts: 2, delayMs: 220 })
      : (api.currentUser() || await api.restoreSession());
    if (!restored || normalizeRole(restored.role) !== "user") {
      window.location.href = "login.html";
      return;
    }

    const user = api.requireRole("user");
    const cls = (s) => {
      const v = String(s || "").toLowerCase();
      if (v.includes("resolve") || v.includes("closed")) return "success";
      if (v.includes("progress") || v.includes("await") || v.includes("contact")) return "review";
      return "pending";
    };
    const ticketStatusLabel = (status) => {
      const value = String(status || "open").trim().toLowerCase().replace(/[_-]+/g, " ");
      return value ? value.replace(/\b\w/g, (char) => char.toUpperCase()) : "Open";
    };
    let activeTicketId = "";
    let composingNewTicket = false;
    let supportTickets = [];
    let ticketsRenderVersion = 0;
    let messagesRenderVersion = 0;

    async function renderTickets() {
      const renderVersion = ++ticketsRenderVersion;
      const ticketAtStart = activeTicketId;
      const composingAtStart = composingNewTicket;
      const stillCurrent = () => renderVersion === ticketsRenderVersion && ticketAtStart === activeTicketId && composingAtStart === composingNewTicket;
      const list = $("tickets");
      const meta = $("ticketMeta");
      if (!list) return;
      try {
        const rows = api.getSupportTicketsAsync
          ? await api.getSupportTicketsAsync({ userId: user.id })
          : (api.getSupportTickets?.({ userId: user.id }) || []);
        if (!stillCurrent()) return;
        supportTickets = Array.isArray(rows) ? rows : [];
        if (!activeTicketId && supportTickets.length && !composingNewTicket) {
          activeTicketId = supportTickets[0].id;
        }
        if (activeTicketId && !supportTickets.some((ticket) => ticket.id === activeTicketId)) {
          activeTicketId = supportTickets[0]?.id || "";
        }
        if (meta) meta.textContent = `${supportTickets.length} support ticket${supportTickets.length === 1 ? "" : "s"}`;
        list.innerHTML = supportTickets.length
          ? supportTickets.map((ticket) => `
            <button class="item ticket-card ${ticket.id === activeTicketId ? "active" : ""}" type="button" data-ticket-id="${esc(ticket.id)}">
              <div class="row"><strong>${esc(ticket.subject || "Support request")}</strong><span class="status ${cls(ticket.status)}">${esc(ticketStatusLabel(ticket.status))}</span></div>
              <p>Category: ${esc(ticket.category || "General")}<br>Updated: ${esc(dt(ticket.lastMessageAt || ticket.updatedAt || ticket.createdAt))}</p>
            </button>
          `).join("")
          : `<div class="empty">No support tickets yet. Add a subject, choose a category, and send your first message.</div>`;
        const active = supportTickets.find((ticket) => ticket.id === activeTicketId);
        if (active && !composingNewTicket) {
          if ($("ticketSubject")) $("ticketSubject").value = active.subject || "";
          if ($("ticketCategory")) $("ticketCategory").value = active.category || "General";
        }
      } catch (error) {
        if (!stillCurrent()) return;
        console.warn("Personal assistance ticket sync fell back to local mode:", error);
        const rows = api.getSupportTickets ? (api.getSupportTickets({ userId: user.id }) || []) : [];
        supportTickets = Array.isArray(rows) ? rows : [];
        if (!activeTicketId && supportTickets.length && !composingNewTicket) activeTicketId = supportTickets[0].id;
        if (meta) meta.textContent = `${supportTickets.length} support ticket${supportTickets.length === 1 ? "" : "s"}`;
        list.innerHTML = supportTickets.length
          ? supportTickets.map((ticket) => `<button class="item ticket-card ${ticket.id === activeTicketId ? "active" : ""}" type="button" data-ticket-id="${esc(ticket.id)}"><div class="row"><strong>${esc(ticket.subject || "Support request")}</strong><span class="status ${cls(ticket.status)}">${esc(ticketStatusLabel(ticket.status))}</span></div><p>Category: ${esc(ticket.category || "General")}<br>Updated: ${esc(dt(ticket.lastMessageAt || ticket.updatedAt || ticket.createdAt))}</p></button>`).join("")
          : `<div class="empty">Support tickets are reconnecting. You can still send a message and Kagie will keep a safe local copy.</div>`;
        showSoftSupportStatus();
      }
    }

    async function renderMessages() {
      const renderVersion = ++messagesRenderVersion;
      const ticketAtStart = activeTicketId;
      const composingAtStart = composingNewTicket;
      const stillCurrent = () => renderVersion === messagesRenderVersion && ticketAtStart === activeTicketId && composingAtStart === composingNewTicket;
      try {
        if (composingNewTicket && !activeTicketId) {
          $("messageMeta").textContent = "New support ticket";
          $("messages").innerHTML = `<div class="empty">Add a subject and describe the issue. Kagie will create a new support ticket when you send.</div>`;
          return;
        }
        const items = activeTicketId && (api.getSupportTicketMessagesAsync || api.getSupportTicketMessages)
          ? (api.getSupportTicketMessagesAsync ? await api.getSupportTicketMessagesAsync(activeTicketId) : api.getSupportTicketMessages(activeTicketId))
          : (api.getSupportMessagesAsync ? await api.getSupportMessagesAsync(`support_${user.id}`) : (api.getSupportMessages(`support_${user.id}`) || []));
        if (!stillCurrent()) return;
        $("messageMeta").textContent = `${items.length} chat message${items.length === 1 ? "" : "s"}`;
        $("messages").innerHTML = items.length ? items.map((i) => `<div class="msg ${i.senderRole === "user" ? "user" : "agent"}"><small>${esc(i.senderName || i.senderRole || "Kagie")}</small>${esc(i.text || "")}<br><small>${esc(dt(i.createdAt))}</small></div>`).join("") : `<div class="empty">No chat messages yet. Send the first one and your thread will be visible to assistant admins.</div>`;
        $("messages").scrollTop = $("messages").scrollHeight;
      } catch (error) {
        if (!stillCurrent()) return;
        console.warn("Personal assistance message sync fell back to local mode:", error);
        const items = api.getSupportMessages ? (api.getSupportMessages(`support_${user.id}`) || []) : [];
        $("messageMeta").textContent = `${items.length} chat message${items.length === 1 ? "" : "s"}`;
        $("messages").innerHTML = items.length ? items.map((i) => `<div class="msg ${i.senderRole === "user" ? "user" : "agent"}"><small>${esc(i.senderName || i.senderRole || "Kagie")}</small>${esc(i.text || "")}<br><small>${esc(dt(i.createdAt))}</small></div>`).join("") : `<div class="empty">Support is reconnecting. Your local chat history is still available and you can keep using this page.</div>`;
        showSoftSupportStatus();
      }
    }

    async function renderCallbacks() {
      try {
        const calls = api.getMyCallRequestsAsync ? await api.getMyCallRequestsAsync(user.id) : (api.getMyCallRequests(user.id) || []);
        $("callbackMeta").textContent = `${calls.length} callback request${calls.length === 1 ? "" : "s"}`;
        $("callbacks").innerHTML = calls.length ? calls.map((c) => `<div class="item"><div class="row"><strong>${esc(c.phone || user.phone || "No phone")}</strong><span class="status ${cls(c.status)}">${esc(c.status || "Pending")}</span></div><p>Preferred time: ${esc(c.preferredTime || "-")}<br>Reason: ${esc(c.reason || "-")}<br>Requested: ${esc(dt(c.createdAt))}</p></div>`).join("") : `<div class="empty">No callback requests yet.</div>`;
      } catch (error) {
        console.warn("Personal assistance callback sync fell back to local mode:", error);
        const calls = api.getMyCallRequests ? (api.getMyCallRequests(user.id) || []) : [];
        $("callbackMeta").textContent = `${calls.length} callback request${calls.length === 1 ? "" : "s"}`;
        $("callbacks").innerHTML = calls.length ? calls.map((c) => `<div class="item"><div class="row"><strong>${esc(c.phone || user.phone || "No phone")}</strong><span class="status ${cls(c.status)}">${esc(c.status || "Pending")}</span></div><p>Preferred time: ${esc(c.preferredTime || "-")}<br>Reason: ${esc(c.reason || "-")}<br>Requested: ${esc(dt(c.createdAt))}</p></div>`).join("") : `<div class="empty">No callback requests yet. Kagie will keep your local requests visible while live sync reconnects.</div>`;
        showSoftSupportStatus();
      }
    }

    let sendingMessage = false;
    $("sendBtn").addEventListener("click", async () => {
      if (sendingMessage) return;
      const text = $("messageInput").value.trim();
      const subject = $("ticketSubject")?.value.trim() || "";
      const category = $("ticketCategory")?.value || "General";
      if (!text) {
        $("messageInput").focus();
        return;
      }
      if (!activeTicketId && !subject) {
        showSoftSupportStatus("Add a support subject before sending so Kagie can create the right ticket.");
        $("ticketSubject")?.focus();
        return;
      }
      let slowTimer = 0;
      try {
        sendingMessage = true;
        setButtonBusy($("sendBtn"), "Sending...", true);
        $("messageInput").disabled = true;
        slowTimer = window.setTimeout(() => {
          showSoftSupportStatus("Still processing, please wait...");
        }, 3200);
        if (activeTicketId) {
          const reply = api.replySupportTicketAsync
            ? await api.replySupportTicketAsync(activeTicketId, text)
            : api.replySupportTicket
              ? api.replySupportTicket(activeTicketId, text)
              : api.sendSupportMessageAsync
                ? await api.sendSupportMessageAsync(`support_${user.id}`, text)
                : api.sendSupportMessage(`support_${user.id}`, text);
          if (reply?.source !== "supabase") {
            showSoftSupportStatus("Your message was saved on this device only and has not reached Kagie support. Your text is still here so you can retry when connected.");
            return;
          }
        } else {
          const ticket = api.createSupportTicketAsync
            ? await api.createSupportTicketAsync({ subject, category, message: text })
            : (api.createSupportTicket ? api.createSupportTicket({ subject, category, message: text }) : null);
          if (ticket?.source !== "supabase") {
            composingNewTicket = true;
            showSoftSupportStatus("Your message was saved on this device only and has not reached Kagie support. Your text is still here so you can retry when connected.");
            return;
          }
          activeTicketId = ticket.id;
          composingNewTicket = false;
        }
      } catch (error) {
        if (error?.supportTicket?.id) {
          activeTicketId = error.supportTicket.id;
          composingNewTicket = false;
          showSoftSupportStatus("Your ticket was created, but its message has not been sent. Your text is still here. Retry to send it on the same ticket.");
          await renderTickets();
          await renderMessages();
          return;
        }
        if (!isRecoverable(error)) {
          console.warn("Could not send support message:", error);
          showSoftSupportStatus("Could not send your message. Your text is still here. Please try again shortly.");
          return;
        }
        console.warn("Support send fell back to local mode:", error);
        if (!activeTicketId && api.createSupportTicket) {
          api.createSupportTicket({ subject, category, message: text });
          composingNewTicket = true;
        } else if (activeTicketId && api.replySupportTicket) {
          api.replySupportTicket(activeTicketId, text);
        } else {
          api.sendSupportMessage(`support_${user.id}`, text);
        }
        showSoftSupportStatus("Your message was saved on this device only and has not reached Kagie support. Your text is still here so you can retry when connected.");
        return;
      } finally {
        if (slowTimer) window.clearTimeout(slowTimer);
        sendingMessage = false;
        $("messageInput").disabled = false;
        setButtonBusy($("sendBtn"), "", false);
      }
      $("messageInput").value = "";
      await renderTickets();
      await renderMessages();
    });

    $("messageInput").addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") $("sendBtn").click();
    });

    let requestingCallback = false;
    $("callbackBtn").addEventListener("click", async () => {
      if (requestingCallback) return;
      const phone = $("callbackPhone").value.trim() || user.phone || "";
      const preferredTime = $("callbackTime").value.trim();
      const reason = $("callbackReason").value.trim();
      if (!phone || !reason) {
        showSoftSupportStatus("Enter your phone number and callback reason so Kagie can save the callback request.");
        $("callbackReason")?.focus();
        return;
      }
      let slowTimer = 0;
      try {
        requestingCallback = true;
        setButtonBusy($("callbackBtn"), "Submitting...", true);
        $("callbackPhone").disabled = true;
        $("callbackTime").disabled = true;
        $("callbackReason").disabled = true;
        slowTimer = window.setTimeout(() => {
          showSoftSupportStatus("Still processing, please wait...");
        }, 3200);
        const callback = api.requestCallbackAsync
          ? await api.requestCallbackAsync({ phone, preferredTime, reason })
          : api.requestCallback({ phone, preferredTime, reason });
        if (callback?.source !== "supabase") {
          showSoftSupportStatus("Your callback request was saved on this device only and has not reached Kagie support. Your details are still here so you can retry when connected.");
          return;
        }
      } catch (error) {
        if (!isRecoverable(error)) {
          console.warn("Could not request support callback:", error);
          showSoftSupportStatus("Could not request a callback. Your details are still here. Please try again shortly.");
          return;
        }
        console.warn("Callback request fell back to local mode:", error);
        api.requestCallback({ phone, preferredTime, reason });
        showSoftSupportStatus("Your callback request was saved on this device only and has not reached Kagie support. Your details are still here so you can retry when connected.");
        return;
      } finally {
        if (slowTimer) window.clearTimeout(slowTimer);
        requestingCallback = false;
        $("callbackPhone").disabled = false;
        $("callbackTime").disabled = false;
        $("callbackReason").disabled = false;
        setButtonBusy($("callbackBtn"), "", false);
      }
      $("callbackTime").value = "";
      $("callbackReason").value = "";
      await renderCallbacks();
    });

    $("tickets")?.addEventListener("click", async (event) => {
      const ticketButton = event.target.closest("[data-ticket-id]");
      if (!ticketButton) return;
      activeTicketId = ticketButton.getAttribute("data-ticket-id") || "";
      composingNewTicket = false;
      await renderTickets();
      await renderMessages();
    });

    $("newTicketBtn")?.addEventListener("click", async () => {
      activeTicketId = "";
      composingNewTicket = true;
      if ($("ticketSubject")) $("ticketSubject").value = "";
      if ($("ticketCategory")) $("ticketCategory").value = "Applications";
      if ($("messageInput")) $("messageInput").value = "";
      await renderTickets();
      await renderMessages();
      $("ticketSubject")?.focus();
    });

    $("refreshBtn").addEventListener("click", async (event) => {
      event.preventDefault();
      const button = event.currentTarget;
      if (window.KagieUX?.withButtonLock) {
        try {
          await window.KagieUX.withButtonLock(button, "support-refresh", "Refreshing...", async () => {
            await renderTickets();
            await renderMessages();
          });
        } catch (error) {
          console.warn("Could not refresh support:", error);
          showSoftSupportStatus("Could not refresh your conversation. Please try again shortly.");
        }
        return;
      }
      if (button.disabled) return;
      try {
        setButtonBusy(button, "Refreshing...", true);
        await renderTickets();
        await renderMessages();
      } catch (error) {
        console.warn("Could not refresh support:", error);
        showSoftSupportStatus("Could not refresh your conversation. Please try again shortly.");
      } finally {
        setButtonBusy(button, "", false);
      }
    });
    $("heroTitle").textContent = `Hello, ${user.fullName || "Student"}`;
    $("heroText").textContent = "Support conversations are stored in Kagie so your assigned assistant and admins can follow your case.";
    await renderTickets();
    await renderMessages();
    await renderCallbacks();
    startPolling(async () => {
      await renderTickets();
      await renderMessages();
    });
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopPolling();
        return;
      }
      renderTickets().catch(console.warn);
      renderMessages().catch(console.warn);
      startPolling(async () => {
        await renderTickets();
        await renderMessages();
      });
    });
  }

  const start = () => {
    const loadingControls = [...document.querySelectorAll("#ticketSubject,#ticketCategory,#messageInput,#sendBtn,#newTicketBtn,#refreshBtn,#callbackPhone,#callbackTime,#callbackReason,#callbackBtn")];
    const initialDisabled = loadingControls.map(control => control.disabled);
    loadingControls.forEach(control => { control.disabled = true; });
    main().catch((error) => {
      console.error(error);
      const message = String(error?.message || "");
      if (message.toLowerCase().includes("login") || message.toLowerCase().includes("access")) {
        window.location.href = "login.html";
        return;
      }
      showSoftSupportStatus("Kagie could not fully load support right now. Your page is still open and you can try again shortly.");
      const messages = $("messages");
      const callbacks = $("callbacks");
      if (messages && !messages.innerHTML.trim()) messages.innerHTML = `<div class="empty">Support is temporarily reconnecting.</div>`;
      if (callbacks && !callbacks.innerHTML.trim()) callbacks.innerHTML = `<div class="empty">Callback requests will appear here once support reconnects.</div>`;
    }).finally(() => {
      loadingControls.forEach((control, index) => { control.disabled = initialDisabled[index]; });
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
