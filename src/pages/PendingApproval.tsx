import { Zap, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";

const PendingApproval = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border text-center">
        <CardContent className="p-8 space-y-6">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Clock className="h-10 w-10 text-primary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold mb-2">Pending Approval</h1>
            <p className="text-muted-foreground">
              Your agent account is being reviewed by our team. You'll be notified once your store is approved.
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/">Back to Home</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default PendingApproval;
