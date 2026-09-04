import { useState, useCallback, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { DOMAINS } from "@/config/domains";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Store, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Helper: convert store name to a URL‑safe slug (subdomain)
const slugify = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const AgentOnboarding = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isCheckingName, setIsCheckingName] = useState(false);
  const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);

  const [storeName, setStoreName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [supportNumber, setSupportNumber] = useState("");
  const [whatsappGroup, setWhatsappGroup] = useState("");
  const [momoNumber, setMomoNumber] = useState("");
  const [momoName, setMomoName] = useState("");
  const [momoNetwork, setMomoNetwork] = useState("");

  // Check if store name (or its slug) is already taken – direct query (no RPC needed)
  const checkStoreNameExists = useCallback(async (name: string) => {
    if (!name.trim()) {
      setNameAvailable(null);
      return;
    }

    setIsCheckingName(true);
    const trimmedName = name.trim();
    const slug = slugify(trimmedName);

    try {
      // Fetch ALL store names (including pending) – requires a policy that allows this
      // If RLS blocks, we'll need to adjust. For now we rely on the default policy that allows reading store names.
      const { data, error } = await supabase
        .from("agent_stores")
        .select("store_name")
        .limit(1000); // get up to 1000 stores – enough for uniqueness check

      if (error) {
        console.error("Error fetching stores:", error);
        toast({
          title: "Error",
          description: "Could not verify store name. Please try again.",
          variant: "destructive",
        });
        setNameAvailable(null);
        return;
      }

      // Check for exact match (case-insensitive) OR slug match
      const exists = data?.some(store => {
        const existingSlug = slugify(store.store_name);
        return store.store_name.toLowerCase() === trimmedName.toLowerCase() || existingSlug === slug;
      });

      setNameAvailable(!exists);
    } catch (err) {
      console.error("Unexpected error during name check:", err);
      toast({
        title: "Error",
        description: "Network error. Please check your connection and try again.",
        variant: "destructive",
      });
      setNameAvailable(null);
    } finally {
      setIsCheckingName(false);
    }
  }, [toast]);

  // Debounced check when user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (storeName.trim()) {
        checkStoreNameExists(storeName);
      } else {
        setNameAvailable(null);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [storeName, checkStoreNameExists]);

  const handleStoreNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setStoreName(e.target.value);
    if (nameAvailable !== null) setNameAvailable(null);
  };

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

    // Final verification before insert
    if (nameAvailable !== true) {
      if (nameAvailable === null) {
        await checkStoreNameExists(storeName);
        if (nameAvailable !== true) {
          toast({
            title: "Store name unavailable",
            description: "This store name (or a very similar one) is already taken. Please choose a different name.",
            variant: "destructive",
          });
          return;
        }
      } else {
        toast({
          title: "Store name taken",
          description: "This store name cannot be used. Please choose another.",
          variant: "destructive",
        });
        return;
      }
    }

    setLoading(true);

    const { error } = await supabase.from("agent_stores").insert({
      user_id: user.id,
      store_name: storeName.trim(),
      whatsapp_number: whatsappNumber.trim(),
      support_number: supportNumber.trim(),
      whatsapp_group: whatsappGroup.trim() || null,
      momo_number: momoNumber.trim(),
      momo_name: momoName.trim(),
      momo_network: momoNetwork,
    });

    setLoading(false);

    if (error) {
      if (error.code === "23505") {
        toast({
          title: "Store name already exists",
          description: "This store name (or a similar slug) is already taken. Please choose a different name.",
          variant: "destructive",
        });
        checkStoreNameExists(storeName);
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    } else {
      toast({ title: "Store created!", description: "Your account is pending admin approval." });
      navigate("/pending-approval");
    }
  };

  // Compute the proposed subdomain for display
  const proposedSlug = storeName.trim() ? slugify(storeName) : "";
  const storeLink = proposedSlug ? DOMAINS.getAgentStoreUrl(storeName) : "";

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
              <div className="relative">
                <Input
                  value={storeName}
                  onChange={handleStoreNameChange}
                  placeholder="e.g. DataKing GH"
                  required
                  className={nameAvailable === false ? "border-red-500 pr-10" : nameAvailable === true ? "border-green-500 pr-10" : ""}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isCheckingName && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {!isCheckingName && nameAvailable === true && <CheckCircle className="h-4 w-4 text-green-500" />}
                  {!isCheckingName && nameAvailable === false && <AlertCircle className="h-4 w-4 text-red-500" />}
                </div>
              </div>
              {nameAvailable === false && (
                <p className="text-xs text-red-500">
                  This store name (or a very similar one) is already taken (even by pending stores).
                  Your store link would be <span className="font-mono">{storeLink}</span> – please choose a different name.
                </p>
              )}
              {nameAvailable === true && storeName.trim() && (
                <p className="text-xs text-green-500">
                  Available! Your store will be at: <span className="font-mono">{storeLink}</span>
                </p>
              )}
              {!isCheckingName && nameAvailable === null && storeName.trim() && (
                <p className="text-xs text-muted-foreground">
                  Once approved, your store will be live at: <span className="font-mono">{storeLink}</span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>WhatsApp Number</Label>
                <Input
                  value={whatsappNumber}
                  onChange={(e) => setWhatsappNumber(e.target.value)}
                  placeholder="0241234567"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Support Number</Label>
                <Input
                  value={supportNumber}
                  onChange={(e) => setSupportNumber(e.target.value)}
                  placeholder="0201234567"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>WhatsApp Group Link (Optional)</Label>
              <Input
                value={whatsappGroup}
                onChange={(e) => setWhatsappGroup(e.target.value)}
                placeholder="https://chat.whatsapp.com/..."
              />
            </div>

            <div className="border-t border-border pt-4 mt-4">
              <p className="text-sm font-semibold text-foreground mb-3">MoMo Withdrawal Details</p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>MoMo Name</Label>
                  <Input
                    value={momoName}
                    onChange={(e) => setMomoName(e.target.value)}
                    placeholder="Full name on MoMo"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>MoMo Number</Label>
                    <Input
                      value={momoNumber}
                      onChange={(e) => setMomoNumber(e.target.value)}
                      placeholder="0241234567"
                      required
                    />
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

            <Button
              type="submit"
              variant="hero"
              className="w-full"
              disabled={loading || isCheckingName || nameAvailable !== true}
            >
              {loading ? "Submitting..." : "Submit for Approval"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AgentOnboarding;
