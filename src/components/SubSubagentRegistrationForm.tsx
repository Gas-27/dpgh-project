import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { DOMAINS } from "@/config/domains";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SubSubagentRegistrationFormProps {
  subagentStoreId: string;
  subagentStoreName: string;
  primaryColor: string;
  primaryForeground: string;
  onClose?: () => void;
}

export default function SubSubagentRegistrationForm({
  subagentStoreId,
  subagentStoreName,
  primaryColor = "#06b6d4",
  primaryForeground = "#0f172a",
  onClose,
}: SubSubagentRegistrationFormProps) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [fetchingStore, setFetchingStore] = useState(true);
  const [storeNameError, setStoreNameError] = useState("");
  const [checkingStoreName, setCheckingStoreName] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [subagentStore, setSubagentStore] = useState<any>(null);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    storeName: "",
    supportNumber: "",
    whatsappNumber: "",
    momoName: "",
    momoNumber: "",
    momoNetwork: "mtn",
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
    
    // Clear error when user starts typing again
    if (id === "storeName") {
      setStoreNameError("");
    }
  };

  // Check if store name is available on blur
  const checkStoreNameAvailability = async () => {
    if (!formData.storeName.trim()) return;
    
    setCheckingStoreName(true);
    try {
      const { data: existingStores, error } = await supabase
        .from("subagent_stores")
        .select("store_name")
        .ilike("store_name", `%${formData.storeName}%`);

      if (!error && existingStores && existingStores.length > 0) {
        const isDuplicate = existingStores.some((store: any) => 
          store.store_name.toLowerCase().trim() === formData.storeName.toLowerCase().trim()
        );
        
        if (isDuplicate) {
          setStoreNameError(`Store name "${formData.storeName}" is already taken. Please choose a different name.`);
        } else {
          setStoreNameError("");
        }
      } else {
        setStoreNameError("");
      }
    } catch (error) {
      console.error("[v0] Error checking store name:", error);
      setStoreNameError("");
    }
    setCheckingStoreName(false);
  };

  const handleSelectChange = (value: string) => {
    setFormData(prev => ({ ...prev, momoNetwork: value }));
  };

  // Fetch agent store data to check if fees are enabled
  useEffect(() => {
    const fetchSubagentStore = async () => {
      try {
        const { data, error } = await supabase
          .from("subagent_stores")
          .select("*")
          .eq("id", subagentStoreId)
          .single();

        if (error) throw error;
        setSubagentStore(data);
      } catch (error) {
        console.error("[v0] Error fetching subagent store:", error);
      } finally {
        setFetchingStore(false);
      }
    };

    if (subagentStoreId) {
      fetchSubagentStore();
    }
  }, [subagentStoreId]);

  const validateForm = async () => {
    if (!formData.email || !formData.password || !formData.storeName || 
        !formData.supportNumber || !formData.whatsappNumber || 
        !formData.momoName || !formData.momoNumber) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return false;
    }

    if (formData.email.length < 5 || !formData.email.includes("@")) {
      toast({
        title: "Error",
        description: "Please enter a valid email",
        variant: "destructive",
      });
      return false;
    }

    if (formData.password.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return false;
    }

    // Check if store name is already taken
    const { data: existingStores, error: checkError } = await supabase
      .from("subagent_stores")
      .select("store_name")
      .ilike("store_name", `%${formData.storeName}%`);

    if (!checkError && existingStores && existingStores.length > 0) {
      // Check for exact match (case-insensitive)
      const isDuplicate = existingStores.some((store: any) => 
        store.store_name.toLowerCase().trim() === formData.storeName.toLowerCase().trim()
      );
      
      if (isDuplicate) {
        toast({
          title: "Store Name Taken",
          description: `The store name "${formData.storeName}" is already taken. Please choose a different name.`,
          variant: "destructive",
        });
        return false;
      }
    }

    return true;
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!(await validateForm())) return;

    try {
      setLoading(true);

      // Sign up the user.
      // NOTE: "sub_subagent" is NOT in the app_role enum so passing it as role
      // in metadata causes the handle_new_user trigger to fail with a 500.
      // We pass "user" (a valid enum value) and rely on sub_subagent_stores
      // membership to identify this user as a sub-subagent.
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            role: "user",
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user?.id) throw new Error("Failed to create user account");

      // user_roles also uses the app_role enum — skip inserting "sub_subagent"
      // (not a valid enum value). Role is determined by sub_subagent_stores membership.

      // Generate a sequential top-up reference (used as the USSD access code).
      // Sub-subagents use the "Agt" prefix followed by their creation number.
      const { count: subSubagentCount } = await supabase
        .from("sub_subagent_stores")
        .select("*", { count: "exact", head: true });
      const topupReference = `Agt${(subSubagentCount || 0) + 1}`;

      // A DB trigger on auth.users may auto-create a skeleton row in
      // sub_subagent_stores the moment signUp completes. Strategy:
      //  1. Try a clean INSERT.
      //  2. If it returns 409 / 23505 (unique violation on user_id), the
      //     trigger-created row already exists — UPDATE it instead.
      //  3. Look up the id by user_id so we always have it.
      // topup_reference is set in a separate UPDATE to bypass the broken
      // BEFORE INSERT trigger that references NEW.top_reference.
      const storeFields = {
        subagent_store_id: subagentStoreId,
        store_name: formData.storeName,
        whatsapp_number: formData.whatsappNumber || null,
        support_number: formData.supportNumber || null,
        whatsapp_group: null,
        momo_name: formData.momoName || null,
        momo_number: formData.momoNumber || null,
        momo_network: formData.momoNetwork || null,
        wallet_balance: 0,
        approved: true,
      };

      let storeId: string | null = null;

      // Step 1: attempt INSERT
      const { data: insertedStore, error: insertError } = await supabase
        .from("sub_subagent_stores")
        .insert({ ...storeFields, user_id: authData.user.id })
        .select("id")
        .maybeSingle();

      const isConflictErr = (e: any) =>
        e?.code === "23505" || e?.status === 409 ||
        (e?.message || "").includes("duplicate") ||
        (e?.message || "").includes("unique");

      if (insertError && !isConflictErr(insertError)) {
        throw insertError;
      }

      if (insertedStore?.id) {
        storeId = insertedStore.id;
      } else {
        // Step 2: row already exists (trigger-created) — UPDATE it
        const { error: updateError } = await supabase
          .from("sub_subagent_stores")
          .update(storeFields)
          .eq("user_id", authData.user.id);
        if (updateError) throw updateError;

        // Step 3: fetch the id
        const { data: found } = await supabase
          .from("sub_subagent_stores")
          .select("id")
          .eq("user_id", authData.user.id)
          .maybeSingle();
        storeId = found?.id ?? null;
      }

      // Set topup_reference via update to bypass the broken BEFORE INSERT trigger
      if (storeId) {
        await supabase
          .from("sub_subagent_stores")
          .update({ topup_reference: topupReference })
          .eq("id", storeId);
      }

      // Auto sign-in the newly created user
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) {
        // Still redirect even if auto-signin fails - user can sign in manually
      }

      // Final guaranteed storeId lookup — ensures we never redirect with store_id=null
      if (!storeId) {
        const { data: finalLookup } = await supabase
          .from("sub_subagent_stores")
          .select("id")
          .eq("user_id", authData.user.id)
          .maybeSingle();
        storeId = finalLookup?.id ?? null;
      }

      // Sub-subagents don't need payment, so skip to dashboard
      toast({
        title: "Success!",
        description: "Your sub-subagent account has been created. Redirecting to your dashboard...",
        duration: 3000,
      });

      // Use window.location.href to do a full page reload so the page loads with
      // session already established and roles already cached from database
      setTimeout(() => {
        if (storeId) {
          // Always use the full agentsstore.shop URL so the redirect works whether
          // the form is shown on dataplug.store or agentsstore.shop
          window.location.href = `https://agentsstore.shop/sub-subagent-dashboard?store_id=${storeId}`;
        } else {
          // storeId still null — send to the sub-subagent login page where the
          // user can sign in and be routed to their dashboard automatically
          window.location.href = `https://agentsstore.shop/sub-subagent-login`;
        }
      }, 500);
    } catch (error: any) {
      const isUserAlreadyExists = error?.status === 422 || error?.message?.toLowerCase().includes("already registered") || error?.message?.toLowerCase().includes("already been registered");
      const isTriggerError = error?.message?.includes("top_reference") || error?.message?.includes("record \"new\"");
      const isConflict = error?.code === "23505" || error?.status === 409;
      toast({
        title: "Registration Failed",
        description: isUserAlreadyExists
          ? "This email is already registered. Please use a different email address."
          : isConflict
            ? "An account already exists with these details. Please try signing in instead."
            : isTriggerError
              ? "There was a database issue. Please try again or contact support."
              : error.message || "Failed to create account",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border bg-card/50">
      <CardContent className="p-6 md:p-8 space-y-6">
        {/* Info Alert */}
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-green-400 mb-1">No Registration Fee</p>
              <p className="text-sm text-muted-foreground">
                Your agent account will be created instantly with no registration fee. Start selling immediately after sign up!
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              className="bg-background border-border"
              value={formData.email}
              onChange={handleInputChange}
              disabled={loading || fetchingStore}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a strong password (min 6 characters)"
                className="bg-background border-border pr-10"
                value={formData.password}
                onChange={handleInputChange}
                disabled={loading || fetchingStore}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                disabled={loading || fetchingStore}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="storeName">Store Name</Label>
            <Input
              id="storeName"
              placeholder="Your Store Name"
              className={`bg-background border-border ${storeNameError ? 'border-red-500' : ''}`}
              value={formData.storeName}
              onChange={handleInputChange}
              onBlur={checkStoreNameAvailability}
              disabled={loading || checkingStoreName || fetchingStore}
            />
            {storeNameError && (
              <p className="text-sm text-red-500">{storeNameError}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="supportNumber">Support Number</Label>
              <Input
                id="supportNumber"
                type="tel"
                placeholder="0XX XXX XXXX"
                className="bg-background border-border"
                value={formData.supportNumber}
                onChange={handleInputChange}
                disabled={loading || fetchingStore}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsappNumber">WhatsApp Number</Label>
              <Input
                id="whatsappNumber"
                type="tel"
                placeholder="0XX XXX XXXX"
                className="bg-background border-border"
                value={formData.whatsappNumber}
                onChange={handleInputChange}
                disabled={loading || fetchingStore}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="momoName">MoMo Account Name</Label>
              <Input
                id="momoName"
                placeholder="Account holder name"
                className="bg-background border-border"
                value={formData.momoName}
                onChange={handleInputChange}
                disabled={loading || fetchingStore}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="momoNumber">MoMo Number</Label>
              <Input
                id="momoNumber"
                type="tel"
                placeholder="0XX XXX XXXX"
                className="bg-background border-border"
                value={formData.momoNumber}
                onChange={handleInputChange}
                disabled={loading || fetchingStore}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="momoNetwork">MoMo Network</Label>
            <Select value={formData.momoNetwork} onValueChange={handleSelectChange} disabled={loading}>
              <SelectTrigger id="momoNetwork" className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mtn">MTN</SelectItem>
                <SelectItem value="airteltigo">AirtelTigo</SelectItem>
                <SelectItem value="telecel">Telecel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button
            type="submit"
            className="w-full text-lg h-12 font-semibold"
            style={{
              background: primaryColor,
              color: primaryForeground,
            }}
            disabled={loading || checkingStoreName || !!storeNameError || fetchingStore}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Creating Account...
              </>
            ) : (
              "Create Agent Account"
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            By signing up, you agree to become an agent under {subagentStoreName} and follow our terms and conditions.
          </p>

          <div className="text-center pt-4 border-t border-border">
            <p className="text-sm text-muted-foreground">
              Already an agent?{" "}
              <a 
                href="https://agentsstore.shop/login" 
                className="font-semibold hover:underline"
                style={{ color: primaryColor }}
              >
                Sign in here
              </a>
            </p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
