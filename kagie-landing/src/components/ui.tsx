import type { ReactNode } from "react";

export function Brand({ footer = false }: { footer?: boolean }) {
  return <a href="/" className={`brand ${footer ? "brand-footer" : ""}`} aria-label="Kagie home">
    <span className="brand-mark" aria-hidden="true">K<span /></span>
    <span className="brand-copy"><strong>Kagie App</strong><small>Your Future. Our Priority.</small></span>
  </a>;
}

export function ButtonLink({ href, children, variant = "primary", className = "" }: { href: string; children: ReactNode; variant?: "primary" | "secondary" | "white" | "outline"; className?: string }) {
  return <a href={href} className={`button button-${variant} ${className}`}>{children}</a>;
}

export function SectionHeading({ children, id }: { children: ReactNode; id?: string }) {
  return <h2 className="section-heading" id={id}>{children}</h2>;
}

export function FacebookIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 21v-8h2.7l.4-3H14V8.1c0-.9.3-1.5 1.6-1.5h1.7V3.9c-.3 0-1.3-.1-2.4-.1-2.4 0-4 1.4-4 4.1V10H8.2v3h2.7v8H14Z" /></svg>;
}

export function LinkedInIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M5 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM3.5 9H6.5V21H3.5V9ZM9 9h3v1.6a3.7 3.7 0 0 1 3.3-1.9c3.5 0 4.2 2.2 4.2 5.1V21h-3v-6.4c0-1.6-.1-3-2.1-3s-2.4 1.5-2.4 3V21H9V9Z" /></svg>;
}

export function SouthAfricanFlag() {
  return <svg role="img" aria-label="South Africa" className="sa-flag" viewBox="0 0 30 20" width="19" height="13"><path fill="#de3831" d="M0 0h30v10H0z" /><path fill="#002395" d="M0 10h30v10H0z" /><path fill="#fff" d="m0 0 12 7h18v6H12L0 20v-4l10-6L0 4Z" /><path fill="#007a4d" d="m0 0 13 8h17v4H13L0 20v-5l8-5L0 5Z" /><path fill="#ffb612" d="m0 3 11 7-11 7Z" /><path fill="#000" d="m0 5 8 5-8 5Z" /></svg>;
}
