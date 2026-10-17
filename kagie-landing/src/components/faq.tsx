"use client";

import { useEffect, useRef } from "react";
import { Plus, X } from "lucide-react";
import { faqs } from "@/lib/content";
import { SectionHeading } from "./ui";

export function FAQ() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  function close() {
    dialogRef.current?.close();
    if (window.location.hash === "#faq") window.history.replaceState(null, "", window.location.pathname + window.location.search);
    const target = [openerRef.current, document.querySelector<HTMLElement>(".desktop-nav a[href='#faq']"), document.querySelector<HTMLElement>(".menu-toggle")]
      .find(element => element && element !== document.body && element !== document.documentElement && element.getClientRects().length);
    target?.focus({ preventScroll: true });
  }

  useEffect(() => {
    function syncHash() {
      const dialog = dialogRef.current;
      if (!dialog) return;
      if (window.location.hash === "#faq" && !dialog.open) {
        openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        dialog.showModal();
      } else if (window.location.hash !== "#faq" && dialog.open) dialog.close();
    }
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  return <dialog id="faq" className="faq-dialog" ref={dialogRef} aria-labelledby="faq-title" onCancel={event => { event.preventDefault(); close(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) close();
  }}>
    <button className="faq-close" aria-label="Close frequently asked questions" onClick={close} autoFocus><X size={20} /></button>
    <section className="faq-section">
    <div className="faq-intro"><SectionHeading id="faq-title">A little clarity for <span>your next step.</span></SectionHeading><p>Questions before you begin? We’ve got you.</p><a href="mailto:support@kagie.app">Talk to the Kagie team</a></div>
    <div className="faq-list">{faqs.map(faq => <details key={faq.question}><summary>{faq.question}<Plus size={19} aria-hidden="true" /></summary><p>{faq.answer}</p></details>)}</div>
    </section>
  </dialog>;
}
