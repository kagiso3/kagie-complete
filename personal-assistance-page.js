(function () {
  window.KagiePersonalAssistancePageLoaded = true;

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  const dt = (v) => {
    if (!v) return "No date";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "No date" : d.toLocaleString("en-ZA", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  async function main() {
    const api = window.KagieAPI;
    const restored = api.currentUser() || await api.restoreSession();
    if (!restored || restored.role !== "user") {
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
      const items = api.getSupportMessagesAsync ? await api.getSupportMessagesAsync(`support_${user.id}`) : (api.getSupportMessages(`support_${user.id}`) || []);
      $("messageMeta").textContent = `${items.length} chat message${items.length === 1 ? "" : "s"}`;
      $("messages").innerHTML = items.length ? items.map((i) => `<div class="msg ${i.senderRole === "user" ? "user" : "agent"}"><small>${esc(i.senderName || i.senderRole || "Kagie")}</small>${esc(i.text || "")}<br><small>${esc(dt(i.createdAt))}</small></div>`).join("") : `<div class="empty">No chat messages yet. Send the first one and your thread will be visible to assistant admins.</div>`;
      $("messages").scrollTop = $("messages").scrollHeight;
    }

    async function renderCallbacks() {
      const calls = api.getMyCallRequestsAsync ? await api.getMyCallRequestsAsync(user.id) : (api.getMyCallRequests(user.id) || []);
      $("callbackMeta").textContent = `${calls.length} callback request${calls.length === 1 ? "" : "s"}`;
      $("callbacks").innerHTML = calls.length ? calls.map((c) => `<div class="item"><div class="row"><strong>${esc(c.phone || user.phone || "No phone")}</strong><span class="status ${cls(c.status)}">${esc(c.status || "Pending")}</span></div><p>Preferred time: ${esc(c.preferredTime || "-")}<br>Reason: ${esc(c.reason || "-")}<br>Requested: ${esc(dt(c.createdAt))}</p></div>`).join("") : `<div class="empty">No callback requests yet.</div>`;
    }

    $("sendBtn").addEventListener("click", async () => {
      const text = $("messageInput").value.trim();
      if (!text) {
        $("messageInput").focus();
        return;
      }
      if (api.sendSupportMessageAsync) await api.sendSupportMessageAsync(`support_${user.id}`, text);
      else api.sendSupportMessage(`support_${user.id}`, text);
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
        alert("Enter your phone number and callback reason.");
        return;
      }
      if (api.requestCallbackAsync) await api.requestCallbackAsync({ phone, preferredTime, reason });
      else api.requestCallback({ phone, preferredTime, reason });
      $("callbackTime").value = "";
      $("callbackReason").value = "";
      await renderCallbacks();
    });

    $("refreshBtn").addEventListener("click", renderMessages);
    $("heroTitle").textContent = `Hello, ${user.fullName || "Student"}`;
    $("heroText").textContent = "Support conversations are stored in Kagie so your assigned assistant and admins can follow your case.";
    await renderMessages();
    await renderCallbacks();
    setInterval(() => { renderMessages().catch(console.warn); }, 15000);
  }

  const start = () => {
    main().catch((error) => {
      console.error(error);
      alert(error.message || "Kagie could not load support.");
      window.location.href = "login.html";
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
