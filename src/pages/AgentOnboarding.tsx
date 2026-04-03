import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PaymentModal } from "@/components/PaymentModal";

const AgentOnboarding = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  const [storeName, setStoreName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [supportNumber, setSupportNumber] = useState("");
  const [whatsappGroup, setWhatsappGroup] = useState("");
  const [momoNumber, setMomoNumber] = useState("");
  const [momoName, setMomoName] = useState("");
  const [momoNetwork, setMomoNetwork] = useState("");

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-primary font-display text-xl">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Prepare store data for payment metadata
    const storeData = {
      store_name: storeName,
      whatsapp_number: whatsappNumber,
      support_number: supportNumber,
      whatsapp_group: whatsappGroup || null,
      momo_number: momoNumber,
      momo_name: momoName,
      momo_network: momoNetwork,
    };

    // Store in session storage as backup
    sessionStorage.setItem("pending_registration_store_data", JSON.stringify(storeData));

    // Show payment modal
    setShowPaymentModal(true);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-lg border-border">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Store className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="font-display">Set Up Your Store</CardTitle>
          <CardDescription>Fill in your store details to get started as an agent</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Store Name</Label>
              <Input value={storeName} onChange={(e) => setStoreName(e.target.value)} placeholder="e.g. DataKing GH" required />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>WhatsApp Number</Label>
                <Input value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="0241234567" required />
              </div>
              <div className="space-y-2">
                <Label>Support Number</Label>
                <Input value={supportNumber} onChange={(e) => setSupportNumber(e.target.value)} placeholder="0201234567" required />
              </div>
            </div>

            <div className="space-y-2">
              <Label>WhatsApp Group Link (Optional)</Label>
              <Input value={whatsappGroup} onChange={(e) => setWhatsappGroup(e.target.value)} placeholder="https://chat.whatsapp.com/..." />
            </div>

            <div className="border-t border-border pt-4 mt-4">
              <p className="text-sm font-semibold text-foreground mb-3">MoMo Withdrawal Details</p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>MoMo Name</Label>
                  <Input value={momoName} onChange={(e) => setMomoName(e.target.value)} placeholder="Full name on MoMo" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>MoMo Number</Label>
                    <Input value={momoNumber} onChange={(e) => setMomoNumber(e.target.value)} placeholder="0241234567" required />
                  </div>
                  <div className="space-y-2">
                    <Label>MoMo Network</Label>
                    <Select value={momoNetwork} onValueChange={setMomoNetwork} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mtn">MTN</SelectItem>
                        <SelectItem value="airteltigo">AirtelTigo</SelectItem>
                        <SelectItem value="telecel">Telecel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>

            <Button type="submit" variant="hero" className="w-full" disabled={!momoNetwork}>
              Continue to Payment
            </Button>
          </form>
        </CardContent>
      </Card>

      <PaymentModal
        open={showPaymentModal}
        onOpenChange={setShowPaymentModal}
        userId={user.id}
        email={user.email!}
        phone={momoNumber}
        storeData={{
          store_name: storeName,
          whatsapp_number: whatsappNumber,
          support_number: supportNumber,
          whatsapp_group: whatsappGroup || null,
          momo_number: momoNumber,
          momo_name: momoName,
          momo_network: momoNetwork,
        }}
      />
    </div>
  );
};

export default AgentOnboarding;
