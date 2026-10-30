import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import NotificationPopup from "@/components/NotificationPopup";
import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import TrustTicker from "@/components/TrustTicker";
import ServicesSection from "@/components/ServicesSection";
import AgentSection from "@/components/AgentSection";
import Footer from "@/components/Footer";
import WhatsAppFloatingButton from "@/components/WhatsAppFloatingButton";
  import ChatBot from "@/components/ChatBot";
  import FreeDataPromoButton from "@/components/FreeDataPromoButton";
import PremiumSubscriptionBanner from "@/components/PremiumSubscriptionBanner";
import JsonLd from "@/components/JsonLd";

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
      <JsonLd data={(() => {
        const isJustBuy = /(^|\.)justbuygh\.com$/i.test(window.location.hostname);
        const origin = isJustBuy ? `https://${window.location.hostname}` : "https://dataplug.store";
        const name = isJustBuy ? "JustBuyGH" : "DataPlug Ghana";
        return [{"@context":"https://schema.org","@type":"Organization","name":name,"url":origin,"logo":`${origin}/icons/icon-512x512.png`,"areaServed":"GH","description":isJustBuy ? "Ghana's digital services hub for cheap data, airtime, bulk SMS, bills, subscriptions, games and social media boosts." : "Ghana's digital services marketplace for data, airtime, bills and subscriptions."},{"@context":"https://schema.org","@type":"WebSite","name":name,"url":origin,"inLanguage":"en-GH","potentialAction":{"@type":"SearchAction","target":`${origin}/packages?q={search_term_string}`,"query-input":"required name=search_term_string"}}];
      })()} />
      <NotificationPopup />
      <Navbar />
      <main id="main-content">
        <HeroSection />
        <TrustTicker />
        <ServicesSection />
        <section className="container max-w-5xl mx-auto px-4 py-8">
          <PremiumSubscriptionBanner />
        </section>
        <AgentSection />
      </main>
      <Footer />

      <WhatsAppFloatingButton />
      <FreeDataPromoButton />
  <ChatBot page="home" />
    </div>
  );
};

export default Index;
