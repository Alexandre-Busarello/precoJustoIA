import { JsonLd } from './json-ld'
import { LpHeader } from './lp-header'
import { PartnerTracker } from './partner-tracker'
import { HeroSection } from './sections/hero'
import { FeaturesRadarSection } from './sections/features-radar'
import { FeaturesSustainabilitySection } from './sections/features-sustainability'
import { FeaturesValuationSection } from './sections/features-valuation'
import { FeaturesDemonstrationsSection } from './sections/features-demonstrations'
import { FeaturesOpportunitiesSection } from './sections/features-opportunities'
import { FeaturesRankingSection } from './sections/features-ranking'
import { FeaturesComparisonSection } from './sections/features-comparison'
import { FeaturesScreeningSection } from './sections/features-screening'
import { FeaturesBacktestSection } from './sections/features-backtest'
import { FeaturesAISection } from './sections/features-ai'
import { FeaturesMonitoringSection } from './sections/features-monitoring'
import { FeaturesPortfolioSection } from './sections/features-portfolio'
import { SocialProofSection } from './sections/social-proof'
import { PricingSection } from './sections/pricing'
import { FaqSection } from './sections/faq'
import { CtaFinalSection } from './sections/cta-final'

interface ClubeDividendosLPProps {
  partnerId: string
  partnerCheckoutUrl: string
}

export function ClubeDividendosLP({ partnerId, partnerCheckoutUrl }: ClubeDividendosLPProps) {
  return (
    <>
      <JsonLd />
      <PartnerTracker partnerId={partnerId} />
      <LpHeader partnerCheckoutUrl={partnerCheckoutUrl} />

      <main className="overflow-x-hidden">
        <HeroSection />
        <FeaturesRadarSection />
        <FeaturesSustainabilitySection />
        <FeaturesValuationSection />
        <FeaturesDemonstrationsSection />
        <FeaturesOpportunitiesSection />
        <FeaturesRankingSection />
        <FeaturesComparisonSection />
        <FeaturesScreeningSection />
        <FeaturesBacktestSection />
        <FeaturesAISection />
        <FeaturesMonitoringSection />
        <FeaturesPortfolioSection />
        <SocialProofSection />
        <PricingSection partnerCheckoutUrl={partnerCheckoutUrl} />
        <FaqSection />
        <CtaFinalSection partnerCheckoutUrl={partnerCheckoutUrl} />
      </main>
    </>
  )
}
