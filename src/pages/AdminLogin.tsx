import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, Eye, EyeOff, Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const AdminLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [sendingReset, setSendingReset] = useState(false);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      toast({
        title: "Login failed",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const userId = data.user?.id;
    if (!userId) {
      toast({ title: "Error", description: "User ID not found", variant: "destructive" });
      setLoading(false);
      return;
    }

    // Fetch roles from user_roles table
    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (rolesError || !rolesData) {
      toast({
        title: "Access Denied",
        description: "Could not verify admin status",
        variant: "destructive",
      });
      setLoading(false);
      return;
    }

    const roles = rolesData.map(r => r.role);

    // Only allow admins to proceed
    if (!roles.includes("admin")) {
      toast({
        title: "Access Denied",
        description: "This page is for administrators only",
        variant: "destructive",
      });
      // Sign out the non-admin user
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    // Admin verified - redirect to admin dashboard
    toast({ title: "Welcome Admin!", description: "Redirecting to dashboard..." });
    navigate("/admin", { replace: true });
    setLoading(false);
  };

  const handlePasswordReset = async () => {
    if (!resetEmail) {
      toast({ title: "Error", description: "Please enter your email", variant: "destructive" });
      return;
    }

    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Success", description: "Check your email for reset link" });
      setResetDialogOpen(false);
      setResetEmail("");
    }
    setSendingReset(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="bg-red-500/20 p-3 rounded-lg">
              <Shield className="h-8 w-8 text-red-500" />
            </div>
          </div>
          <CardTitle className="font-display text-2xl">Admin Login</CardTitle>
          <CardDescription>Administrative access only</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdminLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">
                <Mail className="h-4 w-4 inline mr-2" />
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">
                <Lock className="h-4 w-4 inline mr-2" />
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground disabled:opacity-50"
                  tabIndex={-1}
                  disabled={loading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" variant="hero" className="w-full" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Logging in...
                </>
              ) : (
                "Admin Login"
              )}
            </Button>
          </form>

          <div className="mt-4 pt-4 border-t border-border">
            <button
              onClick={() => setResetDialogOpen(true)}
              className="w-full text-sm text-muted-foreground hover:text-primary transition-colors text-center"
            >
              Forgot password?
            </button>
          </div>

          <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <p className="text-xs text-amber-700/90">
              This is a secure admin-only portal. Unauthorized access attempts are logged.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Password Reset Dialog */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>Enter your email to receive a password reset link</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="email"
              placeholder="your@email.com"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
              disabled={sendingReset}
            />
            <Button onClick={handlePasswordReset} disabled={sendingReset} className="w-full">
              {sendingReset ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Reset Link"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminLogin;
