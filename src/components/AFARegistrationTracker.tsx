import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, CheckCircle, Clock, Send, AlertTriangle, Flag, Upload, X, Image as ImageIcon, Phone } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";

// ── Stage thresholds ──────────────────────────────────────────────────────────
const STAGE_SENT_TO_AGENT_MINS = 10;   // 10 minutes after registration
const STAGE_SENT_TO_MTN_MINS   = 40;   // 40 minutes after registration (10 + 30)
// Stage 3 (MTN Approved) is ONLY set by admin via registration_status = "completed"
// Time alone never advances to stage 3 — the "4 days" is just an estimate shown to users

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
  // Stage 3 (MTN Approved) is ONLY triggered by admin marking status as "completed"
  // — time alone never jumps to approved, so customers are not falsely shown as done
  if (registration.registration_status === "completed") return 3;
  const minsAgo = (Date.now() - new Date(registration.created_at).getTime()) / (1000 * 60);
  if (minsAgo >= STAGE_SENT_TO_MTN_MINS) return 2;   // 40 min: Sent to MTN
  if (minsAgo >= STAGE_SENT_TO_AGENT_MINS) return 1; // 10 min: Sent to Agent
  return 0; // still in "Registration Placed"
}

const STAGES = [
  {
    label: "AFA Registration Placed",
    desc: "Your registration has been received and is being processed.",
    approxTime: "~10 minutes",
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
    desc: null, // rendered inline below with JSX
    approxTime: "1–4 days",
    icon: <Clock className="h-4 w-4" />,
  },
  {
    label: "MTN Approved — Dial *1848# to Buy",
    desc: null, // rendered inline below
    approxTime: "Done",
    icon: <CheckCircle className="h-4 w-4 text-green-500" />,
  },
];

// What they should see on their screen when they dial *1848# and are approved
function ApprovedScreenshot() {
  return (
    <div className="mt-3 rounded-lg border-2 border-green-500/40 bg-green-500/5 overflow-hidden">
      <div className="bg-green-600/20 px-3 py-2 flex items-center gap-2 border-b border-green-500/30">
        <Phone className="h-3.5 w-3.5 text-green-500" />
        <span className="text-xs font-semibold text-green-500">What you should see after dialing *1848#</span>
      </div>
      <img
        src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-4r9qM0zOFL0dxfZeyfNRKUZzr9inbE.png"
        alt="AFA menu showing: Welcome to AFA, 1. Buy AFA Bundle, 2. Claims, 3. Notifications, 4. Contact Support"
        className="w-full object-contain"
      />
      <div className="px-3 py-2 bg-green-500/10 border-t border-green-500/30">
        <p className="text-xs text-green-600 dark:text-green-400 font-medium">
          Seeing this menu means you are fully approved. You can now buy AFA data bundles at discounted wholesale prices directly from *1848#.
        </p>
      </div>
    </div>
  );
}

