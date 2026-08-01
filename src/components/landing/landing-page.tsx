import { LandingFeatures } from "./landing-features";
import { LandingFooter } from "./landing-footer";
import { LandingHero } from "./landing-hero";
import { LandingNav } from "./landing-nav";
import { RecommendationShowcase } from "./recommendation-showcase";
import { SupportedProviderStrip } from "./supported-provider-strip";

export function LandingPage() {
  return (
    <div className="cinema-landing min-h-screen overflow-x-clip bg-[#10151b] text-[#f4f7f9] selection:bg-[#ff6b3d] selection:text-white">
      <LandingNav />
      <main>
        <LandingHero />
        <SupportedProviderStrip />
        <RecommendationShowcase />
        <LandingFeatures />
      </main>
      <LandingFooter />
    </div>
  );
}
