import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SubagentCreationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  parentAgentStoreId: string;
  onSuccess: (newSubagent: any) => void;
}

const SubagentCreationDialog = ({
  isOpen,
  onClose,
  parentAgentStoreId,
  onSuccess,
}: SubagentCreationDialogProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    store_name: "",
    whatsapp_number: "",
    support_number: "",
    momo_name: "",
    momo_network: "mtn",
    momo_number: "",
    whatsapp_group: "",
    show_whatsapp_group_icon: true,
  });

  const [packages, setPackages] = useState<any[]>([]);
  const [packagePrices, setPackagePrices] = useState<Record<string, string>>({});
  const [loadingPackages, setLoadingPackages] = useState(false);

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const loadPackages = useCallback(async () => {
    try {
      setLoadingPackages(true);
      const { data, error } = await supabase
        .from("data_packages")
        .select("*")
        .eq("active", true)
        .order("network")
        .order("size_gb");

      if (error) throw error;
      setPackages(data || []);
    } catch (err: any) {
      console.error("[v0] Error loading packages:", err);
      toast({
        title: "Error",
        description: "Failed to load packages",
        variant: "destructive",
      });
    } finally {
      setLoadingPackages(false);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate form
    if (!formData.store_name.trim() || !formData.whatsapp_number.trim() || !formData.momo_number.trim()) {
      toast({
        title: "Validation Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      setLoading(true);

      // Generate unique topup reference
      const topupRef = `SAG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      // 1. Create the subagent user (we'll use a system user approach or let admin create)
      // For now, we'll insert the store directly assuming the parent agent will manage

      // 2. Create subagent store
      const { data: storeData, error: storeError } = await supabase
        .from("subagent_stores")
        .insert({
          user_id: "", // Placeholder - will be set later
          parent_agent_store_id: parentAgentStoreId,
          store_name: formData.store_name,
          whatsapp_number: formData.whatsapp_number,
          support_number: formData.support_number,
          whatsapp_group: formData.whatsapp_group || null,
          show_whatsapp_group_icon: formData.show_whatsapp_group_icon,
          momo_name: formData.momo_name,
          momo_network: formData.momo_network,
          momo_number: formData.momo_number,
          topup_reference: topupRef,
          approved: false,
        })
        .select()
        .single();

      if (storeError) throw storeError;
      if (!storeData) throw new Error("Failed to create subagent store");

      // 3. Get agent's package prices to set as base cost for subagent
      const { data: agentPrices, error: agentPriceError } = await supabase
        .from("agent_package_prices")
        .select("*")
        .eq("agent_store_id", parentAgentStoreId);

      if (agentPriceError) throw agentPriceError;

      // 4. Create subagent package prices (copy from agent)
      if (agentPrices && agentPrices.length > 0) {
        const subagentPrices = agentPrices.map(ap => ({
          subagent_store_id: storeData.id,
          package_id: ap.package_id,
          base_cost: ap.sell_price, // Agent's sell price becomes subagent's base cost
          sell_price: ap.sell_price, // Start with same price (subagent can adjust)
        }));

        const { error: priceError } = await supabase
          .from("subagent_package_prices")
          .insert(subagentPrices);

        if (priceError) throw priceError;
      }

      toast({
        title: "Success",
        description: `Subagent store "${formData.store_name}" created successfully!`,
      });

      setFormData({
        store_name: "",
        whatsapp_number: "",
        support_number: "",
        momo_name: "",
        momo_network: "mtn",
        momo_number: "",
        whatsapp_group: "",
        show_whatsapp_group_icon: true,
      });
      setPackagePrices({});

      onSuccess(storeData);
      onClose();
    } catch (err: any) {
      console.error("[v0] Error creating subagent:", err);
      toast({
        title: "Error",
        description: err.message || "Failed to create subagent store",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-96 overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Subagent Store</DialogTitle>
          <DialogDescription>
            Set up a new subagent store under your agent account. The subagent will be able to manage their own prices and storefront.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Store Name */}
          <div>
            <Label htmlFor="store_name">Store Name *</Label>
            <Input
              id="store_name"
              placeholder="e.g., JB Data Store"
              value={formData.store_name}
              onChange={(e) => handleInputChange("store_name", e.target.value)}
              required
            />
          </div>

          {/* WhatsApp & Support */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="whatsapp_number">WhatsApp Number *</Label>
              <Input
                id="whatsapp_number"
                placeholder="0556123456"
                value={formData.whatsapp_number}
                onChange={(e) => handleInputChange("whatsapp_number", e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="support_number">Support Number *</Label>
              <Input
                id="support_number"
                placeholder="0556123456"
                value={formData.support_number}
                onChange={(e) => handleInputChange("support_number", e.target.value)}
                required
              />
            </div>
          </div>

          {/* MoMo Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="momo_name">MoMo Account Name *</Label>
              <Input
                id="momo_name"
                placeholder="Account owner name"
                value={formData.momo_name}
                onChange={(e) => handleInputChange("momo_name", e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="momo_network">MoMo Network *</Label>
              <Select value={formData.momo_network} onValueChange={(val) => handleInputChange("momo_network", val)}>
                <SelectTrigger id="momo_network">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mtn">MTN MoMo</SelectItem>
                  <SelectItem value="vodafone">Vodafone Cash</SelectItem>
                  <SelectItem value="airteltigo">AirtelTigo Money</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* MoMo Number */}
          <div>
            <Label htmlFor="momo_number">MoMo Number *</Label>
            <Input
              id="momo_number"
              placeholder="0556123456"
              value={formData.momo_number}
              onChange={(e) => handleInputChange("momo_number", e.target.value)}
              required
            />
          </div>

          {/* Optional WhatsApp Group */}
          <div>
            <Label htmlFor="whatsapp_group">WhatsApp Group Link (Optional)</Label>
            <Input
              id="whatsapp_group"
              placeholder="https://chat.whatsapp.com/..."
              value={formData.whatsapp_group}
              onChange={(e) => handleInputChange("whatsapp_group", e.target.value)}
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Create Subagent
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SubagentCreationDialog;
