// components/PaymentModal.tsx
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface PaymentModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userId: string;
    email: string;
    phone: string;
    storeData: any;
}

const AGENT_REGISTRATION_FEE = 17;

export const PaymentModal = ({
    open,
    onOpenChange,
    userId,
    email,
    phone,
    storeData
}: PaymentModalProps) => {
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const handlePayment = async () => {
        setLoading(true);

        try {
            const { data, error } = await supabase.functions.invoke("initialize-registration-payment", {
                body: {
                    email,
                    phone,
                    amount: AGENT_REGISTRATION_FEE,
                    metadata: {
                        user_id: userId,
                        type: "agent_registration",
                        store_data: storeData,
                        registration_fee: AGENT_REGISTRATION_FEE,
                    },
                },
            });

            if (error) throw error;

            if (data?.authorization_url) {
                // Store backup data in session storage
                sessionStorage.setItem("pending_registration_user_id", userId);
                sessionStorage.setItem("pending_registration_store_data", JSON.stringify(storeData));
                sessionStorage.setItem("pending_registration_reference", data.reference);

                // Redirect to Paystack
                window.location.href = data.authorization_url;
            } else {
                throw new Error(data?.error || "No authorization URL received");
            }
        } catch (err: any) {
            console.error("[v0] Payment initialization error:", err);
            const errorDescription = err?.message || err?.error?.message || "Failed to initialize payment. Please try again.";
            toast({
                title: "Payment Error",
                description: errorDescription,
                variant: "destructive"
            });
        } finally {
            setLoading(false);
        }
    };

    const PAYSTACK_CHARGE_PERCENT = 1.95;
    const totalWithFee = AGENT_REGISTRATION_FEE + (AGENT_REGISTRATION_FEE * PAYSTACK_CHARGE_PERCENT / 100);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Complete Registration</DialogTitle>
                    <DialogDescription>
                        Pay the registration fee of GHS {AGENT_REGISTRATION_FEE} to create your agent store.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="bg-muted p-4 rounded-lg">
                        <p className="text-sm text-muted-foreground mb-2">Registration Fee Breakdown:</p>
                        <div className="flex justify-between text-sm">
                            <span>Registration Fee</span>
                            <span>GHS {AGENT_REGISTRATION_FEE.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span>Paystack Fee (1.95%)</span>
                            <span>GHS {((AGENT_REGISTRATION_FEE * 1.95) / 100).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between font-semibold mt-2 pt-2 border-t">
                            <span>Total</span>
                            <span>GHS {totalWithFee.toFixed(2)}</span>
                        </div>
                    </div>

                    <Button
                        onClick={handlePayment}
                        disabled={loading}
                        className="w-full"
                        variant="hero"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Processing...
                            </>
                        ) : (
                            <>
                                <CreditCard className="mr-2 h-4 w-4" />
                                Pay GHS {totalWithFee.toFixed(2)}
                            </>
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
};
