import Image from "next/image";
import {
  ArrowRight, ArrowUpRight, BookOpen, Check, CircleCheck, CircleX, GraduationCap,
  HandCoins, Headphones, House, Landmark, Rocket, ShieldCheck, TrendingUp,
  UserRound, UsersRound, Mail,
} from "lucide-react";
import { beforeItems, afterItems, features, institutions, routes, stats, steps, appLink } from "@/lib/content";
import { Brand, ButtonLink, SectionHeading, SouthAfricanFlag, FacebookIcon, LinkedInIcon } from "./ui";
import { PhoneMockup } from "./phone-mockup";

export function Hero() {
  return <section className="hero" aria-labelledby="hero-heading">
    <div className="hero-copy">
      <div className="hero-badge"><SouthAfricanFlag /> YOUR NEXT CHAPTER STARTS HERE</div>
      <h1 id="hero-heading">Your Future<br />Starts With <span>One<br />Application</span></h1>
      <p className="hero-description">Apply to South Africa’s universities, colleges, and TVET institutions from one powerful platform.</p>
      <div className="hero-actions"><ButtonLink href={routes.signup}><Rocket size={19} />Start Applying Free</ButtonLink><ButtonLink href="#universities" variant="secondary"><Landmark size={19} />Explore Institutions</ButtonLink></div>
      <ul className="hero-trust"><li><ShieldCheck size={17} />Trusted by SA Students</li><li><UserRound size={17} />One Account, Multiple Applications</li><li><TrendingUp size={17} />Track Everything In One Place</li></ul>
    </div>
    <div className="hero-visual">
      <div className="dot-pattern hero-dots-one" aria-hidden="true" /><div className="dot-pattern hero-dots-two" aria-hidden="true" />
      <div className="hero-phone-wrap"><PhoneMockup /></div>
      <div className="hero-floating-cards">
        <a href="#universities" className="floating-card"><span className="floating-icon text-red"><GraduationCap /></span><span><strong className="card-number">26+</strong><small>Universities</small></span></a>
        <a href={routes.courses} className="floating-card"><span className="floating-icon text-blue"><BookOpen /></span><span><strong className="card-number">500+</strong><small>Courses</small></span></a>
        <a href={routes.funding} className="floating-card"><span className="floating-icon text-gold"><HandCoins /></span><span><strong>NSFAS</strong><small>Information</small></span></a>
        <a href={routes.housing} className="floating-card"><span className="floating-icon text-green"><House /></span><span><strong>Student<br />Housing</strong></span></a>
      </div>
    </div>
  </section>;
}

export function Comparison() {
  return <section className="comparison-section" data-reveal aria-labelledby="comparison-heading">
    <div className="comparison-heading"><SectionHeading id="comparison-heading">Why Students Choose <span>Kagie</span></SectionHeading></div>
    <div className="comparison-grid">
      <div className="comparison-column comparison-before"><h3>Before Kagie <span aria-hidden="true">😩</span></h3><ul>{beforeItems.map(item => <li key={item}><CircleX size={16} fill="currentColor" /><span>{item}</span></li>)}</ul></div>
      <div className="comparison-arrow" aria-hidden="true"><ArrowRight size={25} /></div>
      <div className="comparison-column comparison-after"><h3>With Kagie <span aria-hidden="true">🚀</span></h3><ul>{afterItems.map(item => <li key={item}><CircleCheck size={16} fill="currentColor" /><span>{item}</span></li>)}</ul></div>
    </div>
  </section>;
}

export function Features() {
  return <section id="features" className="features-section" data-reveal>
    <SectionHeading>Everything You Need, In <span>One App</span></SectionHeading>
    <div className="features-grid">{features.map(({ title, description, icon: Icon, href, id }) => <a key={title} id={id} href={href} className="feature-card">
      <div className="feature-icon"><Icon size={28} strokeWidth={1.8} /></div><h3>{title}</h3><p>{description}</p><ArrowUpRight className="feature-arrow" size={18} aria-hidden="true" />
    </a>)}</div>
  </section>;
}

export function Institutions() {
  return <section id="universities" className="institutions-section" data-reveal>
    <SectionHeading>Access South Africa’s <span>Leading Institutions</span></SectionHeading>
    <div className="institution-grid">{institutions.map(institution => <a className="institution-card" key={institution.short} href={institution.url} target="_blank" rel="noopener noreferrer" aria-label={`Visit ${institution.name} (opens in a new tab)`}>
      {institution.logo ? <Image src={`/images/institutions/${institution.logo}`} alt={institution.name} width={95} height={98} className="institution-logo" /> : <div className="institution-wordmark" style={{ color: institution.color }}><strong>{institution.short}</strong><span>{institution.name}</span></div>}
      <span className="institution-tooltip">{institution.name}<ArrowUpRight size={12} /></span>
    </a>)}</div>
  </section>;
}

export function HowItWorks() {
  return <section id="how-it-works" className="how-section" data-reveal>
    <SectionHeading>How <span>Kagie</span> Works</SectionHeading>
    <ol className="steps-grid">{steps.map(({ title, description, icon: Icon }, index) => <li key={title} className="step-card">
      <div className="step-top"><Icon size={31} strokeWidth={1.7} /><span className="step-number">{index + 1}</span></div><h3>{title}</h3><p>{description}</p>{index < steps.length - 1 ? <ArrowRight className="step-connector" size={18} aria-hidden="true" /> : null}
    </li>)}</ol>
  </section>;
}

