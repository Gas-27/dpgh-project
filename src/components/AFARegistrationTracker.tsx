import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, CheckCircle, Clock, Send, AlertTriangle, Flag } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

// ── Stage thresholds (in hours from created_at) ──────────────────────────────
const STAGE_SENT_TO_AGENT_HOURS = 2 / 60;  // 2 minutes
const STAGE_SENT_TO_MTN_HOURS   = 0.5;     // 30 minutes
const STAGE_APPROVED_HOURS      = 88;      // ~1–4 days

interface AFATrackerProps {
  storeLabel?: string;
}

interface Registration {
  id: string;
  customer_name: string;
  customer_phone: string;
  region: string;
  crop: string;
  registration_status: string;
  created_at: string;
}

function getStage(registration: Registration): 0 | 1 | 2 | 3 {
  const hoursAgo = (Date.now() - new Date(registration.created_at).getTime()) / (1000 * 3600);
  if (registration.registration_status === "completed" || hoursAgo >= STAGE_APPROVED_HOURS) return 3;
  if (hoursAgo >= STAGE_SENT_TO_MTN_HOURS) return 2;
  if (hoursAgo >= STAGE_SENT_TO_AGENT_HOURS) return 1;
  return 0;
}

const STAGES = [
  {
    label: "AFA Registration Placed",
    desc: "Your registration has been received.",
    approxTime: "~2 minutes",
    icon: <CheckCircle className="h-4 w-4" />,
  },
  {
    label: "Sent to Agent",
    desc: "Your registration is being sent to an AFA agent for them to forward to MTN directly.",
    approxTime: "~30 minutes",
    icon: <Send className="h-4 w-4" />,
  },
  {
    label: "Sent to MTN for Approval",
    desc: (
      <>
        Your registration has been forwarded to MTN for approval.{" "}
        <strong>It takes 1–4 days for MTN to approve.</strong>{" "}
        <span className="text-amber-500 font-medium">
          It is very important to keep dialing <strong>*1848#</strong> to check if you can buy AFA bundles from there.
        </span>
      </>
    ),
    approxTime: "1–4 days",
    icon: <Clock className="h-4 w-4" />,
  },
  {
    label: "MTN Has Approved — Dial *1848# to Buy",
    desc: (
      <>
        MTN has approved your AFA registration!{" "}
        <strong>Dial *1848# now</strong> — if you see AFA bundles listed there, you are approved and can buy directly from that menu.
        <br />
        <span className="text-green-500">When you see AFA bundles after dialing *1848#, it means your registration is active.</span>
      </>
    ),
    approxTime: "Done",
    icon: <CheckCircle className="h-4 w-4 text-green-500" />,
  },
];

