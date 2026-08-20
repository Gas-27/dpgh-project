import { useEffect, useMemo, useRef, useState } from "react";
import { createWorker } from "tesseract.js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Check, ChevronDown, Clock, Loader2, Send, Sparkles, Upload, UserPlus, Video, Wallet } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import OrderContactPicker from "@/components/OrderContactPicker";

type SmsComposerProps = { ownerType: "customer" | "agent" | "subagent" | "subsubagent"; ownerId?: string; storeUrl?: string; publicMode?: boolean };
type Sender = {
  id: string;
  sender_id: string;
  status: "pending" | "approved" | "rejected";
  is_global?: boolean;
  created_at?: string;
  reviewed_at?: string | null;
  phone_number?: string | null;
};

const PAGE_SIZE = 160;
const CONTACT_PRICE = 0.09;
const PAGE_PRICE = 2.00;

/**
 * Smart Ghana phone number normalizer.
 * Handles +233 / 233 / 00233 country codes, spaces, dashes, brackets, and
 * missing leading zero. Returns a clean 10-digit local number (0XXXXXXXXX) or null.
 */
const normalizeGh = (raw: string): string | null => {
  let d = (raw || "").replace(/\D/g, "");
  if (!d) return null;
  // Strip country code variants -> local leading zero
  if (d.startsWith("00233")) d = "0" + d.slice(5);
  else if (d.startsWith("233") && d.length >= 12) d = "0" + d.slice(3);
  // A 9-digit number missing its leading zero (e.g. 241234567)
  if (d.length === 9 && /^[2-5]/.test(d)) d = "0" + d;
  // If OCR glued extra leading digits, try to recover a trailing valid number
  if (d.length > 10) {
    const tail10 = d.slice(-10);
    const tail9 = d.slice(-9);
    if (/^0[2-5]\d{8}$/.test(tail10)) d = tail10;
    else if (/^[2-5]\d{8}$/.test(tail9)) d = "0" + tail9;
  }
  return /^0[2-5]\d{8}$/.test(d) ? d : null;
};

/** Extract every valid Ghana number from a free-form blob of text / OCR output. */
const extractNumbers = (text: string): string[] => {
  // Keep each candidate bounded to a Ghana local number or country-code number;
  // this prevents OCR from joining adjacent WhatsApp numbers into one value.
  const chunks = text.match(/(?:\+?233|00233|0)?(?:[\s.\-()]*\d){9,10}/g) || [];
  const out = new Set<string>();
  for (const chunk of chunks) {
    const n = normalizeGh(chunk);
    if (n) out.add(n);
  }
  return Array.from(out);
};

/** Convert common video links (YouTube/Vimeo) into an embeddable URL. */
const preprocessScreenshot = async (file: File): Promise<HTMLCanvasElement> => {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(3, Math.max(1.5, 1800 / bitmap.width));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return canvas;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const image = context.getImageData(0, 0, canvas.width, canvas.height);
  for (let index = 0; index < image.data.length; index += 4) {
    const gray = (image.data[index] * 0.299) + (image.data[index + 1] * 0.587) + (image.data[index + 2] * 0.114);
    const contrast = Math.max(0, Math.min(255, ((gray - 128) * 1.45) + 128));
    image.data[index] = contrast;
    image.data[index + 1] = contrast;
    image.data[index + 2] = contrast;
  }
  context.putImageData(image, 0, 0);
  bitmap.close();
  return canvas;
};

const toEmbedUrl = (url: string): string => {
  const yt = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vimeo = url.match(/vimeo\.com\/(\d+)/);
  if (vimeo) return `https://player.vimeo.com/video/${vimeo[1]}`;
  return url;
};

