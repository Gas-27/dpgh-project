import { useState, useCallback, useEffect, useRef } from "react";
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
import { isValidStoreName, sanitizeStoreName, STORE_NAME_RULE } from "@/utils/storeUtils";
import { isStoreUrlAvailable, suggestAvailableStoreNames, storeNameToSlug } from "@/utils/storeNameAvailability";

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

  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const latestCheckId = useRef(0);

  // Asks the database whether this exact store URL is free. Returns true/false, or null if the check failed.
  const checkStoreNameExists = useCallback(async (name: string): Promise<boolean | null> => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameAvailable(null);
      setSuggestions([]);
      return null;
    }

    const checkId = ++latestCheckId.current;
    setIsCheckingName(true);

    try {
      const available = await isStoreUrlAvailable(trimmedName);
      if (checkId !== latestCheckId.current) return null; // a newer name was typed meanwhile

      setNameAvailable(available);
      if (available) {
        setSuggestions([]);
      } else {
        setIsLoadingSuggestions(true);
        const names = await suggestAvailableStoreNames(trimmedName).catch(() => []);
        if (checkId === latestCheckId.current) setSuggestions(names);
        setIsLoadingSuggestions(false);
      }
      return available;
    } catch (err) {
      console.error("Store name check failed:", err);
      if (checkId === latestCheckId.current) {
        setNameAvailable(null);
        toast({
          title: "Could not check the store link",
          description: "Please check your connection and try again.",
          variant: "destructive",
        });
      }
      return null;
    } finally {
      if (checkId === latestCheckId.current) setIsCheckingName(false);
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
    const safeName = sanitizeStoreName(e.target.value);
    setStoreName(safeName);
    if (safeName !== e.target.value) {
      toast({ title: "Invalid store name", description: STORE_NAME_RULE, variant: "destructive" });
    }
    if (nameAvailable !== null) setNameAvailable(null);
    if (suggestions.length > 0) setSuggestions([]);
  };

  const applySuggestedName = (name: string) => {
    setStoreName(name);
    setSuggestions([]);
    setNameAvailable(null);
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

    const normalizedStoreName = sanitizeStoreName(storeName);
  setStoreName(normalizedStoreName);
  if (!isValidStoreName(normalizedStoreName)) {
      toast({ title: "Invalid store name", description: STORE_NAME_RULE, variant: "destructive" });
      return;
    }

    // Always re-check the exact store URL right before inserting
    const available = await checkStoreNameExists(normalizedStoreName);
    if (available !== true) {
      if (available === false) {
        toast({
          title: "Store link already taken",
          description: "Pick one of the suggested names below the store name, or type a different one.",
          variant: "destructive",
        });
      }
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("agent_stores").insert({
      user_id: user.id,
      store_name: normalizedStoreName,
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
          title: "Store link already taken",
          description: "Someone just took this store link. Pick one of the suggested names below.",
          variant: "destructive",
        });
        checkStoreNameExists(normalizedStoreName);
      } else {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    } else {
      toast({ title: "Store created!", description: "Your account is pending admin approval." });
      navigate("/pending-approval");
    }
  };

  // Compute the proposed subdomain for display
  const proposedSlug = storeName.trim() ? storeNameToSlug(storeName) : "";
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
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-left text-sm text-muted-foreground">
            After you submit, you will pay the <span className="font-semibold text-foreground">one-time agent fee</span> directly through Paystack to get your store approved. Only continue if you are ready to pay now.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Store Name</Label>
              <p className="text-xs text-muted-foreground">{STORE_NAME_RULE} Use the normal default text style; decorative or stylized characters are not supported.</p>
              <div className="relative">
                <Input
                  value={storeName}
                  onChange={handleStoreNameChange}
                  placeholder="e.g. DataKing GH"
                  required
                  pattern="[A-Za-z0-9 ]+"
                  title={STORE_NAME_RULE}
                  className={`font-sans ${nameAvailable === false ? "border-red-500 pr-10" : nameAvailable === true ? "border-green-500 pr-10" : ""}`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isCheckingName && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  {!isCheckingName && nameAvailable === true && <CheckCircle className="h-4 w-4 text-green-500" />}
                  {!isCheckingName && nameAvailable === false && <AlertCircle className="h-4 w-4 text-red-500" />}
                </div>
              </div>
              {nameAvailable === false && (
                <div className="space-y-2">
                  <p className="text-xs text-red-500">
                    This store link is already in use: <span className="font-mono">{storeLink}</span>. Choose another name.
                  </p>
                  <div aria-live="polite">
                    {isLoadingSuggestions && (
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" /> Finding available names...
                      </p>
                    )}
                    {!isLoadingSuggestions && suggestions.length > 0 && (
                      <div className="space-y-1.5">
                        <p className="text-xs font-medium text-foreground">Available names you can use:</p>
                        <div className="flex flex-wrap gap-2">
                          {suggestions.map((name) => (
                            <button
                              key={name}
                              type="button"
                              onClick={() => applySuggestedName(name)}
                              className="rounded-full border border-green-500/40 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-600 transition-colors hover:bg-green-500/20 dark:text-green-400"
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
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
              disabled={loading || isCheckingName || nameAvailable !== true || !isValidStoreName(storeName)}
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
