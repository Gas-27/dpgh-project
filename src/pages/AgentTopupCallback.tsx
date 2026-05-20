// pages/AgentTopupCallback.tsx
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const AgentTopupCallback = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
    const [error, setError] = useState<string>("");
    const [amount, setAmount] = useState<number>(0);
    const [newBalance, setNewBalance] = useState<number>(0);

    useEffect(() => {
        const verifyTopup = async () => {
            const reference = searchParams.get("reference");

            if (!reference) {
                setStatus("error");
                setError("No payment reference found");
                return;
            }

            try {
                // Verify payment with backend
                const { data, error: verifyError } = await supabase.functions.invoke("verify-wallet-topup", {
                    body: { reference },
                });

                if (verifyError) {
                    throw new Error(verifyError.message || "Payment verification failed");
                }

                if (!data?.success) {
                    throw new Error(data?.error || "Topup verification failed");
                }

                // Check if already processed
                if (data.already_processed) {
                    toast({
                        title: "Already Processed",
                        description: "This topup was already credited to your wallet.",
                    });
                } else {
                    toast({
                        title: "Wallet Topped Up!",
                        description: `GHS ${data.amount?.toFixed(2)} has been added to your wallet.`,
                    });
                    setAmount(data.amount || 0);
                    setNewBalance(data.new_balance || 0);
                }

                setStatus("success");

                // Redirect after 3 seconds
                setTimeout(() => {
                    navigate("/agent");
                }, 3000);

            } catch (err: any) {
                console.error("Topup verification error:", err);
                setStatus("error");
                setError(err.message || "Topup verification failed");

                toast({
                    title: "Topup Failed",
                    description: err.message || "Something went wrong. Please contact support.",
                    variant: "destructive",
                });
            }
        };

        verifyTopup();
    }, [searchParams, navigate, toast]);

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardContent className="p-8 text-center">
                    {status === "processing" && (
                        <>
                            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
                            <h2 className="text-xl font-bold mb-2">Processing Topup...</h2>
                            <p className="text-muted-foreground">
                                Please wait while we verify your payment.
                            </p>
                        </>
                    )}

                    {status === "success" && (
                        <>
                            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                            <h2 className="text-xl font-bold mb-2 text-green-500">Topup Successful!</h2>
                            {amount > 0 && (
                                <p className="text-muted-foreground mb-2">
                                    GHS {amount.toFixed(2)} has been added to your wallet.
                                </p>
                            )}
                            {newBalance > 0 && (
                                <p className="text-lg font-semibold text-primary">
                                    New Balance: GHS {newBalance.toFixed(2)}
                                </p>
                            )}
                            <p className="text-sm text-muted-foreground mt-4">
                                Redirecting to your dashboard...
                            </p>
                        </>
                    )}

                    {status === "error" && (
                        <>
                            <XCircle className="h-16 w-16 text-destructive mx-auto mb-4" />
                            <h2 className="text-xl font-bold mb-2 text-destructive">Topup Failed</h2>
                            <p className="text-muted-foreground mb-4">{error}</p>
                            <div className="space-y-2">
                                <Button onClick={() => navigate("/agent")} className="w-full">
                                    Return to Dashboard
                                </Button>
                                <Button variant="outline" asChild className="w-full">
                                    <a href="https://wa.me/233200511211" target="_blank" rel="noopener noreferrer">
                                        Contact Support
                                    </a>
                                </Button>
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default AgentTopupCallback;
