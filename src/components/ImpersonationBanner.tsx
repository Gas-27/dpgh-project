import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { IMPERSONATING_FLAG } from "@/lib/adminImpersonate";

const readFlag = () =>
  typeof window !== "undefined" && sessionStorage.getItem(IMPERSONATING_FLAG) === "1";

const ImpersonationBanner = () => {
  const location = useLocation();
  const [active, setActive] = useState(readFlag);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    setActive(readFlag());
  }, [location.pathname]);

  if (!active || location.pathname === "/impersonate") return null;

  const handleExit = async () => {
    setExiting(true);
    await supabase.auth.signOut({ scope: "local" });
    sessionStorage.removeItem(IMPERSONATING_FLAG);
    setActive(false);
    window.close();
    // window.close() is ignored for tabs the script did not open.
    window.setTimeout(() => {
      window.location.href = "/";
    }, 300);
  };

  return (
    <>
      <style>{`
        .sticky.top-0, .fixed.top-0 { top: 2.5rem; }
      `}</style>
      <div
        role="alert"
        className="sticky top-0 z-[100] flex h-10 items-center justify-between gap-3 bg-red-600 px-4 text-white shadow-md"
      >
        <div className="flex min-w-0 items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden="true" />
          <p className="truncate text-sm font-semibold">Admin view — you are signed in as this store</p>
        </div>
        <button
          type="button"
          onClick={handleExit}
          disabled={exiting}
          className="shrink-0 rounded-md border border-white/70 px-3 py-1 text-xs font-semibold hover:bg-white/15 disabled:opacity-60"
        >
          {exiting ? "Exiting…" : "Exit"}
        </button>
      </div>
    </>
  );
};

export default ImpersonationBanner;
