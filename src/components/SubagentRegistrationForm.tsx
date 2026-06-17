import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { DOMAINS } from "@/config/domains";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SubagentRegistrationFormProps {
  agentStoreId: string;
  agentStoreName: string;
  primaryColor: string;
  primaryForeground: string;
  onClose?: () => void;
}

export default function SubagentRegistrationForm({
  agentStoreId,
  agentStoreName,
  primaryColor,
  primaryForeground,
  onClose,
}: SubagentRegistrationFormProps) {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [storeNameError, setStoreNameError] = useState("");
  const [checkingStoreName, setCheckingStoreName] = useState(false);
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

      // Sign up the user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            role: "subagent",
          },
        },
      });

      if (authError) throw authError;
      if (!authData.user?.id) throw new Error("Failed to create user account");

      // Create subagent store (auto-approved) with exact store name
      const { data: storeData, error: storeError } = await supabase
        .from("subagent_stores")
        .insert({
          user_id: authData.user.id,
          agent_store_id: agentStoreId,
          store_name: formData.storeName,
          whatsapp_number: formData.whatsappNumber,
          support_number: formData.supportNumber,
          momo_name: formData.momoName,
          momo_number: formData.momoNumber,
          momo_network: formData.momoNetwork,
          wallet_balance: 0,
          approved: true,
        })
        .select()
        .single();

      if (storeError) throw storeError;

      // Check if user already has subagent role
      const { data: existingRole, error: checkError } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", authData.user.id)
        .eq("role", "subagent")
        .single();

      // Only insert if role doesn't exist
      if (!existingRole) {
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({
            user_id: authData.user.id,
            role: "subagent",
          });

        if (roleError && roleError.code !== "PGRST116") {
          // PGRST116 is "no rows found" which is expected if role doesn't exist
          console.error("[v0] Error creating user role:", roleError);
          throw new Error("Failed to create user role: " + roleError.message);
        }
      }

      console.log("[v0] Subagent store created:", storeData);
      console.log("[v0] User role verified for subagent");

      // Store the subagent store ID in sessionStorage for the dashboard
      sessionStorage.setItem("newSubagentStoreId", storeData.id);
      sessionStorage.setItem("newSubagentEmail", formData.email);

      toast({
        title: "✅ Registration Successful!",
        description: "Your subagent account has been created.",
      });

      // Close the modal first
      if (onClose) onClose();

      // Wait for modal to close and auth to fully update, then redirect
      setTimeout(() => {
        // Redirect to agentsstore.shop domain for subagent dashboard
        window.location.href = DOMAINS.getSubagentDashboardUrl();
      }, 500);
    } catch (error: any) {
      console.error("Registration error:", error);
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to create subagent account",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border bg-card/50">
      <CardContent className="p-6 md:p-8 space-y-6">
        {/* Fee Information Alert */}
        {!fetchingStore && agentStore?.subagent_fee_enabled && agentStore?.subagent_fee_amount > 0 && (
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-blue-400 mb-1">Registration Fee Required</p>
                <p className="text-sm text-muted-foreground">
                  To complete your registration as an agent, you need to pay a one-time fee of <span className="font-bold text-blue-300">GH₵ {agentStore.subagent_fee_amount.toFixed(2)}</span>. Your agent account will be created immediately after successful payment.
                </p>
              </div>
            </div>
          </div>
        )}

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
                {agentStore?.subagent_fee_enabled && agentStore?.subagent_fee_amount > 0 ? "Processing Payment..." : "Creating Account..."}
              </>
            ) : (
              agentStore?.subagent_fee_enabled && agentStore?.subagent_fee_amount > 0
                ? `Pay GH₵ ${agentStore.subagent_fee_amount.toFixed(2)} to Create Agent Account`
                : "Create Agent Account"
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            By signing up, you agree to become an agent under {agentStoreName} and follow our terms and conditions.
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
