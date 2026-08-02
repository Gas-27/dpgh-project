import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Trash2 } from "lucide-react";

interface Announcement {
  id: number;
  title: string;
  video_url: string;
  is_active: boolean;
  created_at: string;
}

export default function AnnouncementManager() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("announcements")
      .select("id, title, video_url, is_active, created_at")
      .order("created_at", { ascending: false });
    setAnnouncements((data as Announcement[]) || []);
    setLoading(false);
  };

  const handleAdd = async () => {
    if (!title.trim() || !videoUrl.trim()) {
      toast({ title: "Both title and video URL are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    // Deactivate all existing before inserting the new one
    await supabase.from("announcements").update({ is_active: false }).neq("id", 0);
    const { error } = await supabase.from("announcements").insert({ title: title.trim(), video_url: videoUrl.trim(), is_active: true });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Announcement posted", description: "It will appear at the top of the User Dashboard Overview." });
      setTitle("");
      setVideoUrl("");
      fetchAnnouncements();
    }
    setSaving(false);
  };

  const toggleActive = async (id: number, current: boolean) => {
    if (!current) {
      // Deactivate others first
      await supabase.from("announcements").update({ is_active: false }).neq("id", 0);
    }
    await supabase.from("announcements").update({ is_active: !current }).eq("id", id);
    fetchAnnouncements();
  };

  const handleDelete = async (id: number) => {
    await supabase.from("announcements").delete().eq("id", id);
    fetchAnnouncements();
  };

  return (
    <div className="space-y-4">
      {/* Add new */}
      <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
        <p className="text-sm font-medium">Post a new announcement</p>
        <div className="space-y-1.5">
          <Label htmlFor="ann-title">Title</Label>
          <Input id="ann-title" placeholder="e.g. Watch our latest update" value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ann-url">YouTube Video URL</Label>
          <Input id="ann-url" placeholder="https://youtube.com/watch?v=..." value={videoUrl} onChange={e => setVideoUrl(e.target.value)} />
        </div>
        <Button onClick={handleAdd} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Post Announcement
        </Button>
      </div>

      {/* Existing */}
      {loading ? (
        <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : announcements.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No announcements yet.</p>
      ) : (
        <div className="space-y-2">
          {announcements.map(a => (
            <div key={a.id} className="flex items-center justify-between border rounded-lg px-4 py-3 bg-background gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{a.title}</p>
                <p className="text-xs text-muted-foreground truncate">{a.video_url}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch checked={a.is_active} onCheckedChange={() => toggleActive(a.id, a.is_active)} />
                <span className="text-xs text-muted-foreground">{a.is_active ? "Active" : "Off"}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(a.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
