import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import TrustTicker from "@/components/TrustTicker";
import ServicesSection from "@/components/ServicesSection";
import AgentSection from "@/components/AgentSection";
import Footer from "@/components/Footer";

const Index = () => {
  const location = useLocation();

  useEffect(() => {
    if (!location.hash) return;

    const frame = requestAnimationFrame(() => {
      document.getElementById(location.hash.slice(1))?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [location.hash]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <TrustTicker />
      <ServicesSection />
      <AgentSection />
      <Footer />
    </div>
  );
};

export default Index;
