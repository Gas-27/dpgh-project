import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import NotificationPopup from "@/components/NotificationPopup";
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
      <NotificationPopup />
      <Navbar />
      <HeroSection />
      <TrustTicker />
      <ServicesSection />
      <AgentSection />
      <Footer />

      {/* Floating WhatsApp Button */}
      <a
        href="https://whatsapp.com/channel/0029Vb6Yd9ALo4hZ2ikWCV1z"
        target="_blank"
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          zIndex: 1000,
          display: "flex",
          alignItems: "center",
          gap: "10px",          // space between icon and text
          backgroundColor: "#25D366",
          borderRadius: "30px", // rounded pill shape for icon + text
          padding: "10px 15px",
          boxShadow: "0 4px 6px rgba(0,0,0,0.3)",
          cursor: "pointer",
          transition: "transform 0.2s",
        }}
        onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
        onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
          alt="Join WhatsApp Channel"
          style={{ width: "35px", height: "35px" }}
        />
        <span
          style={{
            color: "white",
            fontWeight: "bold",
            fontSize: "14px",
            whiteSpace: "nowrap",
          }}
        >
          Join channel – get updates & free giveaways
        </span>
      </a>
    </div>
  );
};

export default Index;
