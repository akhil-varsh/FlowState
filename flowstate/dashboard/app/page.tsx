import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Features from "@/components/landing/Features";
import HowItWorks from "@/components/landing/HowItWorks";
import Privacy from "@/components/landing/Privacy";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";

export default function LandingPage() {
  return (
    <main className="relative min-h-screen bg-ink-950">
      <Navbar />
      <Hero />
      <Features />
      <HowItWorks />
      <Privacy />
      <CTA />
      <Footer />
    </main>
  );
}
