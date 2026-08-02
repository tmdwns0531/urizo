import { AppShell } from "../app-shell";
import { LandingFeatures } from "./landing-features";
import { LandingFooter } from "./landing-footer";
import { LandingHero } from "./landing-hero";
import { LandingNav } from "./landing-nav";
import { RecommendationShowcase } from "./recommendation-showcase";

export function LandingPage() {
  return (
    <AppShell
      className="cinema-landing bg-[#10151b]"
      header={<LandingNav />}
      contentAsMain={false}
    >
      <main>
        <LandingHero />
        <RecommendationShowcase />
        <LandingFeatures />
      </main>
      <LandingFooter />
    </AppShell>
  );
}
