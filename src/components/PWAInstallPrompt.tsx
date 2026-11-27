import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { X, Share } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const SESSION_DISMISS_KEY = "pwa-banner-dismissed";

const isStandaloneMode = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.matchMedia("(display-mode: fullscreen)").matches ||
  window.matchMedia("(display-mode: minimal-ui)").matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(() => isStandaloneMode());
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  const [showHelp, setShowHelp] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as unknown as { MSStream?: unknown }).MSStream;
  const isJustBuy = ["justbuygh.com", "www.justbuygh.com"].includes(window.location.hostname.toLowerCase());
  const icon = isJustBuy ? "/justbuygh-icon.png" : "/icons/icon-192x192.png";

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };
    const mq = window.matchMedia("(display-mode: standalone)");
    const onModeChange = () => setInstalled(isStandaloneMode());

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    mq.addEventListener?.("change", onModeChange);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      mq.removeEventListener?.("change", onModeChange);
    };
  }, []);

  const visible = !installed && !dismissed;

  // Fixed/sticky headers are shifted below the banner via the CSS in index.css.
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (!visible || !barRef.current) {
      root.classList.remove("has-pwa-banner");
      root.style.removeProperty("--pwa-banner-h");
      return;
    }
    const el = barRef.current;
    const update = () => root.style.setProperty("--pwa-banner-h", `${el.offsetHeight}px`);
    root.classList.add("has-pwa-banner");
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => {
      observer.disconnect();
      root.classList.remove("has-pwa-banner");
      root.style.removeProperty("--pwa-banner-h");
    };
  }, [visible, showHelp]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setInstalled(true);
      setDeferredPrompt(null);
      return;
    }
    setShowHelp((v) => !v);
  };

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(SESSION_DISMISS_KEY, "1");
    } catch {
      // storage unavailable; banner returns on next load
    }
  };

  if (!visible) return null;

  return (
    <div
      ref={barRef}
      data-pwa-banner
      className="sticky top-0 z-[60] border-b border-white/10 bg-[#0d0d10] px-3 py-2.5 text-white shadow-lg"
      style={{ paddingTop: "max(0.625rem, env(safe-area-inset-top))" }}
    >
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <img src={icon} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-tight">Download the App Version</p>
          <p className="truncate text-xs text-zinc-400">Faster access &amp; instant 1-tap orders</p>
        </div>
        <button
          type="button"
          onClick={handleInstall}
          className="shrink-0 rounded-full border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm font-bold text-amber-400 transition-colors hover:bg-amber-500/20"
        >
          Install
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss install banner"
          className="-mr-1 shrink-0 rounded-full p-2 text-zinc-400 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      {showHelp && (
        <p className="mx-auto mt-2 flex max-w-3xl flex-wrap items-center gap-1.5 text-xs text-zinc-300">
          {isIOS ? (
            <>
              Tap <Share className="inline h-4 w-4 text-amber-400" aria-hidden="true" /> Share, then choose &quot;Add to Home Screen&quot;.
            </>
          ) : (
            <>Open your browser menu and choose &quot;Install app&quot; or &quot;Add to Home screen&quot;.</>
          )}
        </p>
      )}
    </div>
  );
}
