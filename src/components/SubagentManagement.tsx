import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Trash2, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface SubagentStore {
  id: string;
  store_name: string;
  whatsapp_number: string;
  approved: boolean;
  wallet_balance: number;
  created_at: string;
}

interface SubagentManagementProps {
  agentStoreId: string;
}

export function SubagentManagement({ agentStoreId }: SubagentManagementProps) {
  const { toast } = useToast();

  const [allowRegistration, setAllowRegistration] = useState(false);
  const [subagents, setSubagents] = useState<SubagentStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedSubagent, setSelectedSubagent] = useState<SubagentStore | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Fetch agent store and subagents
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch agent store to get allow_registration status
        const { data: agentStore, error: agentError } = await supabase
          .from("agent_stores")
          .select("allow_subagent_registration")
          .eq("id", agentStoreId)
          .single();

        if (agentError) throw agentError;

        setAllowRegistration(agentStore?.allow_subagent_registration ?? false);

        // Fetch subagents
        const { data: subagentsData, error: subagentsError } = await supabase
          .from("subagent_stores")
          .select("id, store_name, whatsapp_number, approved, wallet_balance, created_at")
          .eq("agent_store_id", agentStoreId)
          .order("created_at", { ascending: false });

        if (subagentsError) throw subagentsError;

        setSubagents(subagentsData || []);
      } catch (error) {
        console.error("Failed to fetch data:", error);
        toast({
          title: "Error",
          description: "Failed to load subagent information",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [agentStoreId, toast]);

  const handleToggleRegistration = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("agent_stores")
        .update({ allow_subagent_registration: !allowRegistration })
        .eq("id", agentStoreId);

      if (error) throw error;

      setAllowRegistration(!allowRegistration);

      toast({
        title: "Success",
        description: `Subagent registration ${!allowRegistration ? "enabled" : "disabled"}`,
      });
    } catch (error) {
      console.error("Failed to update setting:", error);
      toast({
        title: "Error",
        description: "Failed to update setting",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleApproveSubagent = async (subagentId: string) => {
    try {
      const { error } = await supabase
        .from("subagent_stores")
        .update({ approved: true })
        .eq("id", subagentId);

      if (error) throw error;

      setSubagents(
        subagents.map((s) =>
          s.id === subagentId ? { ...s, approved: true } : s
        )
      );

      toast({
        title: "Success",
        description: "Subagent approved",
      });
    } catch (error) {
      console.error("Failed to approve subagent:", error);
      toast({
        title: "Error",
        description: "Failed to approve subagent",
        variant: "destructive",
      });
    }
  };

  const handleDeleteSubagent = async () => {
    if (!selectedSubagent) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("subagent_stores")
        .delete()
        .eq("id", selectedSubagent.id);

      if (error) throw error;

      setSubagents(subagents.filter((s) => s.id !== selectedSubagent.id));
      setDeleteDialogOpen(false);
      setSelectedSubagent(null);

      toast({
        title: "Success",
        description: "Subagent removed",
      });
    } catch (error) {
      console.error("Failed to delete subagent:", error);
      toast({
        title: "Error",
        description: "Failed to remove subagent",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Registration Control */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-cyan-400">Subagent Registration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-gray-700 rounded border border-gray-600">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-gray-200 block mb-1">
                  Allow Subagent Registration
                </Label>
                <p className="text-sm text-gray-400">
                  Enable this to allow other users to register as subagents under your account
                </p>
              </div>
              <Switch
                checked={allowRegistration}
                onCheckedChange={handleToggleRegistration}
                disabled={saving}
              />
            </div>
          </div>

          {allowRegistration && (
            <div className="p-4 bg-green-900/20 border border-green-700 rounded">
              <p className="text-sm text-green-300">
                Subagent registration is currently <b>enabled</b>. Users can register and become subagents of your store.
              </p>
            </div>
          )}

          {!allowRegistration && (
            <div className="p-4 bg-gray-700 border border-gray-600 rounded">
              <p className="text-sm text-gray-300">
                Subagent registration is currently <b>disabled</b>. No new subagents can register.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Subagents List */}
      <Card className="bg-gray-800 border-gray-700">
        <CardHeader>
          <CardTitle className="text-cyan-400">Your Subagents</CardTitle>
          <p className="text-sm text-gray-400 mt-2">
            {subagents.length} subagent{subagents.length !== 1 ? "s" : ""}
          </p>
        </CardHeader>
        <CardContent>
          {subagents.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-8 h-8 mx-auto text-gray-600 mb-2" />
              <p className="text-gray-400">No subagents yet</p>
              <p className="text-sm text-gray-500 mt-1">
                {allowRegistration
                  ? "Subagents can register through the registration page"
                  : "Enable subagent registration to accept new subagents"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-gray-700">
                    <TableHead>Store Name</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>Wallet Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Registered</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subagents.map((subagent) => (
                    <TableRow key={subagent.id} className="border-gray-700">
                      <TableCell className="font-medium">{subagent.store_name}</TableCell>
                      <TableCell className="text-sm">{subagent.whatsapp_number}</TableCell>
                      <TableCell className="text-sm">
                        GH₵{subagent.wallet_balance.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {subagent.approved ? (
                          <Badge className="bg-green-600/20 text-green-400 border-green-600/30">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Approved
                          </Badge>
                        ) : (
                          <Badge className="bg-yellow-600/20 text-yellow-400 border-yellow-600/30">
                            <Clock className="w-3 h-3 mr-1" />
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(subagent.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="space-x-2">
                        {!subagent.approved && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApproveSubagent(subagent.id)}
                            className="text-green-400 border-green-600/30 hover:bg-green-600/10"
                          >
                            Approve
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedSubagent(subagent);
                            setDeleteDialogOpen(true);
                          }}
                          className="text-red-400 border-red-600/30 hover:bg-red-600/10"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800">
          <DialogHeader>
            <DialogTitle className="text-red-400">Remove Subagent?</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to remove <b>{selectedSubagent?.store_name}</b> as a subagent? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSubagent}
              disabled={deleting}
            >
              {deleting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Remove
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SubagentManagement;
