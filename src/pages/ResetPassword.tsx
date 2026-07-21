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
        // If this page receives a SIGNED_IN event (e.g. Google OAuth landed
        // here because of a misconfigured Supabase Site URL), route the user
        // to their correct dashboard immediately.
        // Only activate the reset form on PASSWORD_RECOVERY.
        const routeToDashboard = async (userId: string) => {
            const { data: rolesData } = await supabase
                .from("user_roles")
                .select("role")
                .eq("user_id", userId);
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
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (event === "PASSWORD_RECOVERY") {
                    setValidSession(true);
                } else if (event === "SIGNED_IN" && session?.user) {
                    routeToDashboard(session.user.id);
                }
            }
        );

        // Also check for any error params in URL (bad_oauth_state etc.)
        const url = new URL(window.location.href);
        if (url.searchParams.get("error_code")) {
            navigate("/login", { replace: true });
            return;
        }

        // If there is already an active session but no PASSWORD_RECOVERY event
        // (meaning the user navigated here directly while logged in), route away.
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user && !url.hash.includes("type=recovery") && !url.searchParams.get("type")) {
                routeToDashboard(session.user.id);
            }
        });

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
