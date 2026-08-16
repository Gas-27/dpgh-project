import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Upload } from "lucide-react";

type SmsComposerProps = { ownerType: "customer" | "agent"; ownerId?: string; };

export default function SmsComposer({ ownerType, ownerId }: SmsComposerProps) {
  const { toast } = useToast();
  const [recipients, setRecipients] = useState("");
  const [senderId, setSenderId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const count = useMemo(() => recipients.split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean).length, [recipients]);
  const importCsv = (file: File) => { const reader = new FileReader(); reader.onload = () => setRecipients(String(reader.result || "").split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean).join("\n")); reader.readAsText(file); };
  const send = async () => {
    if (!senderId.trim() || !message.trim() || !count) { toast({ title: "Complete the SMS form", description: "Add a sender ID, message, and at least one recipient.", variant: "destructive" }); return; }
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("txtconnect-sms", { body: { action: "send", owner_type: ownerType, owner_id: ownerId, recipients: recipients.split(/[\n,;]+/).map((value) => value.trim()).filter(Boolean), sender_id: senderId.trim(), message: message.trim() } });
    setLoading(false);
    if (error || data?.error) { toast({ title: "SMS was not sent", description: data?.error || error?.message || "Please try again.", variant: "destructive" }); return; }
    toast({ title: "SMS sent", description: `${count} recipient${count === 1 ? "" : "s"} processed successfully.` }); setRecipients(""); setMessage("");
  };
  return <Card className="border-primary/20"><CardHeader><CardTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-primary" /> Send SMS</CardTitle><p className="text-sm text-muted-foreground">Send one message or paste multiple recipients. Charges apply per recipient from your wallet.</p></CardHeader><CardContent className="space-y-4"><div className="grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label htmlFor={`${ownerType}-sms-sender`}>Sender ID</Label><Input id={`${ownerType}-sms-sender`} value={senderId} onChange={(event) => setSenderId(event.target.value)} placeholder="Your approved sender name" maxLength={11} /></div><div className="space-y-2"><Label>Recipients ({count})</Label><div className="flex gap-2"><Input value={recipients} onChange={(event) => setRecipients(event.target.value)} placeholder="233241234567, 233201234567" /><label className="inline-flex cursor-pointer items-center justify-center rounded-md border px-3"><Upload className="h-4 w-4" /><input type="file" accept=".csv,.txt" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) importCsv(file); }} /></label></div></div></div><div className="space-y-2"><Label htmlFor={`${ownerType}-sms-message`}>Message</Label><Textarea id={`${ownerType}-sms-message`} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write your message..." maxLength={1000} rows={5} /><p className="text-right text-xs text-muted-foreground">{message.length}/1000</p></div><Button onClick={() => void send()} disabled={loading} className="w-full">{loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Send to {count || "recipients"}</Button></CardContent></Card>;
}
