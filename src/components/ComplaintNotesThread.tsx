import React, { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MessageCircle, Send, AlertCircle, CheckCircle2, Clock } from "lucide-react";

export interface ComplaintNote {
  id: string;
  complaint_id: string;
  note_text: string;
  requires_response: boolean;
  response_text: string | null;
  responded_at: string | null;
  created_at: string;
}

interface ComplaintNotesThreadProps {
  complaintId: string;
  isAdmin?: boolean;
  onPendingCountChange?: (count: number) => void;
}

export function ComplaintNotesThread({
  complaintId,
  isAdmin = false,
  onPendingCountChange,
}: ComplaintNotesThreadProps) {
  const [notes, setNotes] = useState<ComplaintNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [noteText, setNoteText] = useState("");
  const [requiresResponse, setRequiresResponse] = useState(false);
  const [saving, setSaving] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");
  const [responding, setResponding] = useState(false);
  const [tableExists, setTableExists] = useState(true);
  const { toast } = useToast();

  const fetchNotes = async () => {
    try {
      const { data, error } = await (supabase as any)
        .from("complaint_notes")
        .select("*")
        .eq("complaint_id", complaintId)
        .order("created_at", { ascending: true });

      if (error) {
        // 42P01 = table doesn't exist yet (migration not yet applied)
        if (error.code === "42P01" || (error.message || "").includes("does not exist")) {
          setTableExists(false);
          setLoading(false);
          return;
        }
        console.error("[v0] fetchNotes error:", error);
        setLoading(false);
        return;
      }

      const notesList: ComplaintNote[] = data ?? [];
      setNotes(notesList);
      if (onPendingCountChange) {
        onPendingCountChange(notesList.filter((n) => n.requires_response && !n.response_text).length);
      }
    } catch (e) {
      console.error("[v0] ComplaintNotesThread unexpected error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [complaintId]);

  const handleAddNote = async () => {
    if (!noteText.trim()) return;
    setSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("complaint_notes")
        .insert({
          complaint_id: complaintId,
          note_text: noteText.trim(),
          requires_response: requiresResponse,
        });

      if (error) {
        if (error.code === "42P01") {
          toast({
            title: "Migration required",
            description: "Run the complaint_notes SQL migration in Supabase first.",
            variant: "destructive",
          });
          return;
        }
        throw error;
      }

      setNoteText("");
      setRequiresResponse(false);
      await fetchNotes();
      toast({ title: "Note added successfully" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleRespond = async (noteId: string) => {
    if (!responseText.trim()) return;
    setResponding(true);
    try {
      const { error } = await (supabase as any)
        .from("complaint_notes")
        .update({
          response_text: responseText.trim(),
          responded_at: new Date().toISOString(),
        })
        .eq("id", noteId);

      if (error) throw error;

      setRespondingId(null);
      setResponseText("");
      await fetchNotes();
      toast({ title: "Response submitted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setResponding(false);
    }
  };

  if (!tableExists) {
    return (
      <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 space-y-2">
        <p className="text-xs font-semibold text-yellow-400">Notes system not yet set up</p>
        <p className="text-xs text-yellow-300/80">
          Run this SQL in your Supabase SQL Editor to enable complaint notes:
        </p>
        <pre className="text-xs bg-black/40 rounded p-2 overflow-x-auto text-green-300 select-all">
{`CREATE TABLE IF NOT EXISTS public.complaint_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  complaint_id UUID NOT NULL,
  note_text TEXT NOT NULL,
  requires_response BOOLEAN DEFAULT FALSE,
  response_text TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.complaint_notes DISABLE ROW LEVEL SECURITY;`}
        </pre>
      </div>
    );
  }

  const pendingCount = notes.filter((n) => n.requires_response && !n.response_text).length;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageCircle className="h-4 w-4 text-muted-foreground" />
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Admin Notes &amp; Messages
        </p>
        {pendingCount > 0 && (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
            {pendingCount} {pendingCount === 1 ? "question" : "questions"} pending
          </Badge>
        )}
      </div>

      {/* Notes list */}
      {loading ? (
        <p className="text-xs text-muted-foreground animate-pulse py-2">Loading notes...</p>
      ) : notes.length === 0 ? (
        <p className="text-xs text-muted-foreground italic py-2">No notes yet.</p>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className={`rounded-lg border p-3 space-y-2 ${
                note.requires_response && !note.response_text
                  ? "border-amber-500/30 bg-amber-500/5"
                  : "border-border bg-muted/20"
              }`}
            >
              {/* Note header row */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <Badge className="bg-primary/20 text-primary border-primary/30 text-xs">
                    Admin
                  </Badge>
                  {note.requires_response && (
                    <Badge
                      className={`text-xs ${
                        note.response_text
                          ? "bg-green-500/20 text-green-400 border-green-500/30"
                          : "bg-amber-500/20 text-amber-400 border-amber-500/30"
                      }`}
                    >
                      {note.response_text ? (
                        <><CheckCircle2 className="h-3 w-3 mr-1 inline" />Responded</>
                      ) : (
                        <><Clock className="h-3 w-3 mr-1 inline" />Response Needed</>
                      )}
                    </Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(note.created_at).toLocaleString()}
                </span>
              </div>

              {/* Note body */}
              <p className="text-sm whitespace-pre-wrap leading-relaxed">{note.note_text}</p>

              {/* Response section */}
              {note.requires_response && (
                <div className="border-t border-border pt-2 mt-2 space-y-2">
                  {note.response_text ? (
                    <div className="rounded-md bg-blue-500/10 border border-blue-500/20 p-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                          {isAdmin ? "Customer Response" : "Your Response"}
                        </Badge>
                        {note.responded_at && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(note.responded_at).toLocaleString()}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {note.response_text}
                      </p>
                    </div>
                  ) : !isAdmin ? (
                    respondingId === note.id ? (
                      <div className="space-y-2">
                        <Textarea
                          placeholder="Type your response to the admin..."
                          value={responseText}
                          onChange={(e) => setResponseText(e.target.value)}
                          className="text-sm min-h-[80px]"
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && e.ctrlKey && !e.nativeEvent.isComposing) {
                              handleRespond(note.id);
                            }
                          }}
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            disabled={responding || !responseText.trim()}
                            onClick={() => handleRespond(note.id)}
                          >
                            <Send className="h-3.5 w-3.5 mr-1" />
                            {responding ? "Sending..." : "Send Response"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setRespondingId(null);
                              setResponseText("");
                            }}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
                        onClick={() => {
                          setRespondingId(note.id);
                          setResponseText("");
                        }}
                      >
                        <AlertCircle className="h-3.5 w-3.5 mr-1" />
                        Reply to Admin
                      </Button>
                    )
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Waiting for customer response...
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add note form — admin only */}
      {isAdmin && (
        <div className="rounded-lg border border-dashed border-border bg-muted/10 p-3 space-y-2">
          <p className="text-xs text-muted-foreground font-medium">Add note or question</p>
          <Textarea
            placeholder="Write a note for the customer, ask for more info, or explain the status..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            className="text-sm min-h-[90px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && e.ctrlKey && !e.nativeEvent.isComposing) {
                handleAddNote();
              }
            }}
          />
          <div className="flex items-center justify-between flex-wrap gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={requiresResponse}
                onChange={(e) => setRequiresResponse(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs text-muted-foreground">Ask customer for a response</span>
            </label>
            <Button size="sm" disabled={saving || !noteText.trim()} onClick={handleAddNote}>
              <Send className="h-3.5 w-3.5 mr-1" />
              {saving ? "Saving..." : "Add Note"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
