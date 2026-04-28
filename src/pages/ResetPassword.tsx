import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";   // 🆕 import the auth hook
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, KeyRound, Mail, CheckCircle2, AlertCircle, ShieldAlert } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ResetPassword = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { isAdmin } = useAuth();   // 🆕 admin check

    // ====== Token detection (for users from email) ======
    const [hasToken, setHasToken] = useState(false);
    const [tokenError, setTokenError] = useState("");

    // New password fields (when token is valid)
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [updating, setUpdating] = useState(false);
    const [success, setSuccess] = useState(false);

    // Admin email‑sending fields
    const [email, setEmail] = useState("");
    const [sending, setSending] = useState(false);
    const [emailSent, setEmailSent] = useState(false);

    // 1. On page load, check for tokens in URL hash → set session
    useEffect(() => {
        const hash = window.location.hash;
        if (hash) {
            const params = new URLSearchParams(hash.substring(1));
            const access_token = params.get("access_token");
            const refresh_token = params.get("refresh_token");

            if (access_token) {
                supabase.auth.setSession({ access_token, refresh_token: refresh_token ?? undefined })
                    .then(({ error }) => {
                        if (error) setTokenError(error.message);
                        else setHasToken(true);
                    });
            } else {
                setTokenError("Missing access token.");
            }
        }
    }, []);

    // 2. Update password (when user arrived via reset link)
    const handlePasswordSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            toast({ title: "Passwords do not match", variant: "destructive" });
            return;
        }
        if (password.length < 6) {
            toast({ title: "Password must be at least 6 characters", variant: "destructive" });
            return;
        }

        setUpdating(true);
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
            setTokenError(error.message);
            toast({ title: "Update failed", description: error.message, variant: "destructive" });
        } else {
            setSuccess(true);
            toast({ title: "Password updated!", description: "Redirecting to login..." });
            await supabase.auth.signOut();
            setTimeout(() => navigate("/login"), 1500);
        }
        setUpdating(false);
    };

    // 3. Admin sends reset email
    const handleSendEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim()) return;

        setSending(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
            redirectTo: `${window.location.origin}/reset-password`,
        });

        if (error) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } else {
            setEmailSent(true);
            toast({ title: "Email sent!", description: `Reset link sent to ${email}` });
        }
        setSending(false);
    };

    // ====== Render ======

    // Step for user with valid token (set new password)
    if (hasToken && !success) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <KeyRound className="h-10 w-10 text-primary mx-auto mb-2" />
                        <CardTitle>Set New Password</CardTitle>
                        <CardDescription>Enter your new password below</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handlePasswordSubmit} className="space-y-4">
                            <div className="space-y-2">
                                <Label>New Password</Label>
                                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min. 6 characters" required autoFocus />
                            </div>
                            <div className="space-y-2">
                                <Label>Confirm Password</Label>
                                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" required />
                            </div>
                            <Button type="submit" variant="hero" className="w-full" disabled={updating}>
                                {updating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                                Update Password
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Success after password update
    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <CheckCircle2 className="h-10 w-10 text-green-500 mx-auto mb-2" />
                        <CardTitle>Password Updated!</CardTitle>
                        <CardDescription>Redirecting to login page...</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    // Invalid token error
    if (tokenError) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <AlertCircle className="h-10 w-10 text-destructive mx-auto mb-2" />
                        <CardTitle>Invalid Link</CardTitle>
                        <CardDescription>{tokenError}</CardDescription>
                    </CardHeader>
                </Card>
            </div>
        );
    }

    // ====== Default view (no token) ======
    // ADMIN: show email sending form
    if (isAdmin) {
        if (emailSent) {
            return (
                <div className="min-h-screen flex items-center justify-center p-4">
                    <Card className="w-full max-w-md">
                        <CardHeader className="text-center">
                            <Mail className="h-10 w-10 text-primary mx-auto mb-2" />
                            <CardTitle>Check That Email</CardTitle>
                            <CardDescription>A reset link was sent to <strong>{email}</strong>.</CardDescription>
                        </CardHeader>
                        <CardContent className="flex justify-center">
                            <Button variant="outline" onClick={() => { setEmail(""); setEmailSent(false); }}>Send Another</Button>
                        </CardContent>
                    </Card>
                </div>
            );
        }

        return (
            <div className="min-h-screen flex items-center justify-center p-4">
                <Card className="w-full max-w-md">
                    <CardHeader className="text-center">
                        <ShieldAlert className="h-10 w-10 text-primary mx-auto mb-2" />
                        <CardTitle>Admin: Reset User Password</CardTitle>
                        <CardDescription>Enter a user’s email to send them a password‑reset link.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSendEmail} className="space-y-4">
                            <div className="space-y-2">
                                <Label>User Email</Label>
                                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" required autoFocus />
                            </div>
                            <Button type="submit" variant="hero" className="w-full" disabled={sending}>
                                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                                Send Reset Link
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // NOT ADMIN: no token → tell them to contact admin
    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <AlertCircle className="h-10 w-10 text-yellow-500 mx-auto mb-2" />
                    <CardTitle>Access Denied</CardTitle>
                    <CardDescription>
                        Please contact your administrator to reset your password.
                    </CardDescription>
                </CardHeader>
            </Card>
        </div>
    );
};

export default ResetPassword;