"use client";

import { useEffect } from "react";
import { appLink } from "@/lib/content";

export function PageEffects() {
  useEffect(() => {
    if (window.location.protocol !== "https:" || !("serviceWorker" in navigator)) return;
    const register = () => { navigator.serviceWorker.register("/sw.js").catch(error => console.warn("PWA service worker registration failed.", error)); };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  useEffect(() => {
    // Preserve the existing Supabase email-confirmation callback flow.
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const code = query.get("code") || hash.get("code") || "";
    if (["access_token", "refresh_token", "token_hash"].some(key => query.has(key) || hash.has(key)) || code.length >= 20) {
      window.location.replace(appLink("login.html") + window.location.search + window.location.hash);
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const elements = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.isIntersecting) { entry.target.classList.add("revealed"); observer.unobserve(entry.target); }
      }
    }, { threshold: 0.08 });
    for (const element of elements) { element.classList.add("reveal-ready"); observer.observe(element); }
    return () => { observer.disconnect(); elements.forEach(element => element.classList.remove("reveal-ready")); };
  }, []);
  return null;
}
