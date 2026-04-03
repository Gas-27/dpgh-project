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
                // Verify payment with Paystack
                const { data, error: verifyError } = await supabase.functions.invoke("verify-registration-payment", {
                    body: { reference },
                });

                if (verifyError || !data?.success) {
                    throw new Error(verifyError?.message || "Payment verification failed");
                }

                // Get store data from metadata (primary source)
                let storeData = data.store_data;
                let userId = data.user_id;

                // Fallback to session storage if metadata doesn't have the data
                if (!storeData) {
                    const storedData = sessionStorage.getItem("pending_registration_store_data");
                    if (storedData) {
                        storeData = JSON.parse(storedData);
                    } else {
                        throw new Error("Missing registration data");
                    }
                }

                if (!userId) {
                    userId = sessionStorage.getItem("pending_registration_user_id");
                    if (!userId) {
                        throw new Error("Missing user ID");
                    }
                }

                // Create the agent store with auto-approval after payment
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
                    description: "Your store has been created and automatically approved!",
                });

                setStatus("success");

                // Redirect after 3 seconds
                setTimeout(() => {
                    navigate("/agent");
                }, 3000);

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
                            Your store has been created and approved! Redirecting you to your dashboard...
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
