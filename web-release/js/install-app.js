(function () {
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if (isStandalone) return;

  let deferredPrompt = null;
  let installBar = null;
  let installButton = null;
  let dismissButton = null;
  let note = null;

  function isAndroidMobile() {
    return /Android/i.test(navigator.userAgent || "");
  }

  function isChromeLike() {
    return /Chrome|CriOS|EdgA/i.test(navigator.userAgent || "");
  }

  function createInstallBar() {
    if (installBar) return;

    installBar = document.createElement("div");
    installBar.className = "kagie-install-bar";
    installBar.innerHTML = [
      '<div class="kagie-install-copy">',
      '  <strong>Install Kagie</strong>',
      '  <span id="kagieInstallNote">Add Kagie to your phone home screen.</span>',
      "</div>",
      '<div class="kagie-install-actions">',
      '  <button type="button" class="kagie-install-btn kagie-install-dismiss">Not now</button>',
      '  <button type="button" class="kagie-install-btn kagie-install-main">Install</button>',
      "</div>",
    ].join("");

    const style = document.createElement("style");
    style.textContent = [
      ".kagie-install-bar{position:fixed;left:12px;right:12px;bottom:16px;z-index:9999;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-radius:20px;background:linear-gradient(135deg,#cf111d,#ef4444);color:#fff;box-shadow:0 18px 42px rgba(207,17,29,.28)}",
      ".kagie-install-copy{display:flex;flex-direction:column;gap:4px;min-width:0}",
      ".kagie-install-copy strong{font:800 15px/1.2 Inter,Arial,sans-serif}",
      ".kagie-install-copy span{font:500 12px/1.35 Inter,Arial,sans-serif;opacity:.94}",
      ".kagie-install-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}",
      ".kagie-install-btn{border:none;border-radius:999px;padding:10px 14px;font:700 13px/1 Inter,Arial,sans-serif;cursor:pointer}",
      ".kagie-install-dismiss{background:rgba(255,255,255,.18);color:#fff}",
      ".kagie-install-main{background:#fff;color:#cf111d}",
      ".kagie-install-hide{display:none !important}",
      "@media (max-width:640px){.kagie-install-bar{left:10px;right:10px;bottom:12px;padding:12px 14px;align-items:flex-start;flex-direction:column}.kagie-install-actions{width:100%}.kagie-install-btn{flex:1}}",
    ].join("");

    document.head.appendChild(style);
    document.body.appendChild(installBar);

    installButton = installBar.querySelector(".kagie-install-main");
    dismissButton = installBar.querySelector(".kagie-install-dismiss");
    note = installBar.querySelector("#kagieInstallNote");

    dismissButton.addEventListener("click", function () {
      installBar.classList.add("kagie-install-hide");
      sessionStorage.setItem("kagie_install_bar_hidden", "1");
    });

    installButton.addEventListener("click", async function () {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        try {
          await deferredPrompt.userChoice;
        } catch (error) {
          console.warn("Install prompt did not complete.", error);
        }
        deferredPrompt = null;
        installBar.classList.add("kagie-install-hide");
        return;
      }

      const manualMessage = isChromeLike()
        ? "In Chrome, open the menu and tap 'Add to Home screen' or 'Install app'."
        : "Open this page in Chrome on Android, then tap 'Add to Home screen'.";
      window.alert(manualMessage);
    });
  }

  function showInstallBar(message) {
    if (!isAndroidMobile()) return;
    if (sessionStorage.getItem("kagie_install_bar_hidden") === "1") return;

    createInstallBar();
    if (message && note) note.textContent = message;
    installBar.classList.remove("kagie-install-hide");
  }

  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    deferredPrompt = event;
    showInstallBar("Tap install to put Kagie on your phone.");
  });

  window.addEventListener("appinstalled", function () {
    if (installBar) installBar.classList.add("kagie-install-hide");
    deferredPrompt = null;
  });

  window.addEventListener("load", function () {
    window.setTimeout(function () {
      if (!deferredPrompt) {
        showInstallBar("Use Chrome menu > Add to Home screen.");
      }
    }, 1800);
  });
})();
