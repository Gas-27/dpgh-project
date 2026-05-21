import { useState, useEffect } from "react";

export const WhatsAppFloatingButton = () => {
  const [showText, setShowText] = useState(true);

  useEffect(() => {
    // Hide the text after 6 seconds
    const timer = setTimeout(() => {
      setShowText(false);
    }, 6000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <a
      href="https://whatsapp.com/channel/0029VbCBiBmCsU9XSl2ozc3R"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        position: "fixed",
        bottom: "90px", // Positioned above PWA install prompt
        right: "20px",
        zIndex: 999,
        display: "flex",
        alignItems: "center",
        gap: showText ? "10px" : "0",
        backgroundColor: "#25D366",
        borderRadius: showText ? "30px" : "50%",
        padding: showText ? "10px 15px" : "12px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        cursor: "pointer",
        transition: "all 0.3s ease",
      }}
      onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
      onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
    >
      <img
        src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
        alt="Join WhatsApp Channel"
        style={{ width: "35px", height: "35px" }}
      />
      {showText && (
        <span
          style={{
            color: "white",
            fontWeight: "bold",
            fontSize: "14px",
            whiteSpace: "nowrap",
            animation: "fadeIn 0.3s ease",
          }}
        >
          Get updates & free giveaways
        </span>
      )}
    </a>
  );
};

export default WhatsAppFloatingButton;
