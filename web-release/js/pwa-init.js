(() => {
  if (!("serviceWorker" in navigator)) return;
  if (window.location.protocol !== "https:") return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("PWA service worker registration failed.", error);
    });
  });
})();
