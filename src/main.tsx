import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { isChunkLoadError, recoverFromStaleBundle } from "@/lib/chunkRecovery";

// After a new deployment, an old cached bundle can request chunk files that no
// longer exist. Safari reports this as "Importing a module script failed.".
// Clear the stale service worker/caches and reload once (throttled) so users
// get the fresh bundle instead of an error screen.
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  void recoverFromStaleBundle();
});

window.addEventListener("unhandledrejection", (event) => {
  if (isChunkLoadError(event.reason)) void recoverFromStaleBundle();
});

createRoot(document.getElementById("root")!).render(<App />);
