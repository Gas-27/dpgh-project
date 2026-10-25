import { useEffect, useState } from "react";
import { Flag, Loader2, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { REPORT_REASONS } from "@/lib/marketplaceRules";

type Comment = { id: string; author_name: string; body: string; created_at: string };

export function ReportProductButton({ productId, signedIn }: { productId: string; signedIn: boolean }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [offersSiteService, setOffersSiteService] = useState<"yes" | "no">("no");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    const { error } = await supabase.from("marketplace_product_reports").insert({
      product_id: productId,
      reason,
      offers_site_service: offersSiteService === "yes",
      note: note.trim() || null,
    });
    setSaving(false);
    if (error) {
      const duplicate = error.code === "23505";
      toast({ title: duplicate ? "Already reported" : "Could not send report", description: duplicate ? "You have already reported this post. Our team will review it." : error.message, variant: duplicate ? "default" : "destructive" });
      if (duplicate) setOpen(false);
      return;
    }
    toast({ title: "Report sent", description: "Thank you. Our team will review this post." });
    setOpen(false);
    setNote("");
  }

  return (
    <>
      <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setOpen(true)}><Flag className="mr-2 h-4 w-4" />Report post</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report this post</DialogTitle>
            <DialogDescription>Tell us what is wrong with this post. Reports are reviewed by our team and sent to the admin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="report-reason">Why are you reporting this post?</Label>
              <select id="report-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                {REPORT_REASONS.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Is this post offering something the site already provides (data, airtime, AFA, bulk SMS, USSD, subscriptions, social boost)?</legend>
              <div className="flex gap-4 text-sm">
                <label className="flex items-center gap-2"><input type="radio" name="offers-site-service" checked={offersSiteService === "yes"} onChange={() => setOffersSiteService("yes")} />Yes</label>
                <label className="flex items-center gap-2"><input type="radio" name="offers-site-service" checked={offersSiteService === "no"} onChange={() => setOffersSiteService("no")} />No</label>
              </div>
            </fieldset>
            <div className="space-y-2">
              <Label htmlFor="report-note">Add a note (optional)</Label>
              <Textarea id="report-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={1000} placeholder="Add any detail that helps us review this post." />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Submit report</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function ProductComments({ productId, signedIn }: { productId: string; signedIn: boolean }) {
  const { toast } = useToast();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);

  async function load() {
    const { data } = await supabase.from("marketplace_product_comments").select("id,author_name,body,created_at").eq("product_id", productId).order("created_at", { ascending: false }).limit(100);
    setComments((data || []) as Comment[]);
    setLoading(false);
  }
  useEffect(() => { void load(); }, [productId]);

  async function post() {
    if (!body.trim()) return;
    setPosting(true);
    const { error } = await supabase.from("marketplace_product_comments").insert({ product_id: productId, body: body.trim() });
    setPosting(false);
    if (error) { toast({ title: "Could not post comment", description: error.message, variant: "destructive" }); return; }
    setBody("");
    await load();
  }

  return (
    <section className="mt-6 border-t pt-6" aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="text-lg font-semibold">Comments ({comments.length})</h2>
      <form className="mt-3 flex flex-col gap-2" onSubmit={(e) => { e.preventDefault(); void post(); }}>
          <Label htmlFor="comment-body" className="sr-only">Write a comment</Label>
          <Textarea id="comment-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={500} placeholder="Write a comment about this post" />
          <Button type="submit" size="sm" className="self-end" disabled={posting || !body.trim()}>{posting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}Post comment</Button>
        </form>
      <div className="mt-4 space-y-3">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : comments.length === 0 ? <p className="text-sm text-muted-foreground">No comments yet.</p> : comments.map((comment) => (
          <div key={comment.id} className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span className="font-medium text-foreground">{comment.author_name}</span><time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleString()}</time></div>
            <p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
