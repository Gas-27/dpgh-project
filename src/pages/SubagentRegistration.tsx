import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RegistrationStep {
  step: number;
  title: string;
  description: string;
}

const STEPS: RegistrationStep[] = [
  { step: 1, title: "Select Agent", description: "Choose the agent you want to become a subagent for" },
  { step: 2, title: "Store Details", description: "Create your subagent store" },
  { step: 3, title: "MoMo Account", description: "Set up your MoMo payment details" },
  { step: 4, title: "Review", description: "Review and submit your application" },
];

const MOBILE_NETWORKS = [
  { id: "mtn", name: "MTN" },
  { id: "airteltigo", name: "AirtelTigo" },
  { id: "telecel", name: "Telecel" },
];

interface AgentOption {
  id: string;
  store_name: string;
  user_id: string;
}

export function SubagentRegistration() {
  const { user, isSubagent } = useAuth();
  const { toast } = useToast();

  // Redirect if already a subagent
  if (isSubagent) {
    return <Navigate to="/subagent" />;
  }

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [agentsLoading, setAgentsLoading] = useState(true);

  // Form state
  const [selectedAgentId, setSelectedAgentId] = useState("");
  const [storeName, setStoreName] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [supportNumber, setSupportNumber] = useState("");
  const [whatsappGroup, setWhatsappGroup] = useState("");
  const [momoNumber, setMomoNumber] = useState("");
  const [momoName, setMomoName] = useState("");
  const [momoNetwork, setMomoNetwork] = useState("");

  // Fetch available agents on mount
  useState(() => {
    const fetchAgents = async () => {
      setAgentsLoading(true);
      try {
        const { data, error } = await supabase
          .from("agent_stores")
          .select("id, store_name, user_id")
          .eq("approved", true);

        if (error) throw error;

        setAgents(data || []);
      } catch (error) {
        console.error("Failed to fetch agents:", error);
        toast({
          title: "Error",
          description: "Failed to load available agents",
          variant: "destructive",
        });
      } finally {
        setAgentsLoading(false);
      }
    };

    fetchAgents();
  })[0];

  const handleNextStep = () => {
    if (currentStep === 1 && !selectedAgentId) {
      toast({
        title: "Validation Error",
        description: "Please select an agent",
        variant: "destructive",
      });
      return;
    }

    if (currentStep === 2) {
      if (!storeName || !whatsappNumber || !supportNumber) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        });
        return;
      }
    }

    if (currentStep === 3) {
      if (!momoNumber || !momoName || !momoNetwork) {
        toast({
          title: "Validation Error",
          description: "Please fill in all MoMo details",
          variant: "destructive",
        });
        return;
      }
    }

    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast({
        title: "Error",
        description: "You must be logged in",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Create subagent store
      const { data: subagentStore, error: storeError } = await supabase
        .from("subagent_stores")
        .insert({
          user_id: user.id,
          agent_store_id: selectedAgentId,
          store_name: storeName,
          whatsapp_number: whatsappNumber,
          support_number: supportNumber,
          whatsapp_group: whatsappGroup || null,
          momo_number: momoNumber,
          momo_name: momoName,
          momo_network: momoNetwork,
          approved: false, // Admin approval required
        })
        .select()
        .single();

      if (storeError) throw storeError;

      // Add subagent role to user
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: user.id,
          role: "subagent",
        });

      if (roleError && !roleError.message.includes("unique")) {
        throw roleError;
      }

      toast({
        title: "Success!",
        description: "Your subagent application has been submitted. Please wait for admin approval.",
      });

      // Redirect to dashboard after a delay
      setTimeout(() => {
        window.location.href = "/subagent";
      }, 2000);
    } catch (error) {
      console.error("Registration error:", error);
      toast({
        title: "Error",
        description: "Failed to submit registration. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link to="/" className="flex items-center gap-2 text-cyan-400 hover:text-cyan-300 mb-6">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Link>
          <h1 className="text-3xl font-bold">Become a Subagent</h1>
          <p className="text-gray-400 mt-2">Grow your data business with us</p>
        </div>

        {/* Progress Steps */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            {STEPS.map((s, idx) => (
              <div key={s.step} className="flex items-center flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    currentStep >= s.step
                      ? "bg-cyan-600 text-white"
                      : "bg-gray-700 text-gray-400"
                  }`}
                >
                  {currentStep > s.step ? <CheckCircle className="w-5 h-5" /> : s.step}
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-2 ${
                      currentStep > s.step ? "bg-cyan-600" : "bg-gray-700"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          <div className="mt-4">
            <h2 className="text-xl font-semibold text-cyan-400">
              {STEPS[currentStep - 1].title}
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {STEPS[currentStep - 1].description}
            </p>
          </div>
        </div>

        {/* Form */}
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Step 1: Select Agent */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="agent" className="text-gray-300">
                      Select an Agent *
                    </Label>
                    <p className="text-sm text-gray-400 mb-3">
                      Choose the agent you want to work with
                    </p>
                    {agentsLoading ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
                      </div>
                    ) : agents.length === 0 ? (
                      <div className="p-4 bg-gray-800 rounded border border-gray-700 flex items-center gap-2 text-yellow-400">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        <span>No agents available at the moment</span>
                      </div>
                    ) : (
                      <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                        <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                          <SelectValue placeholder="Select an agent..." />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-800 border-gray-700">
                          {agents.map((agent) => (
                            <SelectItem key={agent.id} value={agent.id}>
                              {agent.store_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              )}

              {/* Step 2: Store Details */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="storeName" className="text-gray-300">
                      Store Name *
                    </Label>
                    <Input
                      id="storeName"
                      placeholder="Your subagent store name"
                      value={storeName}
                      onChange={(e) => setStoreName(e.target.value)}
                      className="mt-2 bg-gray-800 border-gray-700 text-white"
                    />
                  </div>

                  <div>
                    <Label htmlFor="whatsapp" className="text-gray-300">
                      WhatsApp Number *
                    </Label>
                    <Input
                      id="whatsapp"
                      placeholder="0599449202 or +233599449202"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      className="mt-2 bg-gray-800 border-gray-700 text-white"
                    />
                  </div>

                  <div>
                    <Label htmlFor="support" className="text-gray-300">
                      Support Number *
                    </Label>
                    <Input
                      id="support"
                      placeholder="0599449202 or +233599449202"
                      value={supportNumber}
                      onChange={(e) => setSupportNumber(e.target.value)}
                      className="mt-2 bg-gray-800 border-gray-700 text-white"
                    />
                  </div>

                  <div>
                    <Label htmlFor="whatsappGroup" className="text-gray-300">
                      WhatsApp Group Link (Optional)
                    </Label>
                    <Input
                      id="whatsappGroup"
                      placeholder="https://chat.whatsapp.com/..."
                      value={whatsappGroup}
                      onChange={(e) => setWhatsappGroup(e.target.value)}
                      className="mt-2 bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                </div>
              )}

              {/* Step 3: MoMo Account */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="momoName" className="text-gray-300">
                      Account Holder Name *
                    </Label>
                    <Input
                      id="momoName"
                      placeholder="John Doe"
                      value={momoName}
                      onChange={(e) => setMomoName(e.target.value)}
                      className="mt-2 bg-gray-800 border-gray-700 text-white"
                    />
                  </div>

                  <div>
                    <Label htmlFor="momoNetwork" className="text-gray-300">
                      Mobile Network *
                    </Label>
                    <Select value={momoNetwork} onValueChange={setMomoNetwork}>
                      <SelectTrigger className="mt-2 bg-gray-800 border-gray-700 text-white">
                        <SelectValue placeholder="Select network..." />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-800 border-gray-700">
                        {MOBILE_NETWORKS.map((network) => (
                          <SelectItem key={network.id} value={network.id}>
                            {network.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="momoNumber" className="text-gray-300">
                      MoMo Number *
                    </Label>
                    <Input
                      id="momoNumber"
                      placeholder="0599449202 or +233599449202"
                      value={momoNumber}
                      onChange={(e) => setMomoNumber(e.target.value)}
                      className="mt-2 bg-gray-800 border-gray-700 text-white"
                    />
                  </div>

                  <div className="p-4 bg-blue-900/20 border border-blue-700 rounded">
                    <p className="text-sm text-blue-300">
                      Your MoMo account will be used to receive payouts. Please ensure it's correct.
                    </p>
                  </div>
                </div>
              )}

              {/* Step 4: Review */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <div className="p-4 bg-gray-800 rounded border border-gray-700 space-y-3">
                    <div>
                      <p className="text-sm text-gray-400">Selected Agent</p>
                      <p className="text-white font-medium">
                        {agents.find((a) => a.id === selectedAgentId)?.store_name}
                      </p>
                    </div>

                    <div className="border-t border-gray-700 pt-3">
                      <p className="text-sm text-gray-400">Store Name</p>
                      <p className="text-white font-medium">{storeName}</p>
                    </div>

                    <div className="border-t border-gray-700 pt-3">
                      <p className="text-sm text-gray-400">Contact Numbers</p>
                      <p className="text-white font-medium">
                        WhatsApp: {whatsappNumber}
                      </p>
                      <p className="text-white font-medium">Support: {supportNumber}</p>
                    </div>

                    <div className="border-t border-gray-700 pt-3">
                      <p className="text-sm text-gray-400">MoMo Account</p>
                      <p className="text-white font-medium">
                        {momoNumber} ({momoName} - {momoNetwork.toUpperCase()})
                      </p>
                    </div>
                  </div>

                  <div className="p-4 bg-green-900/20 border border-green-700 rounded">
                    <p className="text-sm text-green-300">
                      By submitting this form, you agree to our terms and conditions. Your application will be reviewed by an admin.
                    </p>
                  </div>
                </div>
              )}

              {/* Buttons */}
              <div className="flex gap-4 pt-6 border-t border-gray-700">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handlePreviousStep}
                  disabled={currentStep === 1 || loading}
                  className="flex-1"
                >
                  Previous
                </Button>

                {currentStep < STEPS.length ? (
                  <Button
                    type="button"
                    onClick={handleNextStep}
                    disabled={loading}
                    className="flex-1 bg-cyan-600 hover:bg-cyan-700"
                  >
                    Next
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Submit Application
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default SubagentRegistration;
