import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Zap, User, Store } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"user" | "agent">("user");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role },
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Signup failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Account created!", description: "Welcome to Dataplug!" });
      if (role === "agent") {
        navigate("/agent-onboarding");
      } else {
        navigate("/");
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
              DATAPLUG
            </span>
          </div>
          <CardTitle className="font-display">Create Account</CardTitle>
          <CardDescription>Choose your account type to get started</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Role Selection */}
          <div className="grid grid-cols-2 gap-3 mb-6">
            <button
              type="button"
              onClick={() => setRole("user")}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                role === "user"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-muted-foreground"
              }`}
            >
              <User className="h-6 w-6" />
              <span className="text-sm font-semibold">User</span>
              <span className="text-xs text-center">Buy data bundles</span>
            </button>
            <button
              type="button"
              onClick={() => setRole("agent")}
              className={`flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all ${
                role === "agent"
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border text-muted-foreground hover:border-muted-foreground"
              }`}
            >
              <Store className="h-6 w-6" />
              <span className="text-sm font-semibold">Agent</span>
              <span className="text-xs text-center">Sell & earn profit</span>
              <span className="text-xs text-center">You also get data prices cheaper than normal user</span>
            </button>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
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
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
            </div>
            <Button type="submit" variant="hero" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : `Sign Up as ${role === "agent" ? "Agent" : "User"}`}
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
