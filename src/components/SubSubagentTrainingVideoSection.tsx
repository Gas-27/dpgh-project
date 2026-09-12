import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

const embedUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) return `https://www.youtube.com/embed/${parsed.pathname.slice(1)}`;
    if (parsed.hostname.includes("youtube.com")) return `https://www.youtube.com/embed/${parsed.searchParams.get("v") || parsed.pathname.split("/").pop()}`;
    if (parsed.hostname.includes("vimeo.com")) return `https://player.vimeo.com/video/${parsed.pathname.split("/").filter(Boolean).pop()}`;
  } catch { return null; }
  return null;
};

export default function SubSubagentTrainingVideoSection({ storeId }: { storeId?: string }) {
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    supabase.from("sub_subagent_stores").select("training_video_title, training_video_url").eq("id", storeId).maybeSingle().then(({ data }) => {
      setTitle(data?.training_video_title || "");
      setUrl(data?.training_video_url || "");
    });
  }, [storeId]);

  const save = async () => {
    if (!storeId) return;
    setSaving(true);
    const { error } = await supabase.from("sub_subagent_stores").update({ training_video_title: title.trim() || null, training_video_url: url.trim() || null }).eq("id", storeId);
    setSaving(false);
    toast(error ? { title: "Could not save training video", description: error.message, variant: "destructive" } : { title: "Training video saved", description: "Visitors will see it in this Training Videos panel." });
  };

  const source = embedUrl(url);
  return <Card className="w-full"><CardHeader><CardTitle className="flex items-center gap-2"><Play className="h-5 w-5" />Training Videos</CardTitle></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">Paste the sub-subagent&apos;s own YouTube or Vimeo training video link here.</p><div className="grid gap-3 md:grid-cols-2"><div className="space-y-2"><Label>Video title</Label><Input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="How to use this storefront" /></div><div className="space-y-2"><Label>Training video URL</Label><Input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://youtube.com/watch?v=..." /></div></div><Button onClick={save} disabled={saving || !url.trim()}>{saving ? "Saving..." : "Save training video"}</Button>{source ? <div className="aspect-video overflow-hidden rounded-lg bg-muted"><iframe className="h-full w-full" src={source} title={title || "Training video"} allowFullScreen /></div> : <div className="flex aspect-video items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">No training video saved yet.</div>}</CardContent></Card>;
}
