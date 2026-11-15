import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2, Pause, Play, Trash2, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type OwnerType = "customer" | "agent" | "subagent" | "subsubagent";
type Frequency = "once" | "daily" | "weekly" | "monthly";
type Props = { ownerType: OwnerType; ownerId?: string };

type Schedule = {
  id: string;
  sender_id: string;
  message: string;
  recipients: string[];
  frequency: Frequency;
  run_time: string | null;
  day_of_week: number | null;
  day_of_month: number | null;
  active: boolean;
  next_run_at: string;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const PAGE_SIZE = 160;

const normalizeGh = (raw: string): string | null => {
  let d = raw.replace(/\D/g, "");
  if (!d) return null;
  if (d.startsWith("00233")) d = "0" + d.slice(5);
  else if (d.startsWith("233") && d.length >= 12) d = "0" + d.slice(3);
  if (d.length === 9 && /^[2-5]/.test(d)) d = "0" + d;
  return /^0[2-5]\d{8}$/.test(d) ? d : null;
};

const extractNumbers = (text: string): string[] => {
  const chunks = text.split(/[\s,;]+/);
  return Array.from(new Set(chunks.map(normalizeGh).filter((n): n is string => Boolean(n))));
};

const statusLabel: Record<string, string> = { success: "Sent", sending: "Sending", failed: "Failed", partial: "Partly sent" };

export default function ScheduleSms({ ownerType, ownerId }: Props) {
  const { toast } = useToast();
  const [senders, setSenders] = useState<string[]>([]);
  const [senderId, setSenderId] = useState("");
  const [recipientsText, setRecipientsText] = useState("");
  const [message, setMessage] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("once");
  const [runAt, setRunAt] = useState("");
  const [runTime, setRunTime] = useState("08:00");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [contactPrice, setContactPrice] = useState(0.07);
  const [pagePrice, setPagePrice] = useState(1.5);
  const [balance, setBalance] = useState<number | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [saving, setSaving] = useState(false);

  const numbers = useMemo(() => extractNumbers(recipientsText), [recipientsText]);
  const units = useMemo(() => Array.from(message).reduce((total, ch) => total + (ch.codePointAt(0)! > 0xffff ? 2 : 1), 0), [message]);
  const pages = Math.max(1, Math.ceil(units / PAGE_SIZE));
  const costPerRun = contactPrice * numbers.length + pagePrice * pages;
  const lowBalance = balance !== null && numbers.length > 0 && message.trim().length > 0 && balance < costPerRun;

  const loadSchedules = useCallback(async () => {
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return;
    const { data, error } = await supabase
      .from("scheduled_sms" as any)
      .select("*")
      .eq("user_id", auth.user.id)
      .eq("owner_type", ownerType)
      .order("created_at", { ascending: false });
    if (error) console.error("[v0] Could not load SMS schedules", error);
    setSchedules(((data as unknown) as Schedule[]) ?? []);
  }, [ownerType]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      const { data: senderRows } = await supabase
        .from("sms_sender_ids")
        .select("sender_id,status,is_global,user_id")
        .eq("status", "approved")
        .or(`is_global.eq.true,user_id.eq.${uid}`);
      const names = Array.from(new Set(((senderRows ?? []) as { sender_id: string; is_global?: boolean; user_id?: string }[])
        .filter((row) => row.is_global || row.user_id === uid)
        .map((row) => row.sender_id)));
      const pricingKey = ownerType === "customer"
        ? "sms_dashboard_recipient_price, sms_dashboard_page_price"
        : "sms_storefront_recipient_price, sms_storefront_page_price";
      const { data: pricing } = await supabase.from("app_settings").select(pricingKey).eq("id", 1).maybeSingle();
      const values = pricing as Record<string, number> | null;
      const [contactKey, pageKey] = pricingKey.split(",").map((key) => key.trim());
      const { data: bal } = await supabase.rpc("get_sms_wallet", { p_user_id: uid, p_owner_type: ownerType });
      if (!alive) return;
      setSenders(names);
      setSenderId((current) => current || names[0] || "");
      setContactPrice(Number(values?.[contactKey] ?? 0.07));
      setPagePrice(Number(values?.[pageKey] ?? 1.5));
      setBalance(Number(bal ?? 0));
    })();
    void loadSchedules();
    return () => { alive = false; };
  }, [ownerType, loadSchedules]);

  const save = async () => {
    if (!senderId) return toast({ title: "Choose a sender ID", description: "Only approved sender IDs can be scheduled.", variant: "destructive" });
    if (!numbers.length) return toast({ title: "Add recipients", description: "Enter at least one valid Ghana phone number.", variant: "destructive" });
    if (!message.trim()) return toast({ title: "Write a message", variant: "destructive" });
    if (frequency === "once" && !runAt) return toast({ title: "Choose a date and time", variant: "destructive" });
    setSaving(true);
    const { error } = await supabase.rpc("create_sms_schedule" as any, {
      p_owner_type: ownerType,
      p_owner_id: ownerId ?? null,
      p_sender_id: senderId,
      p_message: message.trim(),
      p_recipients: numbers,
      p_frequency: frequency,
      p_run_at: frequency === "once" ? new Date(runAt).toISOString() : null,
      p_run_time: frequency === "once" ? null : (runTime.length === 5 ? `${runTime}:00` : runTime),
      p_day_of_week: frequency === "weekly" ? Number(dayOfWeek) : null,
      p_day_of_month: frequency === "monthly" ? Number(dayOfMonth) : null,
    });
    setSaving(false);
    if (error) return toast({ title: "Could not schedule SMS", description: error.message, variant: "destructive" });
    toast({ title: "SMS scheduled", description: "Your wallet is charged when the SMS is due, before it is sent." });
    setRecipientsText("");
    setMessage("");
    void loadSchedules();
  };

  const toggle = async (row: Schedule) => {
    const { error } = await supabase.rpc("set_sms_schedule_active" as any, { p_id: row.id, p_active: !row.active });
    if (error) return toast({ title: "Could not update schedule", description: error.message, variant: "destructive" });
    void loadSchedules();
  };

  const remove = async (row: Schedule) => {
    const { error } = await supabase.from("scheduled_sms" as any).delete().eq("id", row.id);
    if (error) return toast({ title: "Could not delete schedule", description: error.message, variant: "destructive" });
    void loadSchedules();
  };

  const describe = (row: Schedule) => {
    const time = row.run_time?.slice(0, 5);
    if (row.frequency === "once") return `Once on ${new Date(row.next_run_at).toLocaleString()}`;
    if (row.frequency === "daily") return `Every day at ${time}`;
    if (row.frequency === "weekly") return `Every ${DAYS[row.day_of_week ?? 0]} at ${time}`;
    return `Day ${row.day_of_month} of every month at ${time}`;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" aria-hidden />
            <h3 className="font-semibold">Schedule an SMS</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Pick a date, or repeat daily, weekly or monthly (Ghana time). When the time comes, your wallet is checked and charged first. If there is not enough money, nothing is sent.
          </p>

          <div className="space-y-2">
            <Label htmlFor="sched-sender">Sender ID</Label>
            <Select value={senderId} onValueChange={setSenderId} disabled={!senders.length}>
              <SelectTrigger id="sched-sender"><SelectValue placeholder={senders.length ? "Choose a sender ID" : "No approved sender ID yet"} /></SelectTrigger>
              <SelectContent>{senders.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sched-recipients">Recipients</Label>
            <Textarea id="sched-recipients" rows={3} placeholder="0241234567, 0551234567 ..." value={recipientsText} onChange={(e) => setRecipientsText(e.target.value)} />
            <p className="text-xs text-muted-foreground">{numbers.length} valid number{numbers.length === 1 ? "" : "s"}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="sched-message">Message</Label>
            <Textarea id="sched-message" rows={4} maxLength={1600} placeholder="Type your message" value={message} onChange={(e) => setMessage(e.target.value)} />
            <p className="text-xs text-muted-foreground">{units} characters, {pages} page{pages === 1 ? "" : "s"}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Send</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as Frequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">One time (pick a date)</SelectItem>
                  <SelectItem value="daily">Every day</SelectItem>
                  <SelectItem value="weekly">Every week</SelectItem>
                  <SelectItem value="monthly">Every month</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {frequency === "once" ? (
              <div className="space-y-2">
                <Label htmlFor="sched-at">Date and time</Label>
                <Input id="sched-at" type="datetime-local" value={runAt} onChange={(e) => setRunAt(e.target.value)} />
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="sched-time">Time</Label>
                <Input id="sched-time" type="time" value={runTime} onChange={(e) => setRunTime(e.target.value)} />
              </div>
            )}
          </div>

          {frequency === "weekly" && (
            <div className="space-y-2">
              <Label>Day of the week</Label>
              <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DAYS.map((day, i) => <SelectItem key={day} value={String(i)}>{day}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {frequency === "monthly" && (
            <div className="space-y-2">
              <Label>Day of the month</Label>
              <Select value={dayOfMonth} onValueChange={setDayOfMonth}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{Array.from({ length: 28 }, (_, i) => <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <span className="flex items-center gap-2"><Wallet className="h-4 w-4" aria-hidden />Wallet: GHS {balance === null ? "—" : balance.toFixed(2)}</span>
            <span className="font-semibold">Cost per send: GHS {costPerRun.toFixed(2)}</span>
          </div>
          {lowBalance && <p className="text-sm text-destructive" role="alert">Your wallet is below the cost of one send. Top up before the scheduled time or it will not be sent.</p>}

          <Button type="button" className="w-full" onClick={save} disabled={saving}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />Saving...</> : "Schedule SMS"}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="text-sm font-semibold">Your scheduled SMS</h3>
        {!schedules.length ? (
          <p className="text-sm text-muted-foreground">Nothing scheduled yet.</p>
        ) : (
          <ul className="space-y-2">
            {schedules.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                <div className="min-w-0 space-y-0.5">
                  <p className="truncate font-medium">{row.sender_id} · {row.recipients.length} recipient{row.recipients.length === 1 ? "" : "s"}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{row.message}</p>
                  <p className="text-xs text-muted-foreground">{describe(row)}</p>
                  {row.active && row.frequency !== "once" && <p className="text-xs text-muted-foreground">Next: {new Date(row.next_run_at).toLocaleString()}</p>}
                  {!row.active && <p className="text-xs text-muted-foreground">{row.last_run_at ? "Finished" : "Paused"}</p>}
                  {row.last_status && (
                    <p className={`text-xs ${row.last_status === "failed" ? "text-destructive" : row.last_status === "success" ? "text-emerald-600" : "text-muted-foreground"}`}>
                      {statusLabel[row.last_status] ?? row.last_status}{row.last_run_at ? ` · ${new Date(row.last_run_at).toLocaleString()}` : ""}{row.last_error ? ` · ${row.last_error}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  {!(row.frequency === "once" && !row.active) && (
                    <Button type="button" size="icon" variant="ghost" onClick={() => toggle(row)} aria-label={row.active ? "Pause schedule" : "Resume schedule"}>
                      {row.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </Button>
                  )}
                  <Button type="button" size="icon" variant="ghost" onClick={() => remove(row)} aria-label="Delete schedule"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
