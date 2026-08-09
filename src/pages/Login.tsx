import { useState, useEffect } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Mail, Lock, Eye, EyeOff } from "lucide-react";

// Google "G" SVG icon
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [sendingReset, setSendingReset] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    const authError = (location.state as { authError?: string } | null)?.authError;
    if (authError) {
      toast({ title: "Google sign-in failed", description: authError, variant: "destructive" });
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location, navigate, toast]);

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    // Use the exact domain in Supabase's Site URL (no www) so Supabase
    // honours the redirectTo instead of falling back to the Site URL root.
    const appUrl = "https://dataplug.store";
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${appUrl}/auth/callback`,
        queryParams: {
          access_type: "offline",
          prompt: "select_account",
        },
      },
    });
    if (error) {
      toast({ title: "Google sign-in failed", description: error.message, variant: "destructive" });
      setGoogleLoading(false);
    }
  };

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

    // Fetch roles from user_roles table (same as useAuth)
    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (!rolesError && rolesData) {
      const roles = rolesData.map(r => String(r.role).trim().toLowerCase());
      
      // Check if user is admin - admins cannot login from here
      if (roles.includes("admin")) {
        // Sign out the admin user immediately
        await supabase.auth.signOut();
        
        toast({
          title: "Access Denied",
          description: "You cannot login from this page",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      
      // Non-admin user routing — every role lands on its own dashboard
      let redirectTo = "/user-dashboard"; // default for customers and any unrecognised role
      if (roles.includes("agent")) {
        redirectTo = "/agent";
      } else if (roles.includes("sub_subagent")) {
        redirectTo = "/sub-subagent-dashboard";
      } else if (roles.includes("subagent")) {
        redirectTo = "/subagent-dashboard";
      }

      toast({ title: "Welcome back!", description: "Redirecting..." });
      navigate(redirectTo, { replace: true });
    } else {
      toast({
        title: "Error",
        description: "Could not verify user role",
        variant: "destructive",
      });
    }
    
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!resetEmail.trim()) {
      toast({ title: "Error", description: "Please enter your email address", variant: "destructive" });
      return;
    }

    setSendingReset(true);
    // Must match exactly the Site URL domain in Supabase URL Configuration
    const appUrl = "https://dataplug.store";
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail.trim(), {
      redirectTo: `${appUrl}/reset-password`,
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

  // If already logged in, redirect based on roles
  useEffect(() => {
    const checkAndRedirect = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: rolesData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id);
        let route = "/";
        if (rolesData) {
          const roles = rolesData.map(r => String(r.role).trim().toLowerCase());
          if (roles.includes("admin")) route = "/admin";
          else if (roles.includes("agent")) route = "/agent";
          else if (roles.includes("sub_subagent")) route = "/sub-subagent-dashboard";
          else if (roles.includes("subagent")) route = "/subagent-dashboard";
        }
        navigate(route, { replace: true });
      }
    };
    checkAndRedirect();
  }, [navigate]);

  return (
    <>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4">
        <Card className="w-full max-w-md border-border shadow-xl">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="font-display text-2xl font-bold">Welcome Back</CardTitle>
            <CardDescription>Sign in to your DataPlug account</CardDescription>
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
                    className="text-xs text-primary hover:underline focus:outline-none"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
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

              <Button type="submit" variant="hero" className="w-full" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Sign In
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">or continue with</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center gap-2"
              onClick={handleGoogleLogin}
              disabled={googleLoading}
            >
              {googleLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
              Continue with Google
            </Button>

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Don't have an account?{" "}
              <Link to="/signup" className="text-primary hover:underline font-medium">
                Sign up
              </Link>
            </div>
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
              variant="hero"
              className="w-full"
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

export default Login;
