"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";
import { navLinks, routes } from "@/lib/content";
import { Brand, ButtonLink } from "./ui";

export function Header() {
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); toggleRef.current?.focus(); }
    }
    function onOutside(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onResize() { if (window.innerWidth > 900) setOpen(false); }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onOutside);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onOutside);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return <header className="site-header" ref={headerRef}>
    <nav className="container nav-shell" aria-label="Primary navigation">
      <Brand />
      <div className="desktop-nav">{navLinks.map(link => <a key={link.label} href={link.href}>{link.label}</a>)}</div>
      <ButtonLink href={routes.open} className="nav-cta">Open Kagie <ArrowRight size={17} /></ButtonLink>
      <button ref={toggleRef} className="menu-toggle" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
    </nav>
    <nav id="mobile-navigation" className="mobile-nav" aria-label="Mobile navigation" hidden={!open}>
      {navLinks.map(link => <a key={link.label} href={link.href} onClick={() => setOpen(false)}>{link.label}<ArrowRight size={16} /></a>)}
      <ButtonLink href={routes.signup}>Start Applying Free <ArrowRight size={17} /></ButtonLink>
    </nav>
  </header>;
}
