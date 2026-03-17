import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import TrustTicker from "@/components/TrustTicker";
import ServicesSection from "@/components/ServicesSection";
import AgentSection from "@/components/AgentSection";
import Footer from "@/components/Footer";

const Index = () => {
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
