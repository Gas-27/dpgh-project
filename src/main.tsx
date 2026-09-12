import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// After a new deployment, an old cached bundle can request chunk files that no
// longer exist, causing preload failures. Reload once (throttled) to fetch the
// fresh bundle so users don't see a blank page or have to refresh manually.
window.addEventListener("vite:preloadError", () => {
  const key = "chunk_reload_at";
  const last = Number(sessionStorage.getItem(key) || 0);
  if (Date.now() - last > 10000) {
    sessionStorage.setItem(key, String(Date.now()));
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
