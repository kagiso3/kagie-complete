import { Header } from "@/components/header";
import { Hero, Comparison, Features, Institutions, HowItWorks, DashboardShowcase, Statistics, FinalCTA, Footer } from "@/components/landing-sections";
import { Testimonials } from "@/components/testimonials";
import { FAQ } from "@/components/faq";
import { PageEffects } from "@/components/page-effects";

export default function HomePage() {
  return <div className="page-frame">
    <a href="#main-content" className="skip-link">Skip to main content</a>
    <Header />
    <main id="main-content" tabIndex={-1} className="container">
      <Hero /><Comparison /><Features /><Institutions /><HowItWorks /><DashboardShowcase /><Statistics /><Testimonials /><FinalCTA />
    </main>
    <Footer /><FAQ /><PageEffects />
  </div>;
}
