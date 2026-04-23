// import { Zap, Clock } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { Card, CardContent } from "@/components/ui/card";
// import { Link } from "react-router-dom";

// const PendingApproval = () => {
//   return (
//     <div className="min-h-screen bg-background flex items-center justify-center p-4">
//       <Card className="w-full max-w-md border-border text-center">
//         <CardContent className="p-8 space-y-6">
//           <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
//             <Clock className="h-10 w-10 text-primary" />
//           </div>
//           <div>
//             <h1 className="font-display text-2xl font-bold mb-2">Pending Approval</h1>
//             <p className="text-muted-foreground">
//               Your agent account is being reviewed by our team. You'll be notified once your store is approved.
//             </p>
//           </div>
//           <Button variant="outline" asChild>
//             <Link to="/">Back to Home</Link>
//           </Button>
//         </CardContent>
//       </Card>
//     </div>
//   );
// };

// export default PendingApproval;




















import { Zap, Clock, CreditCard, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { useState } from "react";

const PendingApproval = () => {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    navigator.clipboard.writeText("0599449202");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border">
        <CardContent className="p-8 space-y-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Clock className="h-10 w-10 text-primary" />
          </div>

          <div className="text-center">
            <h1 className="font-display text-2xl font-bold mb-2">Pending Approval</h1>
            <p className="text-muted-foreground">
              Pay to get your own site to sell data and also you get to customize your agent store with a colurs and design of your choice .Plus you also get cheaper prices as well.
            </p>
          </div>

          {/* Payment Instructions */}
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
                <AlertCircle className="h-5 w-5" />
                <span className="text-sm font-semibold">Payment Required for Approval</span>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  To complete your store approval, please make a payment of:
                </p>
                <div className="text-center">
                  <span className="text-3xl font-bold text-primary">GHC 25.00</span>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Send payment via Mobile Money to:
                </p>
                <div className="flex items-center justify-between bg-background rounded-lg p-3 border">
                  <div>
                    <p className="font-mono font-medium">0599449202</p>
                    <p className="text-xs text-muted-foreground">MTN Mobile Money</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyToClipboard}
                    className="shrink-0"
                  >
                    {copied ? "Copied!" : "Copy"}
                  </Button>
                </div>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
                <p className="text-xs text-amber-800 dark:text-amber-400 font-medium mb-1">
                  ⚠️ Important:
                </p>
                <p className="text-xs text-amber-700 dark:text-amber-500">
                  Use your <span className="font-bold">store name</span> as the payment reference.
                  Failure to include your store name will result in your store not being approved.
                </p>
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <p className="text-xs text-green-800 dark:text-green-400">
                ✅ After payment, your store will be  approved within 1 hour.
                After payment send a screenshot of payment to 0200511211 on whats app.Please tap on the return to Home button once store is approved  then tap on menu you will see dashboard then tap on it.
              </p>
            </div>
          </div>

          <Button variant="outline" asChild className="w-full">
            <Link to="/">Back to Home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApproval;