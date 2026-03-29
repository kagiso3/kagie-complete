(function () {
  window.KagieCartPageLoaded = true;

  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c]));
  const money = (v) => `R${Number(v || 0).toLocaleString("en-ZA")}`;

  async function main() {
    const api = window.KagieAPI;
    const restored = api.currentUser() || await api.restoreSession();
    if (!restored || restored.role !== "user") {
      window.location.href = "login.html";
      return;
    }

    const user = api.requireRole("user");
    const getItems = () => api.getCartAsync ? api.getCartAsync(user.id) : Promise.resolve(api.getCart(user.id) || []);
    const getTotal = async () => api.getCartTotalAsync ? api.getCartTotalAsync(user.id) : api.getCartTotal(user.id);

    async function render() {
      const cart = await getItems();
      const packs = cart.filter((i) => i.type === "application_pack");
      const services = cart.filter((i) => i.type === "service" || i.type === "service_request");
      const instCount = packs.reduce((sum, item) => sum + Number(item.institutionCount || item.institutions?.length || 0), 0);
      const total = await getTotal();

      $("heroTitle").textContent = `Hello, ${user.fullName || "Student"}`;
      $("heroText").textContent = cart.length ? "Review your saved Kagie items below before checkout." : "Your cart is empty right now.";
      $("itemMeta").textContent = `${cart.length} item${cart.length === 1 ? "" : "s"}`;
      $("instMeta").textContent = `${instCount} institution${instCount === 1 ? "" : "s"}`;
      $("totalMeta").textContent = `${money(total)} total`;

      const html = [];
      packs.forEach((item) => html.push(`<div class="item"><div class="row"><div><span class="badge">Application pack</span><div style="margin-top:8px"><strong>${esc(item.packName || item.name || "Application Pack")}</strong><p>Price: ${esc(money(item.packPrice || item.price))}<br>Institution limit: ${esc(item.institutionLimit === "unlimited" ? "Unlimited" : item.institutionLimit || 0)}</p></div></div><button class="mini red" data-remove="${esc(item.id)}" type="button">Remove</button></div><details><summary>View institutions</summary>${(item.institutions || []).length ? (item.institutions || []).map((inst) => `<div class="choice">${esc(inst.institutionName || inst.institution || "Institution")}<br>Faculty: ${esc(inst.faculty || "-")}<br>Choice 1: ${esc(inst.choice1 || "-")}<br>Choice 2: ${esc(inst.choice2 || "-")}<br>Choice 3: ${esc(inst.choice3 || "-")}</div>`).join("") : `<div class="empty">No institutions stored in this pack.</div>`}</details></div>`));
      services.forEach((item) => html.push(`<div class="item"><div class="row"><div><span class="badge">Support service</span><div style="margin-top:8px"><strong>${esc(item.serviceName || item.name || "Service")}</strong><p>Price: ${esc(money(item.price))}<br>Code: ${esc(item.serviceCode || "-")}</p></div></div><button class="mini red" data-remove="${esc(item.id)}" type="button">Remove</button></div></div>`));

      $("list").innerHTML = html.length ? html.join("") : `<div class="empty">No cart items yet. Add a pack in Forms or a service in More Service.</div>`;
      $("checkoutBtn").disabled = !cart.length;
      $("checkoutBtn").style.opacity = cart.length ? "1" : ".6";
      $("clearCartBtn").disabled = !cart.length;
      $("clearCartBtn").style.opacity = cart.length ? "1" : ".6";
    }

    $("list").addEventListener("click", async (e) => {
      const id = e.target.getAttribute("data-remove");
      if (!id) return;
      if (api.removeCartItemAsync) await api.removeCartItemAsync(id, user.id);
      else api.removeCartItem(id, user.id);
      await render();
    });

    $("checkoutBtn").addEventListener("click", async () => {
      if (!(await getItems()).length) return;
      window.location.href = "checkout.html";
    });

    $("clearCartBtn").addEventListener("click", async () => {
      if (!(await getItems()).length) return;
      if (!confirm("Clear every item from your cart and start again?")) return;
      if (api.clearCartAsync) await api.clearCartAsync(user.id);
      else api.clearCart(user.id);
      await render();
    });

    await render();
  }

  const start = () => {
    main().catch((error) => {
      console.error(error);
      alert(error.message || "Kagie could not load your cart.");
      window.location.href = "login.html";
    });
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
