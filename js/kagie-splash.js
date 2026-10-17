(function () {
  'use strict';
  if (window.KagieSplash) return;
  let active = null;

  function show(options = {}) {
    if (active) return active;
    const previousFocus = document.activeElement;
    const overlay = options.element || document.createElement('div');
    overlay.className = 'kagie-splash-overlay';
    overlay.dataset.kagieSplashManaged = 'true';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', options.label || 'Loading Kagie');
    overlay.tabIndex = -1;
    let frame = overlay.querySelector('iframe');
    if (!frame) {
      frame = document.createElement('iframe');
      frame.title = options.label || 'Loading Kagie';
      const source = new URL('/splash.html', window.location.origin);
      source.searchParams.set('embedded', '1');
      source.searchParams.set('label', options.label || 'Loading Kagie');
      frame.src = source.href;
      overlay.appendChild(frame);
      document.body.appendChild(overlay);
    }
    const background = Array.from(document.body.children)
      .filter(node => node !== overlay)
      .map(node => ({ node, inert: node.inert }));
    background.forEach(({ node }) => { node.inert = true; });
    overlay.focus({ preventScroll: true });
    let resolveDone;
    const done = new Promise(resolve => { resolveDone = resolve; });
    let ready = false;
    let finishing = Boolean(options.element);
    let disposed = false;
    function dispose() {
      if (disposed) return;
      disposed = true;
      clearTimeout(watchdog);
      window.removeEventListener('message', onMessage);
      frame.removeEventListener('error', dispose);
      overlay.remove();
      background.forEach(({ node, inert }) => { node.inert = inert; });
      active = null;
      window.requestAnimationFrame(() => {
        if (previousFocus?.isConnected && !previousFocus.disabled) previousFocus.focus?.({ preventScroll: true });
      });
      resolveDone();
    }
    function requestFinish() {
      if (ready && finishing && !disposed) {
        frame.contentWindow?.postMessage({ type: 'kagie:splash:finish' }, window.location.origin);
      }
    }
    function onMessage(event) {
      if (event.origin !== window.location.origin || event.source !== frame.contentWindow) return;
      if (event.data?.type === 'kagie:splash:ready') { ready = true; requestFinish(); }
      if (event.data?.type === 'kagie:splash:complete') dispose();
    }
    const watchdog = window.setTimeout(dispose, 8000);
    window.addEventListener('message', onMessage);
    frame.addEventListener('error', dispose, { once: true });
    active = Object.freeze({
      finish() { finishing = true; requestFinish(); return done; },
      cancel: dispose
    });
    return active;
  }

  window.KagieSplash = Object.freeze({ show });
})();
