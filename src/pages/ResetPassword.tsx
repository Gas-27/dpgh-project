import { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { DOMAINS } from "@/config/domains";
import { Loader2, Lock, ShieldCheck, ShieldAlert, Eye, EyeOff, Check, X } from "lucide-react";

type Status = "verifying" | "ready" | "invalid";
type AccountKind = "agent" | "subagent" | "sub_subagent" | "user";

const VERIFY_TIMEOUT_MS = 8000;
const MIN_PASSWORD_LENGTH = 6;

const ACCOUNT_LABELS: Record<AccountKind, string> = {
    agent: "Agent account",
    subagent: "Subagent account",
    sub_subagent: "Sub-subagent account",
    user: "Account",
};

const detectAccountKind = async (userId: string): Promise<AccountKind> => {
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
    const roles = (data ?? []).map((row) => String(row.role).trim().toLowerCase().replace("-", "_"));
    if (roles.includes("sub_subagent")) return "sub_subagent";
    if (roles.includes("subagent")) return "subagent";
    if (roles.includes("agent")) return "agent";
    return "user";
};

const ResetPassword = () => {
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<Status>("verifying");
    const [accountKind, setAccountKind] = useState<AccountKind>("user");
    const [email, setEmail] = useState<string | null>(null);
    const navigate = useNavigate();
    const { toast } = useToast();
    const sessionReady = useRef(false);

    const isSubagentHost =
        window.location.hostname === DOMAINS.SUBAGENT_STORE ||
        window.location.hostname === `www.${DOMAINS.SUBAGENT_STORE}`;

    useEffect(() => {
        const url = new URL(window.location.href);
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));

        // Supabase reports expired/used links in the URL hash (and sometimes the query string).
        const linkError =
            url.searchParams.get("error_code") ||
            url.searchParams.get("error") ||
            hashParams.get("error_code") ||
            hashParams.get("error");
        if (linkError) {
            setStatus("invalid");
            return;
        }

        const markReady = (user: { id: string; email?: string | null }) => {
            if (sessionReady.current) return;
            sessionReady.current = true;
            setEmail(user.email ?? null);
            setStatus("ready");
            void detectAccountKind(user.id).then(setAccountKind);
        };

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session?.user) {
                markReady(session.user);
            }
        });

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) markReady(session.user);
        });

        // Without a valid recovery session the form can never work, so stop spinning.
        const timeout = window.setTimeout(() => {
            if (!sessionReady.current) setStatus("invalid");
        }, VERIFY_TIMEOUT_MS);

        return () => {
            window.clearTimeout(timeout);
            subscription.unsubscribe();
        };
    }, []);

    const checks = {
        length: password.length >= MIN_PASSWORD_LENGTH,
        match: password.length > 0 && password === confirmPassword,
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!checks.length) {
            toast({ title: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`, variant: "destructive" });
            return;
        }
        if (!checks.match) {
            toast({ title: "Passwords don't match", variant: "destructive" });
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.updateUser({ password });

        if (error) {
            toast({ title: "Reset failed", description: error.message, variant: "destructive" });
            setLoading(false);
            return;
        }

        toast({ title: "Password updated", description: "Sign in with your new password." });
        await supabase.auth.signOut();

        if (accountKind === "sub_subagent") {
            window.location.replace(DOMAINS.getSubSubagentLoginUrl());
        } else if (accountKind === "subagent") {
            window.location.replace(DOMAINS.getSubagentLoginUrl());
        } else {
            navigate("/login", { replace: true });
        }
    };

    const accent = isSubagentHost || accountKind === "subagent" || accountKind === "sub_subagent";
    const accentText = accent ? "text-emerald-500" : "text-primary";
    const accentBg = accent ? "bg-emerald-500/10" : "bg-primary/10";
    const accentButton = accent ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "";
    const wrapperClass = `min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background ${
        accent ? "to-emerald-500/5" : "to-primary/5"
    } px-4`;

    if (status === "verifying") {
        return (
            <div className={wrapperClass}>
                <Card className="w-full max-w-md border-border shadow-xl">
                    <CardHeader className="text-center">
                        <CardTitle>Verifying reset link</CardTitle>
                        <CardDescription>Please wait while we check your link.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex justify-center py-8">
                        <Loader2 className={`h-8 w-8 animate-spin ${accentText}`} />
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (status === "invalid") {
        return (
            <div className={wrapperClass}>
                <Card className="w-full max-w-md border-border shadow-xl">
                    <CardHeader className="space-y-1 text-center">
                        <div className="flex justify-center mb-2">
                            <div className="p-3 rounded-full bg-destructive/10">
                                <ShieldAlert className="h-8 w-8 text-destructive" />
                            </div>
                        </div>
                        <CardTitle className="font-display text-2xl font-bold">Link expired or invalid</CardTitle>
                        <CardDescription>
                            Reset links work once and expire quickly. Go back to the login page, tap
                            &quot;Forgot password?&quot; and we will email you a fresh link.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3">
                        {isSubagentHost ? (
                            <>
                                <Button asChild className={`w-full ${accentButton}`}>
                                    <Link to="/login">Subagent login</Link>
                                </Button>
                                <Button asChild variant="outline" className="w-full">
                                    <Link to="/sub-subagent-login">Sub-subagent login</Link>
                                </Button>
                            </>
                        ) : (
                            <Button asChild className="w-full">
                                <Link to="/login">Back to login</Link>
                            </Button>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className={wrapperClass}>
            <Card className="w-full max-w-md border-border shadow-xl">
                <CardHeader className="space-y-1 text-center">
                    <div className="flex justify-center mb-2">
                        <div className={`p-3 rounded-full ${accentBg}`}>
                            <ShieldCheck className={`h-8 w-8 ${accentText}`} />
                        </div>
                    </div>
                    <CardTitle className="font-display text-2xl font-bold">Set a new password</CardTitle>
                    <CardDescription>
                        {ACCOUNT_LABELS[accountKind]}
                        {email ? ` · ${email}` : ""}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="password">New password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="********"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10 pr-10"
                                    autoComplete="new-password"
                                    required
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword((v) => !v)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="confirm">Confirm password</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="confirm"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="********"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="pl-10"
                                    autoComplete="new-password"
                                    required
                                />
                            </div>
                        </div>

                        <ul className="space-y-1 text-sm" aria-live="polite">
                            <li className={`flex items-center gap-2 ${checks.length ? accentText : "text-muted-foreground"}`}>
                                {checks.length ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                At least {MIN_PASSWORD_LENGTH} characters
                            </li>
                            <li className={`flex items-center gap-2 ${checks.match ? accentText : "text-muted-foreground"}`}>
                                {checks.match ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                                Both passwords match
                            </li>
                        </ul>

                        <Button
                            type="submit"
                            variant={accent ? "default" : "hero"}
                            className={`w-full ${accentButton}`}
                            disabled={loading || !checks.length || !checks.match}
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                            Update password
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default ResetPassword;
