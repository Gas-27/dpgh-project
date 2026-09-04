import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const AFARegistrationSuccess = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
  const [message, setMessage] = useState("Processing your AFA registration...");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [open, setOpen] = useState(false);
  const [registrationId, setRegistrationId] = useState("");

  useEffect(() => {
    const afaRegistration = searchParams.get("afa_registration");
    const reference = searchParams.get("reference") || searchParams.get("trxref");
    const phone = searchParams.get("phone");

    if (afaRegistration === "success" && reference) {
      setOpen(true);
      setPhoneNumber(phone || "");
      verifyAFARegistration(reference);
    }
  }, [searchParams]);

  const verifyAFARegistration = async (reference: string) => {
    try {
      // Query the database to get the registration status
      const { data, error } = await supabase
        .from("afa_registrations")
        .select("id, registration_status, customer_phone")
        .eq("paystack_reference", reference)
        .single();

      if (error || !data) {
        setStatus("error");
        setMessage("Could not verify your registration. Please contact support if this persists.");
        return;
      }

      setRegistrationId(data.id);
      setPhoneNumber(data.customer_phone || phoneNumber);

      if (data.registration_status === "completed") {
        setStatus("success");
        setMessage("Registration successful!");
      } else if (data.registration_status === "failed") {
        setStatus("error");
        setMessage("Registration failed. Please try again.");
      } else {
        setStatus("success");
        setMessage("Registration submitted!");
      }
    } catch (err: any) {
      setStatus("error");
      setMessage(err.message || "Something went wrong verifying your registration.");
    }
  };

  const handleClose = () => {
    setOpen(false);
    // Optionally redirect or perform other actions
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">AFA Registration</DialogTitle>
        </DialogHeader>

        {status === "verifying" && (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <p className="text-center text-sm">{message}</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <CheckCircle2 className="h-12 w-12 text-green-600" />
            </div>
            
            <div className="space-y-3 text-center">
              <h3 className="font-semibold text-lg text-green-700">Registration Successful! ✅</h3>
              <p className="text-sm text-muted-foreground">
                Your AFA registration has been submitted successfully.
              </p>
              
              {phoneNumber && (
                <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200">
                  <CardContent className="pt-4">
                    <p className="text-xs text-muted-foreground mb-1">Registered Number</p>
                    <p className="text-lg font-bold text-blue-600">{phoneNumber}</p>
                  </CardContent>
                </Card>
              )}

              <Card className="bg-amber-50 dark:bg-amber-950 border-amber-200">
                <CardContent className="pt-4 space-y-2">
                  <div className="flex gap-2">
                    <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div className="text-left text-sm">
                      <p className="font-semibold text-amber-900">Approval Timeline</p>
                      <p className="text-amber-800 text-xs mt-1">
                        MTN will review and approve your registration within <strong>24-72 hours</strong>.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-green-50 dark:bg-green-950 border-green-200">
                <CardContent className="pt-4 space-y-2">
                  <div className="flex gap-2">
                    <span className="text-lg">📱</span>
                    <div className="text-left text-sm">
                      <p className="font-semibold text-green-900">You'll Receive an SMS</p>
                      <p className="text-green-800 text-xs mt-1">
                        Once your registration is <strong>approved by MTN</strong>, you will receive an SMS notification on the registered number with activation details and next steps.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-4 py-4">
            <div className="flex justify-center">
              <AlertCircle className="h-12 w-12 text-red-600" />
            </div>
            
            <div className="space-y-3 text-center">
              <h3 className="font-semibold text-lg text-red-700">Error ❌</h3>
              <p className="text-sm text-muted-foreground">{message}</p>
              <p className="text-xs text-muted-foreground">
                If this problem persists, please contact our support team for assistance.
              </p>
            </div>

            <Button onClick={handleClose} className="w-full" variant="outline">
              Close
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AFARegistrationSuccess;