export default function AFARegistrationTracker({ storeLabel }: AFATrackerProps) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [registrations, setRegistrations] = useState<Registration[] | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [dialed1848, setDialed1848] = useState(false);
  const [reportNote, setReportNote] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  const { toast } = useToast();

  const handleTrack = async () => {
    const cleaned = phone.trim();
    if (!cleaned) return;
    setLoading(true);
    setRegistrations(null);
    try {
      const { data, error } = await supabase
        .from("afa_registrations")
        .select("id, customer_name, customer_phone, region, crop, registration_status, created_at")
        .eq("customer_phone", cleaned)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      setRegistrations((data as Registration[]) || []);
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Could not fetch registration.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const submitReport = async (reg: Registration) => {
    if (!dialed1848) {
      toast({ title: "Please confirm", description: "Please confirm you have dialed *1848# first.", variant: "destructive" });
      return;
    }
    setSubmittingReport(true);
    try {
      const { error } = await supabase.from("afa_registration_reports").insert({
        customer_phone: reg.customer_phone,
        customer_name: reg.customer_name,
        registration_id: reg.id,
        dialed_1848: true,
        notes: reportNote.trim() || null,
        status: "pending",
      });
      if (error) throw error;
      toast({ title: "Report submitted", description: "Our team will review your registration shortly." });
      setReportingId(null);
      setDialed1848(false);
      setReportNote("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Search className="h-4 w-4" />
          Track Your AFA Registration
        </CardTitle>
        <p className="text-sm text-muted-foreground">Enter the phone number you used when registering to check your status.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="e.g. 0244123456"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleTrack(); }}
            className="flex-1"
          />
          <Button onClick={handleTrack} disabled={loading || !phone.trim()} className="gap-1.5">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Track
          </Button>
        </div>

        {registrations !== null && registrations.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No AFA registration found for <strong>{phone}</strong>. Make sure you are using the same number used during registration.
          </p>
        )}

        {registrations && registrations.map(reg => {
          const stage = getStage(reg);
          const isApproved = stage === 3;
          const isReporting = reportingId === reg.id;

          return (
            <div key={reg.id} className="border rounded-lg p-4 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{reg.customer_name}</p>
                  <p className="text-sm text-muted-foreground">{reg.customer_phone} — {reg.region} / {reg.crop}</p>
                  <p className="text-xs text-muted-foreground">Registered: {new Date(reg.created_at).toLocaleDateString()}</p>
                </div>
                {isApproved
                  ? <Badge className="bg-green-600 text-white shrink-0">Approved</Badge>
                  : <Badge variant="secondary" className="shrink-0">In Progress</Badge>}
              </div>

              {/* Stage timeline */}
              <ol className="relative border-l border-border ml-2 space-y-4 pl-4">
                {STAGES.map((s, i) => {
                  const isActive  = i === stage;
                  const isDone    = i < stage;
                  const isPending = i > stage;
                  return (
                    <li key={i} className={`relative ${isPending ? "opacity-40" : ""}`}>
                      <span className={`absolute -left-[21px] flex h-5 w-5 items-center justify-center rounded-full border ${isDone ? "bg-green-600 border-green-600 text-white" : isActive ? "bg-primary border-primary text-primary-foreground" : "bg-muted border-border text-muted-foreground"}`}>
                        {isDone
                          ? <CheckCircle className="h-3 w-3" />
                          : isActive
                          ? s.icon
                          : <span className="text-[10px] font-bold">{i + 1}</span>}
                      </span>
                      <div>
                        <p className={`text-sm font-semibold ${isActive ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</p>
                        {(isActive || isDone) && (
                          <p className="text-xs text-muted-foreground mt-0.5">{s.desc}</p>
                        )}
                        {!isDone && i < STAGES.length - 1 && (
                          <p className="text-xs text-muted-foreground/60 mt-0.5">Approx: {s.approxTime}</p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>

              {/* Report button shown only when approved */}
              {isApproved && !isReporting && (
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">
                    If you dialed <strong>*1848#</strong> and still cannot see AFA bundles, click below to report it.
                  </p>
                  <Button
                    size="sm" variant="outline"
                    className="gap-1.5 border-red-500/40 text-red-500 hover:bg-red-500/10"
                    onClick={() => setReportingId(reg.id)}
                  >
                    <Flag className="h-3.5 w-3.5" /> Report Issue
                  </Button>
                </div>
              )}

              {/* Report form */}
              {isReporting && (
                <div className="pt-2 border-t border-border space-y-3">
                  {/* *1848# confirmation checkbox */}
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <div className="space-y-2 flex-1">
                      <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Before submitting — have you dialed *1848#?</p>
                      <p className="text-xs text-muted-foreground">
                        When your registration is approved by MTN, dialing <strong>*1848#</strong> will show you AFA bundles you can buy.
                        If you see AFA bundles there, your registration is active — you can go ahead and purchase from that menu.
                        <br />
                        <strong>Only submit this report if you have dialed *1848# and still see nothing.</strong>
                      </p>
                      <div className="flex items-center gap-2 pt-1">
                        <Checkbox
                          id={`dialed-${reg.id}`}
                          checked={dialed1848}
                          onCheckedChange={v => setDialed1848(!!v)}
                        />
                        <Label htmlFor={`dialed-${reg.id}`} className="text-sm cursor-pointer">
                          Yes, I have dialed *1848# and AFA bundles are NOT showing
                        </Label>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Additional notes (optional)</Label>
                    <Textarea
                      placeholder="Describe what you see when you dial *1848#..."
                      value={reportNote}
                      onChange={e => setReportNote(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => submitReport(reg)} disabled={submittingReport || !dialed1848} className="gap-1">
                      {submittingReport ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flag className="h-3.5 w-3.5" />}
                      Submit Report
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setReportingId(null); setDialed1848(false); setReportNote(""); }}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
