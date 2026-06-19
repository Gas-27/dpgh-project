import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { DOMAINS } from "@/config/domains";
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
  primaryColor,
  primaryForeground,
  onClose,
}: SubSubagentRegistrationFormProps) {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [storeNameError, setStoreNameError] = useState("");
  const [checkingStoreName, setCheckingStoreName] = useState(false);
  const [subagentStore, setSubagentStore] = useState<any>(null);
  const [fetchingStore, setFetchingStore] = useState(true);
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
        .from("sub_subagent_stores")
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

  // Fetch subagent store data to check if sub-subagent registration is enabled
  useEffect(() => {
    const fetchSubagentStore = async () => {
      try {
        const { data, error } = await supabase
          .from("subagent_stores")
          .select("id, store_name, allow_sub_subagent_registration")
          .eq("id", subagentStoreId)
          .single();

        if (error) {
          toast({ title: "Error", description: "Failed to fetch subagent store data", variant: "destructive" });
        } else if (data && !data.allow_sub_subagent_registration) {
          toast({ title: "Info", description: "Sub-subagent registration is not enabled for this store", variant: "default" });
        }
        setSubagentStore(data);
      } catch (error) {
        toast({ title: "Error", description: "An error occurred while fetching store data", variant: "destructive" });
      } finally {
        setFetchingStore(false);
      }
    };

    fetchSubagentStore();
  }, [subagentStoreId, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!formData.email || !formData.password || !formData.storeName) {
      toast({ title: "Error", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }

    if (formData.password.length < 8) {
      toast({ title: "Error", description: "Password must be at least 8 characters", variant: "destructive" });
      return;
    }

    if (storeNameError) {
      toast({ title: "Error", description: storeNameError, variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      // Sign up user with sub_subagent role
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            role: "sub_subagent",
          },
        },
      });

      if (signUpError) {
        toast({ title: "Error", description: signUpError.message, variant: "destructive" });
        setLoading(false);
        return;
      }

      if (!signUpData.user) {
        toast({ title: "Error", description: "Failed to create user account", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Store registration data in sub_subagent_registrations table
      const { error: registrationError } = await supabase
        .from("sub_subagent_registrations")
        .insert([
          {
            user_id: signUpData.user.id,
            subagent_store_id: subagentStoreId,
            business_name: formData.storeName,
            phone_number: formData.supportNumber,
            email: formData.email,
            registration_data: {
              store_name: formData.storeName,
              support_number: formData.supportNumber,
              whatsapp_number: formData.whatsappNumber,
              momo_name: formData.momoName,
              momo_number: formData.momoNumber,
              momo_network: formData.momoNetwork,
            },
            status: "completed",
            payment_status: "pending",
          },
        ]);

      if (registrationError) {
        console.error("[v0] Registration error:", registrationError);
        toast({ title: "Error", description: "Failed to save registration data", variant: "destructive" });
        setLoading(false);
        return;
      }

      // Create sub-subagent store record
      const { error: storeError } = await supabase
        .from("sub_subagent_stores")
        .insert([
          {
            user_id: signUpData.user.id,
            subagent_store_id: subagentStoreId,
            store_name: formData.storeName,
            whatsapp_number: formData.whatsappNumber,
            support_number: formData.supportNumber,
            momo_name: formData.momoName,
            momo_number: formData.momoNumber,
            momo_network: formData.momoNetwork,
            wallet_balance: 0,
            approved: true,
          },
        ]);

      if (storeError) {
        console.error("[v0] Store creation error:", storeError);
        toast({ title: "Error", description: "Failed to create store", variant: "destructive" });
        setLoading(false);
        return;
      }

      toast({ 
        title: "Success", 
        description: "Sub-subagent registration successful! Please log in with your credentials.", 
        variant: "default" 
      });

      // Redirect to login page
      setTimeout(() => {
        navigate("/login");
      }, 1500);

    } catch (error) {
      console.error("[v0] Unexpected error:", error);
      toast({ title: "Error", description: "An unexpected error occurred", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (fetchingStore) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!subagentStore?.allow_sub_subagent_registration) {
    return (
      <Card className="w-full max-w-md mx-auto border-red-500/50">
        <CardContent className="p-6">
          <div className="flex gap-3">
            <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-600">Registration Disabled</p>
              <p className="text-sm text-muted-foreground mt-1">Sub-subagent registration is not currently enabled for this subagent store.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardContent className="p-6">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground">Become a Sub-Subagent</h2>
          <p className="text-sm text-muted-foreground mt-1">Under {subagentStoreName}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Store Name */}
          <div>
            <Label htmlFor="storeName" className="text-foreground">Store Name *</Label>
            <Input
              id="storeName"
              type="text"
              placeholder="Your Store Name"
              value={formData.storeName}
              onChange={handleInputChange}
              onBlur={checkStoreNameAvailability}
              disabled={loading}
              className="mt-1.5"
            />
            {checkingStoreName && <p className="text-xs text-muted-foreground mt-1">Checking availability...</p>}
            {storeNameError && <p className="text-xs text-red-600 mt-1">{storeNameError}</p>}
          </div>

          {/* Email */}
          <div>
            <Label htmlFor="email" className="text-foreground">Email Address *</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={formData.email}
              onChange={handleInputChange}
              disabled={loading}
              className="mt-1.5"
            />
          </div>

          {/* Password */}
          <div>
            <Label htmlFor="password" className="text-foreground">Password *</Label>
            <div className="relative mt-1.5">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="At least 8 characters"
                value={formData.password}
                onChange={handleInputChange}
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Support Number */}
          <div>
            <Label htmlFor="supportNumber" className="text-foreground">Support Number</Label>
            <Input
              id="supportNumber"
              type="tel"
              placeholder="0241234567"
              value={formData.supportNumber}
              onChange={handleInputChange}
              disabled={loading}
              className="mt-1.5"
            />
          </div>

          {/* WhatsApp Number */}
          <div>
            <Label htmlFor="whatsappNumber" className="text-foreground">WhatsApp Number</Label>
            <Input
              id="whatsappNumber"
              type="tel"
              placeholder="0241234567"
              value={formData.whatsappNumber}
              onChange={handleInputChange}
              disabled={loading}
              className="mt-1.5"
            />
          </div>

          {/* MoMo Name */}
          <div>
            <Label htmlFor="momoName" className="text-foreground">MoMo Account Name</Label>
            <Input
              id="momoName"
              type="text"
              placeholder="John Doe"
              value={formData.momoName}
              onChange={handleInputChange}
              disabled={loading}
              className="mt-1.5"
            />
          </div>

          {/* MoMo Number */}
          <div>
            <Label htmlFor="momoNumber" className="text-foreground">MoMo Number</Label>
            <Input
              id="momoNumber"
              type="tel"
              placeholder="0241234567"
              value={formData.momoNumber}
              onChange={handleInputChange}
              disabled={loading}
              className="mt-1.5"
            />
          </div>

          {/* MoMo Network */}
          <div>
            <Label className="text-foreground">MoMo Network</Label>
            <Select value={formData.momoNetwork} onValueChange={handleSelectChange} disabled={loading}>
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mtn">MTN</SelectItem>
                <SelectItem value="airteltigo">AirtelTigo</SelectItem>
                <SelectItem value="telecel">Telecel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            disabled={loading}
            style={{ backgroundColor: primaryColor, color: primaryForeground }}
            className="w-full mt-6"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Registering...
              </>
            ) : (
              "Complete Registration"
            )}
          </Button>

          {onClose && (
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
              className="w-full"
            >
              Cancel
            </Button>
          )}
        </form>

        <p className="text-xs text-center text-muted-foreground mt-4">
          By registering, you agree to our terms and conditions
        </p>
      </CardContent>
    </Card>
  );
}
