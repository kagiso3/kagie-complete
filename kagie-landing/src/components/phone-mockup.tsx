import { Bell, BookOpen, BriefcaseBusiness, BusFront, Ellipsis, FileText, GraduationCap, HandCoins, House, UserRound, Wifi, BatteryFull } from "lucide-react";

const shortcuts = [
  { icon: GraduationCap, label: "Apply", color: "red" },
  { icon: BookOpen, label: "Courses", color: "blue" },
  { icon: House, label: "Accommodation", color: "red" },
  { icon: BusFront, label: "Transport", color: "blue" },
  { icon: Bell, label: "Updates", color: "purple" },
  { icon: BriefcaseBusiness, label: "Career", color: "gold" },
  { icon: HandCoins, label: "NSFAS info", color: "red" },
  { icon: Ellipsis, label: "More", color: "purple" },
];

export function PhoneMockup({ compact = false }: { compact?: boolean }) {
  return <div className={`phone-mockup ${compact ? "phone-compact" : ""}`} role="img" aria-label="Example Kagie mobile dashboard: Hello Winner, eight student services, and application progress at 85 percent.">
    <div className="phone-side phone-side-left" /><div className="phone-side phone-side-right" />
    <div className="phone-screen">
      <div className="phone-notch"><span /><i /></div>
      <div className="phone-top">
        <div className="phone-status"><span>9:41</span><span><Wifi size={10} /><BatteryFull size={12} /></span></div>
        <div className="phone-greeting"><strong>Hello Winner <span>👋</span></strong><span className="phone-logout">Log out</span></div>
        <p>Ready to apply?</p>
        <div className="phone-tabs"><span>Updates</span><span>Applications</span></div>
      </div>
      <div className="phone-content">
        <div className="phone-shortcuts">{shortcuts.map(({ icon: Icon, label, color }) => <div key={label} className="phone-shortcut"><Icon className={`text-${color}`} size={19} strokeWidth={2} /><span>{label}</span></div>)}</div>
        <div className="phone-progress">
          <strong>Application Progress</strong><span>85% Complete</span>
          <div className="progress-track"><div className="progress-fill" /></div>
          <small>Keep going, you’re almost there!</small>
        </div>
        <div className="phone-empty"><div /><div /></div>
      </div>
      <div className="phone-bottom">{[{ icon: House, label: "Home" }, { icon: FileText, label: "Applications" }, { icon: Bell, label: "Updates" }, { icon: UserRound, label: "Profile" }].map(({ icon: Icon, label }, index) => <div key={label} className={index === 0 ? "is-active" : ""}><Icon size={17} /><span>{label}</span></div>)}</div>
      <div className="phone-home-indicator" />
    </div>
  </div>;
}
