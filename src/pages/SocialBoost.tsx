import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import SocialBoostPurchasePanel from "@/components/SocialBoostPurchasePanel";

export default function SocialBoost() {
  return (
    <main className="min-h-screen bg-[#061326] px-2 py-4 text-white sm:px-4">
      <div className="mx-auto max-w-[780px]">
        <Link to="/" className="mb-3 inline-flex items-center gap-2 px-2 text-sm font-semibold text-cyan-200 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <SocialBoostPurchasePanel walletBalance={0} />
      </div>
    </main>
  );
}
