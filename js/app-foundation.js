(function () {
  "use strict";
  // Local outline icons keep navigation readable when external font services fail.
  const shapes = {
    home: '<path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/>',
    assignment: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V2h6v2M8 10h8M8 14h8M8 18h5"/>',
    business_center: '<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12h18M10 12v3h4v-3"/>',
    school: '<path d="m2 9 10-6 10 6-10 6Z"/><path d="M6 12v6q6 5 12 0v-6M22 9v8"/>',
    apartment: '<path d="M4 21V3h10v18M14 9h6v12M2 21h20M8 6h2M8 10h2M8 14h2M17 12h1M17 16h1M8 21v-3h2v3"/>',
    directions_bus: '<rect x="4" y="3" width="16" height="17" rx="3"/><path d="M4 8h16M4 14h16M7 20v2M17 20v2M8 17h.01M16 17h.01"/>',
    arrow_back: '<path d="M20 12H4m7-7-7 7 7 7"/>',
    arrow_forward: '<path d="M4 12h16m-7-7 7 7-7 7"/>',
    chevron_left: '<path d="m15 5-7 7 7 7"/>',
    chevron_right: '<path d="m9 5 7 7-7 7"/>',
    check: '<path d="m4 12 5 5L20 6"/>',
    check_circle: '<circle cx="12" cy="12" r="9"/><path d="m7 12 3 3 7-7"/>',
    notifications: '<path d="M5 17h14l-2-3V9a5 5 0 0 0-10 0v5ZM10 21h4M12 2v2"/>',
    shopping_cart: '<path d="M2 3h3l3 13h11l3-9H6M10 21h.01M18 21h.01"/>',
    shopping_bag: '<path d="M4 7h16v14H4ZM8 7V6a4 4 0 0 1 8 0v1"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
    call: '<path d="M6 3h4l1 5-3 2a16 16 0 0 0 6 6l2-3 5 1v4c0 3-3 4-6 3C8 19 5 16 3 9 2 6 3 3 6 3Z"/>',
    chat_bubble: '<path d="M3 4h18v14H9l-6 4ZM7 9h10M7 13h7"/>',
    headset_mic: '<path d="M4 13V11a8 8 0 0 1 16 0v6q0 4-6 4M4 12H2v6h4v-6ZM20 12h2v6h-4v-6Z"/>',
    calendar_month: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 10h18M7 14h2M13 14h2M7 18h2"/>',
    schedule: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 3"/>',
    timer: '<circle cx="12" cy="14" r="8"/><path d="M9 2h6M12 2v4M12 10v4M18 7l2-2"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    warning: '<path d="m12 3 10 18H2ZM12 9v5M12 17h.01"/>',
    cloud_upload: '<path d="M6 18a5 5 0 0 1-1-10 7 7 0 0 1 13-1 5.5 5.5 0 0 1 1 11M12 21V11m-4 4 4-4 4 4"/>',
    upload_file: '<path d="M14 2H5v20h14V7ZM14 2v5h5M12 19v-8m-3 3 3-3 3 3"/>',
    receipt_long: '<path d="M5 2h14v20l-3-2-4 2-4-2-3 2ZM8 7h8M8 11h8M8 15h5"/>',
    credit_card: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20M6 16h4"/>',
    account_balance: '<path d="m2 7 10-5 10 5ZM4 10v8M9 10v8M15 10v8M20 10v8M2 21h20M3 18h18"/>',
    menu_book: '<path d="M12 5q-5-3-10 0v15q5-3 10 0 5-3 10 0V5q-5-3-10 0ZM12 5v15"/>',
    visibility: '<path d="M2 12q10-16 20 0-10 16-20 0Z"/><circle cx="12" cy="12" r="3"/>',
    edit_note: '<path d="M3 5h12M3 10h8M3 15h6m3 5 1-5 6-6 3 3-6 6Z"/>',
    sync_alt: '<path d="M3 7h18m-4-4 4 4-4 4M21 17H3m4-4-4 4 4 4"/>',
    workspace_premium: '<circle cx="12" cy="9" r="6"/><path d="m8 14-2 8 6-3 6 3-2-8"/>',
    person: '<circle cx="12" cy="7" r="4"/><path d="M3 22v-3a9 9 0 0 1 18 0v3"/>',
    menu: '<path d="M3 5h18M3 12h18M3 19h18"/>',
    close: '<path d="m5 5 14 14M5 19 19 5"/>',
    logout: '<path d="M10 3H3v18h7M8 12h14m-5-5 5 5-5 5"/>',
    dashboard: '<path d="M3 3h7v7H3ZM14 3h7v7h-7ZM3 14h7v7H3ZM14 14h7v7h-7Z"/>',
    apps: '<path d="M3 3h4v4H3ZM10 3h4v4h-4ZM17 3h4v4h-4ZM3 10h4v4H3ZM10 10h4v4h-4ZM17 10h4v4h-4ZM3 17h4v4H3ZM10 17h4v4h-4ZM17 17h4v4h-4Z"/>'
  };
  const codepoints = {
    e7fd: "person", e9ba: "logout", e5d2: "menu", e5cd: "close", e7f4: "notifications",
    e85d: "assignment", e871: "dashboard", f0e2: "headset_mic", e5c3: "apps",
    ef49: "info", e80c: "business_center", e65f: "school", ea19: "menu_book",
    ea40: "apartment", e530: "directions_bus", e8cc: "shopping_cart",
    e5c4: "arrow_back", e5c8: "arrow_forward", e5cb: "chevron_left", e5cc: "chevron_right"
  };
  const aliases = {
    receipt: "receipt_long", payments: "credit_card", inventory_2: "shopping_bag",
    badge: "person", family_restroom: "person", monitoring: "dashboard",
    design_services: "edit_note", sell: "shopping_bag", tag: "receipt_long",
    verified_user: "check_circle", description: "assignment", photo_camera: "visibility"
  };
  const selector = ".material-icons, .material-icons-outlined, .material-symbols-rounded, .material-symbols-outlined";
  function convertIcon(node) {
    const text = node.textContent.trim();
    if (!text) return;
    const name = codepoints[text.codePointAt(0).toString(16)] || aliases[text] || text;
    if (!shapes[name]) return;
    node.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + shapes[name] + '</svg>';
    node.classList.add("kagie-local-icon");
    node.setAttribute("aria-hidden", "true");
    node.dataset.kagieIcon = name;
  }
  function convertWithin(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.matches(selector)) convertIcon(node);
    node.querySelectorAll(selector).forEach(convertIcon);
  }
  function start() {
    const content = document.querySelector("main, .app > .content, .app-shell .scroll-content, .shell, .content");
    if (content) {
      if (!content.id) content.id = "kagie-main-content";
      content.setAttribute("tabindex", "-1");
      const skip = document.createElement("a");
      skip.className = "kagie-skip-link";
      skip.href = "#" + content.id;
      skip.textContent = "Skip to content";
      document.body.prepend(skip);
    }
    convertWithin(document.body);
    new MutationObserver(records => {
      const roots = new Set();
      for (const record of records) {
        if (record.target.nodeType === Node.ELEMENT_NODE && record.target.matches(selector)) roots.add(record.target);
        for (const node of record.addedNodes) if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== "svg") roots.add(node);
      }
      roots.forEach(convertWithin);
    }).observe(document.body, {childList: true, subtree: true});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, {once: true});
  else start();
})();
