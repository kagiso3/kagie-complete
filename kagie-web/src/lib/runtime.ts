import type { LegacyApi } from "./types";

const scriptCache = new Map<string, Promise<void>>();
let runtimePromise: Promise<LegacyApi> | null = null;

function loadScript(src: string) {
  if (scriptCache.has(src)) {
    return scriptCache.get(src)!;
  }

  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[data-kagie-runtime="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "true") {
        resolve();
        return;
      }
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error(`Could not load ${src}`)), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.defer = true;
    script.dataset.kagieRuntime = src;
    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolve();
      },
      { once: true }
    );
    script.addEventListener("error", () => reject(new Error(`Could not load ${src}`)), { once: true });
    document.head.appendChild(script);
  });

  scriptCache.set(src, promise);
  return promise;
}

export async function ensureLegacyRuntime() {
  if (window.KagieAPI) {
    return window.KagieAPI;
  }

  if (!runtimePromise) {
    runtimePromise = (async () => {
      await loadScript("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2");
      await loadScript("/legacy/js/data.js");
      await loadScript("/legacy/js/supabase-config.js");
      await loadScript("/legacy/js/backend.js");

      if (!window.KagieAPI) {
        throw new Error("Kagie runtime could not be initialized.");
      }

      return window.KagieAPI;
    })();
  }

  return runtimePromise;
}

export async function ensureNationalCatalogLoaded() {
  await ensureLegacyRuntime();
  if (Array.isArray(window.KagieData?.highSchools) && window.KagieData.highSchools.length) {
    return true;
  }
  await loadScript("/legacy/js/sa-catalog.js");
  return true;
}
