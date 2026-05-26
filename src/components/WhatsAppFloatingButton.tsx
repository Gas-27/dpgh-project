import { useState, useEffect } from "react";
import DraggableFAB from "./DraggableFAB";

export const WhatsAppFloatingButton = () => {
  const [showText, setShowText] = useState(true);

  useEffect(() => {
    // Hide the text after 6 seconds
    const timer = setTimeout(() => {
      setShowText(false);
    }, 6000);

    return () => clearTimeout(timer);
  }, []);

  const handleClick = () => {
    window.open("https://whatsapp.com/channel/0029VbCBiBmCsU9XSl2ozc3R", "_blank");
  };

  return (
    <DraggableFAB
      initialBottom={90}
      initialRight={20}
      storageKey="whatsapp"
      onClick={handleClick}
      title="Join WhatsApp Channel"
    >
      <div
        className="flex items-center rounded-full shadow-lg transition-all duration-300 hover:scale-105"
        style={{
          gap: showText ? "10px" : "0",
          backgroundColor: "#25D366",
          borderRadius: showText ? "30px" : "50%",
          padding: showText ? "10px 15px" : "12px",
        }}
      >
        <img
          src="https://upload.wikimedia.org/wikipedia/commons/6/6b/WhatsApp.svg"
          alt="Join WhatsApp Channel"
          style={{ width: "35px", height: "35px" }}
          draggable={false}
        />
        {showText && (
          <span
            style={{
              color: "white",
              fontWeight: "bold",
              fontSize: "14px",
              whiteSpace: "nowrap",
            }}
          >
            Get updates & free giveaways
          </span>
        )}
      </div>
    </DraggableFAB>
  );
};

export default WhatsAppFloatingButton;
