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
      if (v.includes("resolve")) return "success";
      if (v.includes("contact")) return "review";
      return "pending";
    };

    async function renderMessages() {
      try {
        const items = api.getSupportMessagesAsync ? await api.getSupportMessagesAsync(`support_${user.id}`) : (api.getSupportMessages(`support_${user.id}`) || []);
        $("messageMeta").textContent = `${items.length} chat message${items.length === 1 ? "" : "s"}`;
        $("messages").innerHTML = items.length ? items.map((i) => `<div class="msg ${i.senderRole === "user" ? "user" : "agent"}"><small>${esc(i.senderName || i.senderRole || "Kagie")}</small>${esc(i.text || "")}<br><small>${esc(dt(i.createdAt))}</small></div>`).join("") : `<div class="empty">No chat messages yet. Send the first one and your thread will be visible to assistant admins.</div>`;
        $("messages").scrollTop = $("messages").scrollHeight;
      } catch (error) {
        if (!isRecoverable(error)) throw error;
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
        if (!isRecoverable(error)) throw error;
        console.warn("Personal assistance callback sync fell back to local mode:", error);
        const calls = api.getMyCallRequests ? (api.getMyCallRequests(user.id) || []) : [];
        $("callbackMeta").textContent = `${calls.length} callback request${calls.length === 1 ? "" : "s"}`;
        $("callbacks").innerHTML = calls.length ? calls.map((c) => `<div class="item"><div class="row"><strong>${esc(c.phone || user.phone || "No phone")}</strong><span class="status ${cls(c.status)}">${esc(c.status || "Pending")}</span></div><p>Preferred time: ${esc(c.preferredTime || "-")}<br>Reason: ${esc(c.reason || "-")}<br>Requested: ${esc(dt(c.createdAt))}</p></div>`).join("") : `<div class="empty">No callback requests yet. Kagie will keep your local requests visible while live sync reconnects.</div>`;
        showSoftSupportStatus();
      }
    }

    $("sendBtn").addEventListener("click", async () => {
      const text = $("messageInput").value.trim();
      if (!text) {
        $("messageInput").focus();
        return;
      }
      try {
        if (api.sendSupportMessageAsync) await api.sendSupportMessageAsync(`support_${user.id}`, text);
        else api.sendSupportMessage(`support_${user.id}`, text);
      } catch (error) {
        if (!isRecoverable(error)) throw error;
        console.warn("Support send fell back to local mode:", error);
        api.sendSupportMessage(`support_${user.id}`, text);
        showSoftSupportStatus("Support is reconnecting. Your message was saved on this device and Kagie will keep the conversation visible here.");
      }
      $("messageInput").value = "";
      await renderMessages();
    });

    $("messageInput").addEventListener("keydown", (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") $("sendBtn").click();
    });

    $("callbackBtn").addEventListener("click", async () => {
      const phone = $("callbackPhone").value.trim() || user.phone || "";
      const preferredTime = $("callbackTime").value.trim();
      const reason = $("callbackReason").value.trim();
      if (!phone || !reason) {
        showSoftSupportStatus("Enter your phone number and callback reason so Kagie can save the callback request.");
        $("callbackReason")?.focus();
        return;
      }
      try {
        if (api.requestCallbackAsync) await api.requestCallbackAsync({ phone, preferredTime, reason });
        else api.requestCallback({ phone, preferredTime, reason });
      } catch (error) {
        if (!isRecoverable(error)) throw error;
        console.warn("Callback request fell back to local mode:", error);
        api.requestCallback({ phone, preferredTime, reason });
        showSoftSupportStatus("Support is reconnecting. Your callback request was saved on this device and will stay visible here.");
      }
      $("callbackTime").value = "";
      $("callbackReason").value = "";
      await renderCallbacks();
    });

    $("refreshBtn").addEventListener("click", renderMessages);
    $("heroTitle").textContent = `Hello, ${user.fullName || "Student"}`;
    $("heroText").textContent = "Support conversations are stored in Kagie so your assigned assistant and admins can follow your case.";
    await renderMessages();
    await renderCallbacks();
    startPolling(renderMessages);
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        stopPolling();
        return;
      }
      renderMessages().catch(console.warn);
      startPolling(renderMessages);
    });
  }

  const start = () => {
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
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