export function DashboardShowcase() {
  return <section className="dashboard-section" data-reveal aria-labelledby="dashboard-heading">
    <div className="dashboard-copy"><p className="eyebrow">Stay In Control</p><h2 id="dashboard-heading">Your Dashboard.<br />Your <span>Journey.</span></h2><p className="dashboard-description">Everything you need to manage your applications, all in one place.</p><ul>{["Real-time application tracking", "Important deadlines & reminders", "Secure and easy to use", "Access anywhere, anytime"].map(item => <li key={item}><CircleCheck size={16} fill="currentColor" /><span>{item}</span></li>)}</ul></div>
    <div className="dashboard-visual"><div className="showcase-phone"><PhoneMockup compact /></div><div className="application-cards">
      <div className="application-card status-card"><strong>Application Status</strong><span className="status-submitted"><Check size={13} />Submitted</span></div>
      <div className="application-card institution-status"><Image src="/images/institutions/tut.png" alt="" width={35} height={37} /><div><small>Institution</small><strong>TUT</strong><p>Tshwane University of Technology</p></div></div>
      <div className="application-card course-status"><span className="text-purple"><BookOpen size={30} /></span><div><small>Course</small><p>Diploma in Information<br />& Communication Technology</p></div></div>
      <div className="application-card showcase-progress"><small>Progress</small><strong>85%</strong><div className="progress-track"><div className="progress-fill" /></div></div>
    </div><div className="dot-pattern dashboard-dots" aria-hidden="true" /></div>
  </section>;
}

const statIcons = [UsersRound, Landmark, BookOpen, Headphones];
export function Statistics() {
  return <section className="stats-bar" aria-label="Kagie in numbers" data-reveal>{stats.map((stat, index) => {
    const Icon = statIcons[index];
    return <div key={stat.label} className="stat"><Icon size={42} strokeWidth={1.5} /><div><strong>{stat.value}</strong><span>{stat.label}</span></div></div>;
  })}</section>;
}

export function FinalCTA() {
  return <section className="final-cta" data-reveal aria-labelledby="cta-heading">
    <div className="cta-copy"><h2 id="cta-heading">Ready To Start Your<br />Academic Journey?</h2><p>Join Kagie today and apply smarter, not harder.</p></div>
    <div className="cta-controls"><div className="cta-buttons"><ButtonLink href={routes.open} variant="white"><Rocket size={18} />Open Kagie<ArrowRight size={16} /></ButtonLink><ButtonLink href={routes.signup} variant="outline">Create Free Account</ButtonLink></div><ul className="cta-trust"><li><CircleCheck size={13} />Free to Use</li><li><ShieldCheck size={13} />Secure & Reliable</li><li><Check size={13} />Trusted by Thousands</li></ul></div>
    <div className="cta-students"><Image src="/images/students.webp" alt="Two smiling South African students with a notebook and phone" width={900} height={600} sizes="(max-width: 600px) 280px, 330px" /></div>
    <div className="cta-rays" aria-hidden="true"><i /><i /><i /></div>
  </section>;
}

export function Footer() {
  return <footer className="site-footer"><div className="container">
    <div className="footer-grid"><div className="footer-brand"><Brand footer /><p>Apply to South Africa’s universities, colleges, and TVET institutions from one powerful platform.</p><div className="social-links"><a href="https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fkagie.app" target="_blank" rel="noopener noreferrer" aria-label="Share Kagie on Facebook (opens in a new tab)"><FacebookIcon /></a><a href="https://twitter.com/intent/tweet?url=https%3A%2F%2Fkagie.app&text=Your%20future%20starts%20with%20one%20application" target="_blank" rel="noopener noreferrer" aria-label="Share Kagie on X (opens in a new tab)"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.9 2H22l-6.8 7.8L23.2 22h-6.3L12 14.6 5.5 22H2.4l7.8-8.9L.8 2h6.5l5.5 6.7L18.9 2ZM17.8 20h1.7L6.3 3.9H4.5L17.8 20Z" /></svg></a><a href="mailto:support@kagie.app" aria-label="Email Kagie support"><Mail size={18} /></a><a href="https://www.linkedin.com/sharing/share-offsite/?url=https%3A%2F%2Fkagie.app" target="_blank" rel="noopener noreferrer" aria-label="Share Kagie on LinkedIn (opens in a new tab)"><LinkedInIcon /></a></div></div>
    <nav className="footer-column" aria-label="Product links"><h3>Product</h3><a href="#features">Features</a><a href="#universities">Universities</a><a href={routes.courses}>Courses</a><a href={routes.housing}>Accommodation</a><a href="#faq">FAQ</a></nav>
    <nav className="footer-column" aria-label="Support links"><h3>Support</h3><a href="#faq">Help Centre</a><a href="mailto:support@kagie.app">Contact Us</a><a href={appLink("personal-assistance.html")}>Student Support</a></nav>
    <nav className="footer-column" aria-label="Legal links"><h3>Legal</h3><a href={appLink("privacy.html")}>Privacy Policy</a><a href={appLink("terms.html")}>Terms of Service</a></nav></div>
    <div className="footer-bottom"><p>© {new Date().getFullYear()} Kagie App. All rights reserved.</p><span>Built for South Africa’s brighter futures <SouthAfricanFlag /></span></div>
  </div></footer>;
}
