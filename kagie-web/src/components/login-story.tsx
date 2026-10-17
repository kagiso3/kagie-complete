export function GraduationIcon() {
  return <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="m2 12 14-7 14 7-14 7Z" fill="currentColor" /><path d="M7 17v7l9 4 9-4v-7l-9 4Z" fill="currentColor" /><path d="M29 13v10" stroke="currentColor" strokeWidth="2" /><circle cx="29" cy="24" r="2" fill="currentColor" /></svg>;
}

export function LoginStory() {
  return <aside className="auth-story" aria-labelledby="authStoryTitle">
    <div><span className="auth-eyebrow">Your next chapter</span><h2 id="authStoryTitle">One application.<br />More possibilities.</h2><p>Take your next step with Kagie. Find your courses, prepare your documents and reach multiple institutions in one place.</p></div>
    <div className="auth-story-art">
      {[
        { title: "Find your path", copy: "Explore courses and institutions", href: "/institutions.html", icon: <GraduationIcon /> },
        { title: "Apply with confidence", copy: "Keep your details and documents together", href: "/apply.html", icon: <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect x="5" y="2" width="23" height="28" rx="3" fill="currentColor" /><path d="M10 8h12v17H10Z M13 12h6m-6 4h6m-6 4h6" stroke="white" strokeWidth="1.8" /><path d="M3 7v22a2 2 0 0 0 2 2" stroke="currentColor" strokeWidth="2" /></svg> },
        { title: "Stay on track", copy: "Follow your applications and next steps", href: "/home.html", icon: <svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><circle cx="16" cy="16" r="15" fill="currentColor" /><path d="m9 16 5 5 10-11" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg> }
      ].map(({ title, copy, href, icon }) => <a className="auth-story-row" href={href} key={title}>
        <span className="auth-story-icon">{icon}</span><div><strong>{title}</strong><small>{copy}</small></div>
        <span className="auth-story-chevron" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m9 4 7 8-7 8" /></svg></span>
      </a>)}
    </div>
    <div className="auth-story-bottom"><div className="auth-story-foot"><svg viewBox="0 0 24 28" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2 2 7v7c0 6 10 12 10 12s10-6 10-12V7Z" /><path d="m7 14 4 4 6-8" /></svg><span>Built for your tertiary journey</span></div><div className="auth-story-dots" aria-hidden="true"><span /><span /><span /></div></div>
  </aside>;
}
