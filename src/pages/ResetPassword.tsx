import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Lock, CheckCircle, Eye, EyeOff } from "lucide-react";

const ResetPassword = () => {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [validSession, setValidSession] = useState(false);
    const navigate = useNavigate();
    const { toast } = useToast();

    useEffect(() => {
        // ONLY treat this page as valid when Supabase fires PASSWORD_RECOVERY.
        // Any other auth event (e.g. SIGNED_IN from Google OAuth) must be
        // routed away so Google sign-in users are never stuck on this page.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (event === "PASSWORD_RECOVERY") {
                    // Valid password-reset flow — show the form
                    setValidSession(true);
                } else if (event === "SIGNED_IN" && session) {
                    // A normal sign-in landed here (e.g. Google OAuth when Site URL
                    // is misconfigured). Route them to their correct dashboard.
                    const { data: rolesData } = await supabase
                        .from("user_roles")
                        .select("role")
                        .eq("user_id", session.user.id);
                    const roles = (rolesData ?? []).map((r: any) => r.role);
                    if (roles.includes("admin")) {
                        navigate("/only-admin/log.in", { replace: true });
                    } else if (roles.includes("agent")) {
                        navigate("/agent", { replace: true });
                    } else if (roles.includes("subagent")) {
                        navigate("/subagent-dashboard", { replace: true });
                    } else {
                        navigate("/user-dashboard", { replace: true });
                    }
                }
            }
        );

        // Also check URL params — if there is a `code` param but no
        // PASSWORD_RECOVERY event, this is a Google OAuth callback that
        // landed here due to Site URL misconfiguration. Exchange the code
        // and redirect immediately.
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const errorCode = url.searchParams.get("error_code");

        if (errorCode) {
            // bad_oauth_state or similar — just go to login
            navigate("/login", { replace: true });
            return;
        }

        if (code) {
            supabase.auth.exchangeCodeForSession(code).then(async ({ data, error }) => {
                if (error || !data.session) {
                    toast({
                        title: "Invalid or expired link",
                        description: "Please request a new password reset link.",
                        variant: "destructive",
                    });
                    navigate("/login", { replace: true });
                    return;
                }
                // If this was a PASSWORD_RECOVERY token the onAuthStateChange
                // above will fire and set validSession — don't redirect away.
                // For any other sign-in type (Google OAuth), route to dashboard.
                // We detect this by checking if the URL came from a reset email
                // (Supabase appends type=recovery to the URL for reset flows).
                const type = url.searchParams.get("type");
                if (type !== "recovery") {
                    const { data: rolesData } = await supabase
                        .from("user_roles")
                        .select("role")
                        .eq("user_id", data.session.user.id);
                    const roles = (rolesData ?? []).map((r: any) => r.role);
                    if (roles.includes("admin")) {
                        navigate("/only-admin/log.in", { replace: true });
                    } else if (roles.includes("agent")) {
                        navigate("/agent", { replace: true });
                    } else if (roles.includes("subagent")) {
                        navigate("/subagent-dashboard", { replace: true });
                    } else {
                        navigate("/user-dashboard", { replace: true });
                    }
                }
            });
        }

        return () => { subscription.unsubscribe(); };
    }, [navigate, toast]);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validSession) {
            toast({ title: "Session expired", description: "Please request a new reset link.", variant: "destructive" });
            navigate("/login");
            return;
        }

        if (password !== confirmPassword) {
            toast({ title: "Passwords don't match", variant: "destructive" });
            return;
        }

        if (password.length < 6) {
            toast({ title: "Password must be at least 6 characters", variant: "destructive" });
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.updateUser({ password });

        if (error) {
            toast({
                title: "Reset failed",
                description: error.message,
                variant: "destructive",
            });
        } else {
            toast({
                title: "Password updated!",
                description: "You can now sign in with your new password.",
            });
            await supabase.auth.signOut();
            navigate("/login");
        }
        setLoading(false);
    };

    if (!validSession) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4">
                <Card className="w-full max-w-md border-border shadow-xl">
                    <CardHeader>
                        <CardTitle>Verifying reset link...</CardTitle>
                        <CardDescription>Please wait while we check your link.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4">
            <Card className="w-full max-w-md border-border shadow-xl">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                        Set new password
                    </CardTitle>
                    <CardDescription>
                        Your identity has been verified. Choose a strong new password.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                        {/* New Password Field */}
                        <div className="space-y-2">
                            <Label htmlFor="password">New Password</Label>
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
                                    autoFocus
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

                        {/* Confirm Password Field */}
                        <div className="space-y-2">
                            <Label htmlFor="confirm">Confirm Password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="confirm"
                                    type={showConfirmPassword ? "text" : "password"}
                                    placeholder="••••••••"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="pl-10 pr-10"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <Button type="submit" variant="hero" className="w-full" disabled={loading}>
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                            Update Password
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default ResetPassword;