export default function AFARegistrationTracker({ storeLabel }: AFATrackerProps) {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [registrations, setRegistrations] = useState<Registration[] | null>(null);
  const [reportingId, setReportingId] = useState<string | null>(null);
  const [dialed1848, setDialed1848] = useState(false);
  const [reportNote, setReportNote] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);
  // Screenshot upload for report
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const screenshotRef = useRef<HTMLInputElement>(null);
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

  const handleScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast({ title: "Invalid file", description: "Please upload a JPG, PNG or WebP image.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Screenshot must be under 5MB.", variant: "destructive" });
      return;
    }
    setScreenshotFile(file);
    setScreenshotPreview(URL.createObjectURL(file));
  };

  const clearScreenshot = () => {
    setScreenshotFile(null);
    setScreenshotPreview(null);
    if (screenshotRef.current) screenshotRef.current.value = "";
  };

  const submitReport = async (reg: Registration) => {
    if (!dialed1848) {
      toast({ title: "Please confirm", description: "Please confirm you have dialed *1848# first.", variant: "destructive" });
      return;
    }
    if (!screenshotFile) {
      toast({ title: "Screenshot required", description: "Please upload a screenshot of what you see after dialing *1848#.", variant: "destructive" });
      return;
    }
    setSubmittingReport(true);
    try {
      // Upload screenshot to Supabase storage
      const ext = screenshotFile.name.split('.').pop() || 'jpg';
      const path = `afa-reports/${reg.id}-${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("complaint-screenshots")
        .upload(path, screenshotFile, { contentType: screenshotFile.type, upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("complaint-screenshots").getPublicUrl(path);
      const screenshotUrl = urlData?.publicUrl || null;

      const tier1Payload = {
        customer_phone: reg.customer_phone,
        customer_name: reg.customer_name,
        registration_id: reg.id,
        dialed_1848: true,
        notes: reportNote.trim() || null,
        screenshot_url: screenshotUrl || null,
        status: "pending",
      };

      // Try with screenshot_url field first; if schema error, fall back to embedding in notes
      let error = (await supabase.from("afa_registration_reports").insert(tier1Payload)).error;
      if (error && (error.code === "42703" || error.message?.includes("screenshot"))) {
        // Field doesn't exist, try without it
        const fallbackPayload = {
          customer_phone: reg.customer_phone,
          customer_name: reg.customer_name,
          registration_id: reg.id,
          dialed_1848: true,
          notes: [reportNote.trim(), screenshotUrl ? `Screenshot: ${screenshotUrl}` : null].filter(Boolean).join('\n') || null,
          status: "pending",
        };
        ({ error } = await supabase.from("afa_registration_reports").insert(fallbackPayload));
      }
      if (error) throw error;
      toast({ title: "Report submitted", description: "Our team will review your case shortly." });
      setReportingId(null);
      setDialed1848(false);
      setReportNote("");
      clearScreenshot();
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
        <p className="text-sm text-muted-foreground">
          Enter the phone number you used when registering to check your status and see what stage your registration is at.
        </p>
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

                        {/* Stage 2 — Sent to MTN */}
                        {i === 2 && (isActive || isDone) && (
                          <div className="mt-1 space-y-1.5">
                            <p className="text-xs text-muted-foreground">
                              Your registration has been forwarded to MTN for approval.{" "}
                              <strong>It takes 1–4 days for MTN to approve.</strong>
                            </p>
                            <p className="text-xs font-medium text-amber-500">
                              It is very important to keep dialing <strong>*1848#</strong> regularly to check if AFA bundles appear in the menu.
                            </p>
                          </div>
                        )}

                        {/* Stage 3 — Approved */}
                        {i === 3 && (isActive || isDone) && (
                          <div className="mt-1 space-y-1.5">
                            <p className="text-xs text-green-600 dark:text-green-400 font-medium">
                              MTN has approved your AFA registration! Dial <strong>*1848#</strong> now to buy bundles.
                            </p>
                            <p className="text-xs text-muted-foreground">
                              When you see AFA bundles after dialing *1848#, it means your registration is active and you can go ahead and purchase directly from that menu.
                            </p>
                            <ApprovedScreenshot />
                          </div>
                        )}

                        {/* Generic desc for stages 0 and 1 */}
                        {i < 2 && (isActive || isDone) && s.desc && (
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

              {/* Report button — only available once MTN has approved */}
              {!isReporting && (
                <div className="pt-2 border-t border-border">
                  {isApproved ? (
                    <>
                      <p className="text-xs text-muted-foreground mb-2">
                        If you dialed <strong>*1848#</strong> and still cannot see AFA bundles on the menu, click below to report it.
                      </p>
                      <Button
                        size="sm" variant="outline"
                        className="gap-1.5 border-red-500/40 text-red-500 hover:bg-red-500/10"
                        onClick={() => setReportingId(reg.id)}
                      >
                        <Flag className="h-3.5 w-3.5" /> Report Issue
                      </Button>
                    </>
                  ) : (
                    <p className="text-xs text-muted-foreground/70 italic">
                      Reporting is only available once your registration reaches the <strong>MTN Approved</strong> stage. Please check back after MTN has reviewed your application (1–4 days).
                    </p>
                  )}
                </div>
              )}

              {/* Report form */}
              {isReporting && (
                <div className="pt-2 border-t border-border space-y-4">
                  {/* *1848# confirmation */}
                  <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3">
                    <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                    <div className="space-y-2 flex-1">
                      <p className="text-sm font-medium text-amber-600 dark:text-amber-400">Before submitting — have you dialed *1848#?</p>
                      <p className="text-xs text-muted-foreground">
                        When your AFA registration is approved by MTN, dialing <strong>*1848#</strong> will show you an AFA bundles menu.
                        If you see bundles there, your registration is fully active — you can buy directly from that menu.
                        <br />
                        <strong>Only submit this report if you have dialed *1848# and the AFA bundles menu is NOT showing.</strong>
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

                  {/* Screenshot upload — required */}
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5">
                      <ImageIcon className="h-3.5 w-3.5" />
                      Screenshot of what you see when you dial *1848# <span className="text-red-500 ml-0.5">*</span>
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Take a screenshot of your phone screen after dialing *1848# and upload it here so our team can see what you are seeing.
                    </p>
                    {screenshotPreview ? (
                      <div className="relative w-full max-w-xs">
                        <img
                          src={screenshotPreview}
                          alt="Screenshot preview"
                          className="rounded-lg border border-border w-full object-cover max-h-48"
                        />
                        <button
                          onClick={clearScreenshot}
                          className="absolute top-1.5 right-1.5 bg-black/70 rounded-full p-0.5 text-white hover:bg-black"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => screenshotRef.current?.click()}
                        className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                      >
                        <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                        <p className="text-xs text-muted-foreground">Click to upload screenshot (JPG, PNG — max 5MB)</p>
                      </div>
                    )}
                    <input
                      ref={screenshotRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleScreenshotChange}
                    />
                  </div>

                  {/* Notes */}
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
                    <Button
                      size="sm"
                      onClick={() => submitReport(reg)}
                      disabled={submittingReport || !dialed1848 || !screenshotFile}
                      className="gap-1"
                    >
                      {submittingReport ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Flag className="h-3.5 w-3.5" />}
                      Submit Report
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setReportingId(null); setDialed1848(false); setReportNote(""); clearScreenshot(); }}>
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
