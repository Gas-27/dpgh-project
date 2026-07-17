import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Zap, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [userType, setUserType] = useState<"agent" | "customer">("agent");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role: userType },
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Signup failed", description: error.message, variant: "destructive" });
    } else {
      // Safety check: verify new user is not an admin
      if (data.user?.id) {
        const { data: rolesData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id);
        
        if (rolesData?.some(r => r.role === "admin")) {
          await supabase.auth.signOut();
          toast({ 
            title: "Access Denied", 
            description: "Admin accounts cannot be created through signup", 
            variant: "destructive" 
          });
          return;
        }
      }
      
      toast({ title: "Account created!", description: "Welcome to Data Plug STORE!" });
      if (userType === "agent") {
        navigate("/agent-onboarding");
      } else {
        navigate("/user-dashboard");
      }
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Zap className="h-8 w-8 text-primary" />
            <span className="font-display text-2xl font-bold">
              DATA PLUG <span className="text-primary">STORE</span>
            </span>
          </div>
          <CardTitle className="font-display">Create Account</CardTitle>
          <CardDescription>Sign up to get started with Data Plug STORE</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label>Account Type</Label>
              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => setUserType("customer")}
                  aria-pressed={userType === "customer"}
                  className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
                    userType === "customer"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                      userType === "customer" ? "border-primary" : "border-muted-foreground"
                    }`}
                  >
                    {userType === "customer" && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                  </span>
                  <span>
                    <span className="block font-semibold">User</span>
                    <span className="block text-xs text-muted-foreground">Buy data for yourself at regular prices</span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setUserType("agent")}
                  aria-pressed={userType === "agent"}
                  className={`flex items-start gap-3 rounded-lg border p-4 text-left transition-colors ${
                    userType === "agent"
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-2 ${
                      userType === "agent" ? "border-primary" : "border-muted-foreground"
                    }`}
                  >
                    {userType === "agent" && <span className="h-2.5 w-2.5 rounded-full bg-primary" />}
                  </span>
                  <span>
                    <span className="block font-semibold">Agent</span>
                    <span className="block text-xs text-muted-foreground">
                      Get your own store with discounted agent prices, set your own prices, and recruit agents &amp; subagents. You&apos;ll complete store setup after signing up.
                    </span>
                  </span>
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  minLength={6}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" variant="hero" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Sign Up"}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;
