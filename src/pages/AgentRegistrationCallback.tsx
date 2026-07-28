// pages/AgentRegistrationCallback.tsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const AgentRegistrationCallback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
    const [error, setError] = useState<string>("");

    useEffect(() => {
        const verifyAndCreateStore = async () => {
            const reference = searchParams.get("reference");

            if (!reference) {
                setStatus("error");
                setError("No payment reference found");
                return;
            }

            try {
                // Get store data from session storage
                const storedData = sessionStorage.getItem("pending_registration_store_data");
                const userId = sessionStorage.getItem("pending_registration_user_id");

                if (!storedData || !userId) {
                    throw new Error("Missing registration data. Please register again.");
                }

                const storeData = JSON.parse(storedData);

                // Verify the payment with Paystack via verify-payment edge function
                const { data, error: verifyError } = await supabase.functions.invoke("verify-payment", {
                    body: { reference },
                });

                if (verifyError) {
                    throw new Error(verifyError.message || "Payment verification failed");
                }

                // Create the agent store — approved immediately since payment is verified
                const { error: insertError } = await supabase.from("agent_stores").insert({
                    user_id: userId,
                    store_name: storeData.store_name,
                    whatsapp_number: storeData.whatsapp_number,
                    support_number: storeData.support_number,
                    whatsapp_group: storeData.whatsapp_group || null,
                    momo_number: storeData.momo_number,
                    momo_name: storeData.momo_name,
                    momo_network: storeData.momo_network,
                    approved: true,
                });

                if (insertError) throw insertError;

                // Clear session storage
                sessionStorage.removeItem("pending_registration_user_id");
                sessionStorage.removeItem("pending_registration_store_data");
                sessionStorage.removeItem("pending_registration_reference");

                toast({
                    title: "Registration Successful!",
                    description: "Your store is live! Taking you to your dashboard...",
                });

                setStatus("success");

                // Redirect directly to agent dashboard — store is approved
                setTimeout(() => {
                    navigate("/agent", { replace: true });
                }, 2000);

            } catch (err: any) {
                console.error("Registration error:", err);
                setStatus("error");
                setError(err.message || "Registration failed");

                toast({
                    title: "Registration Failed",
                    description: err.message || "Something went wrong. Please contact support.",
                    variant: "destructive",
                });
            }
        };

        verifyAndCreateStore();
    }, [searchParams, navigate, toast]);

    if (status === "processing") {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Card className="w-full max-w-md">
                    <CardContent className="p-8 text-center space-y-4">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                        <h2 className="text-xl font-semibold">Verifying Payment</h2>
                        <p className="text-muted-foreground">
                            Please wait while we confirm your payment and set up your store...
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (status === "success") {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Card className="w-full max-w-md">
                    <CardContent className="p-8 text-center space-y-4">
                        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                            <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h2 className="text-xl font-semibold">Payment Successful!</h2>
                        <p className="text-muted-foreground">
                            Your store is live! Redirecting you to your agent dashboard...
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex items-center justify-center">
            <Card className="w-full max-w-md">
                <CardContent className="p-8 text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto">
                        <svg className="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h2 className="text-xl font-semibold">Registration Failed</h2>
                    <p className="text-muted-foreground">{error}</p>
                    <Button onClick={() => navigate("/agent-onboarding")} variant="outline">
                        Try Again
                    </Button>
                </CardContent>
            </Card>

        </div >
    );
};

export default AgentRegistrationCallback;
