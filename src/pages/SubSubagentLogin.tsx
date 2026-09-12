import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, Eye, EyeOff, Store } from "lucide-react";
import { DOMAINS } from "@/config/domains";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const SubSubagentLogin = () => {
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [sendingReset, setSendingReset] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
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

    // Complete store creation after authentication. This also repairs a
    // confirmed account that was created before the signup fix was deployed.
    const metadata = data.user.user_metadata ?? {};
    if (metadata.role === "sub_subagent" && metadata.subagent_store_id) {
      const { error: registrationError } = await supabase.rpc("register_sub_subagent", {
        p_user_id: userId,
        p_subagent_store_id: metadata.subagent_store_id,
        p_store_name: metadata.store_name || data.user.email || "Sub-subagent store",
        p_whatsapp_number: metadata.whatsapp_number || null,
        p_support_number: metadata.support_number || null,
        p_momo_number: metadata.momo_number || null,
        p_momo_name: metadata.momo_name || null,
        p_momo_network: metadata.momo_network || "mtn",
      });

      if (registrationError) {
        console.error("[v0] Could not complete sub-subagent registration", registrationError);
        await supabase.auth.signOut();
        toast({
          title: "Registration incomplete",
          description: "Your parent agent store could not be verified. Please contact your parent agent.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
    }

    // The role table is authoritative. Store membership is checked as a
    // second safeguard, but it must not be the only role check because older
    // registrations may have the role before their store row is repaired.
    const [{ data: roleRows, error: roleError }, { data: subSubagentStore, error: storeError }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId),
      supabase.from("sub_subagent_stores").select("id").eq("user_id", userId).maybeSingle(),
    ]);

    if (roleError || storeError) {
      toast({ title: "Error", description: "Could not verify account type", variant: "destructive" });
      setLoading(false);
      return;
    }

    const isSubSubagent = roleRows?.some((row) => row.role === "sub_subagent");

    // Only allow sub-subagent login on this page
    if (!isSubSubagent && !subSubagentStore) {
      toast({
        title: "Access Denied",
        description: "This login page is only for sub-subagents. Please use the correct login page.",
        variant: "destructive",
      });
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    toast({ title: "Welcome back!", description: "Redirecting to your dashboard..." });
    // Use window.location.href to do a full page reload so the page loads with
    // session already established and roles already cached from database
    // Wait 1000ms to ensure Supabase session is fully persisted
    setTimeout(() => {
      window.location.href = "/sub-subagent-dashboard";
    }, 1000);
  };

  const handleForgotPassword = async () => {
    if (!resetEmail.trim()) {
      toast({ title: "Error", description: "Please enter your email address", variant: "destructive" });
      return;
    }

    setSendingReset(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Check your email",
        description: "We sent a password reset link to your inbox.",
      });
      setResetDialogOpen(false);
      setResetEmail("");
    }
    setSendingReset(false);
  };

  // If already logged in as sub-subagent, redirect to dashboard
  useEffect(() => {
    const checkAndRedirect = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const [{ data: roleRows }, { data: subSubagentStore }] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", session.user.id),
          supabase.from("sub_subagent_stores").select("id").eq("user_id", session.user.id).maybeSingle(),
        ]);

        if (roleRows?.some((row) => row.role === "sub_subagent") || subSubagentStore) {
          window.location.href = "/sub-subagent-dashboard";
        }
      }
    };
    checkAndRedirect();
  }, []);

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-cyan-500/5 px-4">
        <Card className="w-full max-w-md border-border shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <div className="flex justify-center mb-2">
              <div className="p-3 rounded-full bg-cyan-500/10">
                <Store className="h-8 w-8 text-cyan-500" />
              </div>
            </div>
            <CardTitle className="font-display text-2xl font-bold">Sub-Subagent Login</CardTitle>
            <CardDescription>Sign in to your sub-subagent dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    required
                    autoFocus
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => setResetDialogOpen(true)}
                    className="text-xs text-cyan-500 hover:underline focus:outline-none"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="********"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-700" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Sign In
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>
              Enter your email address and we'll send you a link to create a new password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email address</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="you@example.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                autoFocus
              />
            </div>
            <Button
              className="w-full bg-cyan-600 hover:bg-cyan-700"
              onClick={handleForgotPassword}
              disabled={sendingReset}
            >
              {sendingReset ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Send Reset Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SubSubagentLogin;
