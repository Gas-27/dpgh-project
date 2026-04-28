import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

serve(async (req: Request) => {
    try {
        const { storeName, amount, contact, momoName, walletBalance } = await req.json();

        const emailHtml = `
      <h2>💰 New Withdrawal Request</h2>
      <table style="border-collapse: collapse; width: 100%;">
        <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Store Name</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${storeName}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Withdrawal Amount</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong style="color: #e67e22;">GH₵ ${amount.toFixed(2)}</strong></td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Current Wallet Balance</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">GH₵ ${walletBalance.toFixed(2)}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>MoMo Name</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${momoName}</td></tr>
        <tr><td style="padding: 8px; border-bottom: 1px solid #ddd;"><strong>Contact (WhatsApp/MoMo)</strong></td><td style="padding: 8px; border-bottom: 1px solid #ddd;">${contact}</td></tr>
      </table>
      <p style="margin-top: 20px;">Log into the admin dashboard to process this withdrawal.</p>
    `;

        const { error } = await resend.emails.send({
            from: "onboarding@resend.dev",
            to: ["georgeagyemangsakyi27@gmail.com"],
            subject: `Withdrawal request from ${storeName} – GH₵ ${amount.toFixed(2)}`,
            html: emailHtml,
        });

        if (error) throw error;
        return new Response(JSON.stringify({ success: true }), { status: 200 });
    } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(errorMessage);
        return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
    }
});