import { Hero } from "@/components/landing/hero";
import { Stats } from "@/components/landing/stats";
import { Features } from "@/components/landing/features";
import { HowItWorks } from "@/components/landing/how-it-works";
import { RestoreMoment } from "@/components/landing/restore-moment";
import { InstallCta } from "@/components/landing/install-cta";
import { Resources } from "@/components/landing/resources";
import { Faq } from "@/components/landing/faq";
import { FinalCta } from "@/components/landing/final-cta";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Stats />
      <Features />
      <HowItWorks />
      <RestoreMoment />
      <InstallCta />
      <Resources />
      <Faq />
      <FinalCta />
    </>
  );
}