export default function SmsComposer({ ownerType, ownerId, storeUrl: providedStoreUrl, publicMode = false }: SmsComposerProps) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [recipients, setRecipients] = useState("");
  const [senderId, setSenderId] = useState("");
  const [message, setMessage] = useState("");
  const [senders, setSenders] = useState<Sender[]>([]);
  const [senderOpen, setSenderOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const [senderPhone, setSenderPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [unitPrice, setUnitPrice] = useState(0.05);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoOpen, setVideoOpen] = useState(true);
  const [senderSearch, setSenderSearch] = useState("");
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResults, setLookupResults] = useState<Sender[]>([]);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [storeLink, setStoreLink] = useState(providedStoreUrl || "");
  const [includeStoreLink, setIncludeStoreLink] = useState(false);
  const [generationType, setGenerationType] = useState("promotion");
  const [aiBrief, setAiBrief] = useState("");
  const [generating, setGenerating] = useState(false);

  const numbers = useMemo(() => extractNumbers(recipients), [recipients]);
  const messageUnits = useMemo(() => Array.from(message).reduce((total, character) => total + (character.codePointAt(0)! > 0xffff ? 2 : 1), 0), [message]);
  const pages = useMemo(() => Math.max(1, Math.ceil(messageUnits / PAGE_SIZE)), [messageUnits]);
  const charsOnPage = messageUnits % PAGE_SIZE === 0 && messageUnits > 0 ? PAGE_SIZE : messageUnits % PAGE_SIZE;
  const remaining = PAGE_SIZE - charsOnPage;
  const totalCost = CONTACT_PRICE * numbers.length + PAGE_PRICE * pages;

  const loadSenders = async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    const { data } = await supabase
      .from("sms_sender_ids")
      .select("id,sender_id,status,is_global,user_id")
      .or(`is_global.eq.true${uid ? `,user_id.eq.${uid}` : ""}`)
      .order("created_at", { ascending: false });
    // Only official (global) sender IDs are shared with everyone; a personal
    // sender ID is only visible to the user who requested it.
    const seen = new Set<string>();
    const list: Sender[] = [];
    for (const row of (data || []) as Sender[]) {
      if (!row.is_global && row.user_id !== uid) continue;
      const key = row.sender_id.toUpperCase();
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(row);
    }
    setSenders(list);
  };

  const lookupSenderIds = async () => {
    const phone = normalizeGh(lookupPhone);
    if (!phone) {
      toast({ title: "Enter a valid phone number", description: "Use a Ghana number such as 0241234567 or +233241234567.", variant: "destructive" });
      return;
    }
    setLookupLoading(true);
    setLookupResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("txtconnect-sms", { body: { action: "sender_lookup", phone } });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Lookup failed");
      setLookupResults((data?.senders || []) as Sender[]);
      if (!data?.senders?.length) toast({ title: "No sender IDs found", description: "No sender IDs match that phone number." });
    } catch {
      toast({ title: "Lookup failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setLookupLoading(false);
    }
  };

  const loadWalletAndStore = async () => {
    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) { setWalletBalance(null); return; }
    const normalizedOwnerType = ownerType === "customer" ? "customer" : ownerType;
    const table = normalizedOwnerType === "agent" ? "agent_stores" : normalizedOwnerType === "subagent" ? "subagent_stores" : normalizedOwnerType === "subsubagent" ? "sub_subagent_stores" : "customers";
    let balance: number | null = null;
    if (ownerId && normalizedOwnerType !== "customer") {
      const { data: ownerStore } = await supabase.from(table).select("wallet_balance").eq("id", ownerId).maybeSingle();
      if (ownerStore) balance = Number(ownerStore.wallet_balance ?? 0);
    }
    if (balance === null) {
      const { data: bal } = await supabase.rpc("get_sms_wallet", { p_user_id: uid, p_owner_type: normalizedOwnerType });
      balance = Number(bal ?? 0);
    }
    setWalletBalance(balance);
    if (providedStoreUrl) {
      setStoreLink(providedStoreUrl);
      return;
    }
    if (ownerType === "customer") {
      setStoreLink("https://dataplug.store/packages");
      return;
    }
    const ownerTable = ownerType === "agent" ? "agent_stores" : ownerType === "subagent" ? "subagent_stores" : "sub_subagent_stores";
    const query = ownerId
      ? supabase.from(ownerTable).select("store_name_slug,id").eq("id", ownerId).maybeSingle()
      : supabase.from(ownerTable).select("store_name_slug,id").eq("user_id", uid).maybeSingle();
    const { data } = await query;
    if (data) setStoreLink(`https://dataplug.store/store/${data.store_name_slug || data.id}`);
  };

  const loadSettings = async () => {
    const { data } = await supabase.from("sms_settings").select("unit_price,video_url").eq("id", true).maybeSingle();
    if (data) {
      setUnitPrice(Number(data.unit_price ?? 0.05));
      setVideoUrl((data as { video_url?: string | null }).video_url ?? null);
    }
  };

  useEffect(() => {
  void loadSenders();
  void loadSettings();
  void loadWalletAndStore();
  }, [ownerType, ownerId, providedStoreUrl]);

  useEffect(() => {
    if (!publicMode || !new URLSearchParams(window.location.search).has("sms_payment")) return;
    const reference = sessionStorage.getItem("pending_sms_payment");
    if (!reference) return;
    sessionStorage.removeItem("pending_sms_payment");
    toast({ title: "SMS payment successful", description: "Your SMS will be delivered shortly, usually within 2 minutes to 1 hour." });
  }, [publicMode, toast]);

  const submitSender = async () => {
    const value = custom.trim().toUpperCase();
    if (!/^[A-Z0-9 ]{3,11}$/.test(value)) {
      toast({ title: "Invalid sender ID", description: "Use 3-11 letters, numbers, or spaces.", variant: "destructive" });
      return;
    }
  const phone = normalizeGh(senderPhone);
  if (!phone) {
    toast({ title: "Phone number required", description: "Enter the Ghana number that should own this sender ID.", variant: "destructive" });
    return;
  }
  setSubmitting(true);
  let data: any = null;
  let error: any = null;
  if (publicMode) {
    const direct = await supabase.from("sms_sender_ids").insert({ user_id: null, sender_id: value, phone_number: phone, status: "pending", is_global: false }).select("id,sender_id,status,created_at").single();
    data = direct.data;
    error = direct.error;
    if (error) {
      const result = await supabase.functions.invoke("txtconnect-sms", { body: { action: "submit_sender", sender_id: value, phone } });
      data = result.data?.sender;
      error = result.error || (result.data?.error ? new Error(result.data.error) : null);
    }
  } else {
    const result = await supabase.from("sms_sender_ids").insert({ user_id: (await supabase.auth.getUser()).data.user?.id, sender_id: value, phone_number: phone });
    data = result.data;
    error = result.error;
  }
  setSubmitting(false);
  if (error || data?.error) {
      toast({ title: "Could not submit sender ID", description: error.message, variant: "destructive" });
      return;
    }
    setCustom("");
    setModalOpen(false);
    await loadSenders();
    toast({
      title: "Submitted for approval",
      description: `${value} is now pending approval from the network provider.`,
    });
  };

  const extractScreenshots = async (files: FileList) => {
    setOcrLoading(true);
    try {
      const worker = await createWorker("eng");
      let found = 0;
      let combined = recipients;
      for (const file of Array.from(files)) {
        let text = "";
        if (file.type.startsWith("image/")) {
          const prepared = await preprocessScreenshot(file);
          const result = await worker.recognize(prepared);
          text = result.data.text;
        } else if (/\.(txt|csv|tsv)$/i.test(file.name) || file.type.includes("text") || file.type.includes("csv")) {
          text = await file.text();
        }
        const extracted = extractNumbers(text);
        found += extracted.length;
        combined = extractNumbers(`${combined},${extracted.join(",")}`).join(",");
      }
      await worker.terminate();
      if (!found) {
        toast({ title: "No phone numbers found", description: "Try clearer screenshots with the numbers visible." });
      } else {
        setRecipients(combined);
        toast({ title: "Contacts extracted", description: `${extractNumbers(combined).length} unique number(s) ready.` });
      }
    } catch {
      toast({ title: "Screenshot extraction failed", description: "Please try another image.", variant: "destructive" });
    } finally {
      setOcrLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const generateMessage = async () => {
    setGenerating(true);
    try {
      const brief = aiBrief.trim() || generationType;
      const aiResponse = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Write one polished SMS for ${generationType}. User brief: ${brief}. Keep it under 160 characters. Return only the SMS text, without quotes or explanation.${publicMode || !storeLink ? " Do not include a link." : ` Include this link exactly once: ${storeLink}`}`,
          conversation: [],
        }),
      });
      const aiData = await aiResponse.json().catch(() => ({}));
      if (!aiResponse.ok || !aiData.reply) throw new Error(aiData.error || "The main AI service could not generate a message");
      const generatedText = aiData.reply;
      const generated = String(generatedText || "").trim()
    .replace(/\[store\s*name\]|\[your\s*store\s*name\]|\[store\s*link\]/gi, "")
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  const generatedWithLink = includeStoreLink && storeLink
    ? `${generated} ${storeLink}`.trim()
    : generated;
  setMessage(generatedWithLink.slice(0, 640));
  toast({ title: "Message generated", description: includeStoreLink && storeLink ? "Your store link was added after the message." : "Review the message before sending." });
    } catch (error) {
      toast({ title: "Could not generate message", description: error instanceof Error ? error.message : "Please try again.", variant: "destructive" });
    } finally { setGenerating(false); }
  };

  const send = async () => {
    if (!senderId || !message.trim() || !numbers.length) {
      toast({ title: "Complete the SMS form", description: "Choose an approved sender, add recipients, and write a message.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const cleanMessage = message.trim()
      .replace(/https?:\/\/\S+/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
    const outgoingMessage = includeStoreLink && storeLink
      ? `${cleanMessage} ${storeLink}`.trim()
      : cleanMessage;
    if (publicMode) {
      const email = `sms-${numbers[0]}@dataplug.store`;
      const { data: payment, error: paymentError } = await supabase.functions.invoke("initialize-payment", { body: { phone: numbers[0], amount: totalCost, callback_url: `${window.location.origin}${window.location.pathname}?payment=verifying&sms_payment=success`, metadata: { type: "sms_campaign", recipients: numbers, sender_id: senderId, message: outgoingMessage, owner_type: "customer", owner_id: null } } });
      setLoading(false);
      let paymentDetails = payment?.error || paymentError?.message || "Could not start Paystack payment.";
      if (paymentError?.context) { try { const body = await paymentError.context.clone().json(); paymentDetails = body?.error || paymentDetails; } catch { /* keep the generic message */ } }
      if (paymentError || payment?.error || !payment?.authorization_url) { toast({ title: "Payment unavailable", description: paymentDetails, variant: "destructive" }); return; }
      sessionStorage.setItem("pending_sms_payment", payment.reference);
      window.location.assign(payment.authorization_url);
      return;
    }
    const { data: sessionData, error: sessionError } = await supabase.auth.refreshSession();
    if (sessionError || !sessionData.session?.access_token) {
      setLoading(false);
      toast({ title: "Sign-in session expired", description: "Please sign in again before sending SMS.", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase.functions.invoke("txtconnect-sms", {
      body: { action: "send", owner_type: ownerType, owner_id: ownerId, recipients: numbers, sender_id: senderId, message: outgoingMessage },
      headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
    });
    setLoading(false);
  if (error || data?.error) {
    let contextDetails = "";
    try { contextDetails = error?.context ? await error.context.clone().text() : ""; } catch { /* provider response may not be readable */ }
    let parsedContext: any = null;
    try { parsedContext = contextDetails ? JSON.parse(contextDetails) : null; } catch { /* keep raw context */ }
    const providerDetails = data?.provider_response?.map?.((item: any) => item?.body?.msg || item?.body?.message || item?.body?.error).filter(Boolean).join("; ");
    const authFailure = data?.error === "Authentication required" || parsedContext?.error === "Authentication required";
    toast({ title: authFailure ? "Sign-in session expired" : "SMS was not sent", description: authFailure ? "Please sign out and sign in again before sending SMS." : data?.error || parsedContext?.error || providerDetails || contextDetails || error?.message || "Please try again.", variant: "destructive" });
      return;
    }
    toast({ title: "SMS sent", description: `${data.sent || numbers.length} recipient(s) processed - ${data.pages || pages} page(s) each.` });
    setRecipients("");
    setMessage("");
  };

  const approved = senders.filter((item) => item.status === "approved" && item.sender_id.toLowerCase().includes(senderSearch.toLowerCase())).sort((a, b) => Number(Boolean(b.is_global)) - Number(Boolean(a.is_global)));
  const pending = senders.filter((item) => item.status === "pending");

  return (
    <div className="space-y-6">
      {videoUrl && (
        <Card className="border-primary/20 overflow-hidden">
          <CardHeader className="pb-3">
            <Button type="button" variant="ghost" className="w-full justify-between px-0" onClick={() => setVideoOpen((open) => !open)} aria-expanded={videoOpen}>
              <span className="flex items-center gap-2"><Video className="h-5 w-5 text-primary" />How to send SMS</span>
              <ChevronDown className={`h-5 w-5 transition-transform ${videoOpen ? "rotate-180" : ""}`} />
            </Button>
          </CardHeader>
          {videoOpen && (
            <CardContent>
              <div className="relative w-full overflow-hidden rounded-lg border bg-muted" style={{ paddingTop: "56.25%" }}>
                <iframe
                  src={toEmbedUrl(videoUrl)}
                  title="SMS tutorial video"
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </CardContent>
          )}
        </Card>
      )}

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5 text-primary" />
            Send SMS
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Send to one or many contacts. SMS charges are deducted per recipient, per page.
          </p>
          {!publicMode && <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
            <Wallet className="h-5 w-5 text-primary" />
            <div><p className="text-xs text-muted-foreground">Wallet balance</p><p className="font-semibold">GHS {walletBalance === null ? "—" : walletBalance.toFixed(2)}</p></div>
          </div>}
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Sender ID */}
  <div className="space-y-2">
  {publicMode && <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
    <Label htmlFor="sender-phone-lookup">Find your sender ID by phone number</Label>
    <div className="flex gap-2">
      <Input id="sender-phone-lookup" value={lookupPhone} onChange={(event) => setLookupPhone(event.target.value)} placeholder="0241234567 or +233241234567" inputMode="tel" />
      <Button type="button" variant="secondary" onClick={lookupSenderIds} disabled={lookupLoading}>{lookupLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}</Button>
    </div>
    {lookupResults.length > 0 && <div className="space-y-2 pt-1">{lookupResults.map((sender) => <div key={sender.id} className="flex items-center justify-between rounded-md border bg-background px-3 py-2 text-sm"><div><span className="font-semibold">{sender.sender_id}</span><p className="text-xs text-muted-foreground">Started {sender.created_at ? new Date(sender.created_at).toLocaleDateString() : "—"}</p></div><div className="flex items-center gap-2"><Badge variant={sender.status === "approved" ? "default" : "outline"}>{sender.status}</Badge>{sender.status === "approved" && <Button type="button" size="sm" onClick={() => { setSenderId(sender.sender_id); setSenderOpen(false); }}>Use</Button>}</div></div>)}</div>}
  </div>}
  <Label>Sender ID</Label>
            <div className="relative">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between"
                onClick={() => {
                  setSenderOpen(!senderOpen);
                  if (!senderOpen) void loadSenders();
                }}
              >
                {senderId || "Choose an approved sender ID"}
                <ChevronDown className="h-4 w-4" />
              </Button>
              {senderOpen && (
                <div className="absolute z-20 mt-1 w-full rounded-lg border bg-background p-2 shadow-lg">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="mb-2 w-full"
                    onClick={() => {
                      setSenderOpen(false);
                      setModalOpen(true);
                    }}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Add new sender ID
                  </Button>
                  <Input value={senderSearch} onChange={(event) => setSenderSearch(event.target.value)} placeholder="Search approved sender IDs..." aria-label="Search approved sender IDs" className="mb-2" />
                  <p className="px-3 pb-2 text-xs text-muted-foreground">Official sender IDs appear first. Public approved IDs are visible to everyone.</p>
                  {approved.length === 0 && (
                    <p className="px-3 py-2 text-sm text-muted-foreground">No approved sender IDs yet.</p>
                  )}
                  {approved.map((sender) => (
                    <button
                      type="button"
                      key={sender.id}
                      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                      onClick={() => {
                        setSenderId(sender.sender_id);
                        setSenderOpen(false);
                      }}
                    >
                      <span className="flex items-center gap-2">
                        {sender.sender_id}
                        {sender.is_global && <Badge variant="secondary" className="text-[10px]">Official</Badge>}
                      </span>
                      {senderId === sender.sender_id && <Check className="h-4 w-4 text-primary" />}
                    </button>
                  ))}
                  {pending.map((sender) => (
                    <div
                      key={sender.id}
                      className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-muted-foreground"
                    >
                      {sender.sender_id}
                      <span className="flex items-center gap-1 text-xs text-amber-600">
                        <Clock className="h-3 w-3" />
                        Pending approval
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Recipients */}
          {!publicMode && (ownerType === "agent" || ownerType === "subagent" || ownerType === "subsubagent") && <OrderContactPicker ownerType={ownerType} ownerId={ownerId} onContacts={setRecipients} />}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Recipients ({numbers.length})</Label>
            </div>
            <Textarea
              value={recipients}
              onChange={(event) => setRecipients(event.target.value)}
              placeholder="Paste numbers, one per line or comma-separated. +233 numbers are auto-converted to 0..."
              rows={4}
            />
            <div className="flex flex-col gap-2 rounded-lg border border-dashed p-3">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => fileRef.current?.click()}
                disabled={ocrLoading}
              >
                {ocrLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Upload screenshots or TXT/CSV files
              </Button>
              <p className="text-center text-xs text-muted-foreground text-pretty">
                Upload a WhatsApp group screenshot to extract numbers. Or even upload multiple screenshots, or if you have your
                contacts saved you can repeat this as often as needed.
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/*,.txt,.csv,.tsv,text/plain,text/csv"
                multiple
                className="hidden"
                onChange={(event) => {
                  if (event.target.files?.length) void extractScreenshots(event.target.files);
                }}
              />
            </div>
          </div>

          {/* Message */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Label>Message</Label><select value={generationType} onChange={(event) => setGenerationType(event.target.value)} className="ml-auto rounded-md border bg-background px-2 py-1 text-sm"><option value="promotion">Promotion</option><option value="marketing">Marketing</option><option value="greeting">Greeting</option><option value="announcement">Announcement</option><option value="reminder">Reminder</option></select>
              <Button type="button" size="sm" variant="outline" onClick={() => void generateMessage()} disabled={generating}><Sparkles className="mr-2 h-4 w-4" />{generating ? "Generating…" : "Generate with AI"}</Button>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground"><Switch checked={includeStoreLink} onCheckedChange={setIncludeStoreLink} id="include-store-link" /><label htmlFor="include-store-link">Include my store link by default</label></div>
            <div className="space-y-1">
              <Label htmlFor="ai-brief" className="text-xs text-muted-foreground">Describe what the AI should write (optional)</Label>
              <Textarea id="ai-brief" value={aiBrief} onChange={(event) => setAiBrief(event.target.value)} placeholder="e.g. Flash sale on MTN 5GB bundle at GHS 20, ends Friday" rows={2} />
            </div>
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Type your message here..."
              rows={5}
            />
            {includeStoreLink && storeLink && (
              <p className="text-xs text-muted-foreground">Store link will be added immediately after your message: <span className="font-medium text-primary">{storeLink}</span></p>
            )}
            <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 text-center sm:grid-cols-4">
              <div>
                <p className="text-lg font-semibold text-foreground">{messageUnits}</p>
                <p className="text-xs text-muted-foreground">Characters</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{pages}</p>
                <p className="text-xs text-muted-foreground">SMS Page{pages > 1 ? "s" : ""}</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-foreground">{remaining}</p>
                <p className="text-xs text-muted-foreground">Left on page</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-primary">GHS {totalCost.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Total cost</p>
              </div>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-xs leading-5 text-muted-foreground">
              <p className="font-semibold text-foreground">How SMS pricing works</p>
              <p>We charge GHS {CONTACT_PRICE.toFixed(2)} for each contact, plus GHS {PAGE_PRICE.toFixed(2)} for each SMS page. One page contains up to {PAGE_SIZE} character units.</p>
              <p>Example: 5 contacts and 1 page = GHS {(CONTACT_PRICE * 5 + PAGE_PRICE).toFixed(2)}. Emoji characters count as 2 units and may create an additional page.</p>
            </div>
          </div>

          <Button type="button" className="w-full" size="lg" onClick={() => void send()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send Now ({numbers.length} recipient{numbers.length === 1 ? "" : "s"})
          </Button>
        </CardContent>
      </Card>

      {/* Add New Sender ID modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Sender ID</DialogTitle>
              <DialogDescription>Submit a sender ID with your phone number for approval. Use that number later to check its status and select it once approved.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="sender-name">Sender ID Name *</Label>
                <span className="text-xs text-muted-foreground">{custom.length}/11</span>
              </div>
              <Input
                id="sender-name"
                value={custom}
                maxLength={11}
                onChange={(event) => setCustom(event.target.value.toUpperCase())}
                placeholder="e.g. DATA4ALL"
              />
              <p className="text-xs text-muted-foreground">Letters, numbers, and spaces allowed (max 11 characters)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sender-phone">Phone number *</Label>
              <Input id="sender-phone" value={senderPhone} onChange={(event) => setSenderPhone(event.target.value)} placeholder="0241234567 or +233241234567" inputMode="tel" />
              <p className="text-xs text-muted-foreground">Use this same number later to search for the sender ID and check approval.</p>
            </div>

            <div className="rounded-lg border p-3">
              <p className="mb-2 text-xs text-muted-foreground">How it will appear to recipients:</p>
              <div className="rounded-md bg-primary p-3 text-primary-foreground">
                <p className="text-xs opacity-80">From: {custom || "SENDER ID"}</p>
                <p className="text-sm font-medium">Your message will appear here...</p>
              </div>
            </div>

            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
              <p className="flex items-center gap-2 text-sm font-medium text-amber-700">
                <Clock className="h-4 w-4" />
                Approval Required
              </p>
              <p className="mt-1 text-xs text-amber-700/90">
                Custom sender IDs require approval from the network provider and may take 24-48 hours to activate. Once you submit,
                it will show as pending approval until an admin approves it.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void submitSender()} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Submit for Approval
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
