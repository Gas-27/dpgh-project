import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarClock, Pause, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = { ownerType: string; ownerId?: string; variant?: "button" | "bar" };

type Pkg = { id: string; network: string; size_gb: number; price: number; agent_price: number | null };
type Schedule = {
  id: string;
  phone: string;
  package_id: string;
  frequency: "daily" | "weekly" | "monthly";
  run_time: string;
  day_of_week: number | null;
  day_of_month: number | null;
  active: boolean;
  next_run_at: string;
  last_run_at: string | null;
  last_status: string | null;
  last_error: string | null;
};

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const NETWORK_LABEL: Record<string, string> = { mtn: "MTN", airteltigo: "AirtelTigo", telecel: "Telecel" };

function detectNetwork(phone: string) {
  const prefix = phone.slice(0, 3);
  if (["024", "054", "055", "059", "025", "053"].includes(prefix)) return "mtn";
  if (["027", "026", "056", "057"].includes(prefix)) return "airteltigo";
  if (["020", "050"].includes(prefix)) return "telecel";
  return "unknown";
}

function normalizePackageNetwork(network: string) {
  const value = network.toLowerCase();
  return ["mtn", "mtn_express", "mtn_mashup", "mashup"].includes(value) ? "mtn" : value;
}

export default function ScheduleDataPurchase({ ownerType, ownerId, variant = "button" }: Props) {
  const supported = (ownerType === "customer" || ownerType === "agent") && !!ownerId;
  const [open, setOpen] = useState(false);
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [phone, setPhone] = useState("");
  const [packageId, setPackageId] = useState("");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("daily");
  const [runTime, setRunTime] = useState("08:00");
  const [dayOfWeek, setDayOfWeek] = useState("1");
  const [dayOfMonth, setDayOfMonth] = useState("1");
  const [saving, setSaving] = useState(false);

  const loadSchedules = useCallback(async () => {
    if (!ownerId) {
      setSchedules([]);
      return;
    }
    const { data, error } = await supabase
      .from("scheduled_data_purchases" as any)
      .select("*")
      .eq("owner_type", ownerType)
      .eq("owner_id", ownerId)
      .order("created_at", { ascending: false });
    if (error) {
      console.error("[v0] Could not load schedules", error);
      return;
    }
    setSchedules((data as any[]) ?? []);
  }, [ownerId, ownerType]);

  useEffect(() => {
    if (!open || !supported) return;
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("data_packages")
        .select("id, network, size_gb, price, agent_price")
        .eq("active", true)
        .order("size_gb", { ascending: true });
      if (active) setPackages(((data as any[]) ?? []).map((p) => ({ ...p, price: Number(p.price), size_gb: Number(p.size_gb), agent_price: p.agent_price == null ? null : Number(p.agent_price) })));
    })();
    void loadSchedules();
    return () => { active = false; };
  }, [open, supported, loadSchedules]);

  const digits = phone.replace(/\D/g, "");
  const network = digits.length >= 3 ? detectNetwork(digits) : "unknown";
  const matching = useMemo(
    () => packages.filter((p) => normalizePackageNetwork(p.network) === network),
    [packages, network],
  );
  const priceOf = (p: Pkg) => (ownerType === "agent" ? p.agent_price ?? p.price : p.price);
  const packageById = useMemo(() => new Map(packages.map((p) => [p.id, p])), [packages]);

  useEffect(() => {
    if (packageId && !matching.some((p) => p.id === packageId)) setPackageId("");
  }, [matching, packageId]);

  if (!supported) return null;

  const save = async () => {
    if (digits.length !== 10) return toast.error("Enter a valid 10-digit phone number");
    if (!packageId) return toast.error("Choose a data package");
    setSaving(true);
    const { error } = await supabase.rpc("upsert_data_schedule" as any, {
      p_owner_type: ownerType,
      p_owner_id: ownerId,
      p_phone: digits,
      p_package_id: packageId,
      p_frequency: frequency,
      p_run_time: runTime.length === 5 ? `${runTime}:00` : runTime,
      p_day_of_week: frequency === "weekly" ? Number(dayOfWeek) : null,
      p_day_of_month: frequency === "monthly" ? Number(dayOfMonth) : null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Schedule saved. Your wallet will be charged automatically.");
    setPhone("");
    setPackageId("");
    void loadSchedules();
  };

  const toggle = async (row: Schedule) => {
    const { error } = await supabase.rpc("set_data_schedule_active" as any, { p_id: row.id, p_active: !row.active });
    if (error) return toast.error(error.message);
    void loadSchedules();
  };

  const remove = async (row: Schedule) => {
    const { error } = await supabase.from("scheduled_data_purchases" as any).delete().eq("id", row.id);
    if (error) return toast.error(error.message);
    void loadSchedules();
  };

  const describe = (row: Schedule) => {
    const time = row.run_time.slice(0, 5);
    if (row.frequency === "daily") return `Every day at ${time}`;
    if (row.frequency === "weekly") return `Every ${DAYS[row.day_of_week ?? 0]} at ${time}`;
    return `Day ${row.day_of_month} of every month at ${time}`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {variant === "bar" ? (
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-full border-2 border-primary/60 bg-primary/15 px-4 py-2 text-left transition hover:bg-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CalendarClock className="h-6 w-6 shrink-0 text-foreground" aria-hidden />
            <span className="flex-1 text-center text-sm font-semibold text-foreground">
              Schedule a Data <span className="underline">Purchase</span> <span className="font-normal">(Optional)</span>
            </span>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <ArrowRight className="h-4 w-4" aria-hidden />
            </span>
          </button>
        ) : (
          <Button type="button" variant="outline" className="w-full gap-2 sm:w-auto">
            <CalendarClock className="h-4 w-4" />
            Schedule data purchase
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Schedule data purchase</DialogTitle>
          <DialogDescription>
            Automatically buy data for a number on a schedule. Your wallet is charged at each run, in Ghana time. One schedule per number.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="schedule-phone">Recipient number</Label>
            <Input id="schedule-phone" inputMode="numeric" maxLength={10} placeholder="0241234567" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} />
            {digits.length >= 3 && (
              <p className="text-xs text-muted-foreground">
                {network === "unknown" ? "Network not recognised for this number" : `${NETWORK_LABEL[network]} number`}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Data package</Label>
            <Select value={packageId} onValueChange={setPackageId} disabled={!matching.length}>
              <SelectTrigger><SelectValue placeholder={matching.length ? "Choose a package" : "Enter a number first"} /></SelectTrigger>
              <SelectContent>
                {matching.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.size_gb}GB - GHC {priceOf(p).toFixed(2)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Repeat</Label>
              <Select value={frequency} onValueChange={(v) => setFrequency(v as typeof frequency)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-time">Time</Label>
              <Input id="schedule-time" type="time" value={runTime} onChange={(e) => setRunTime(e.target.value)} />
            </div>
          </div>

          {frequency === "weekly" && (
            <div className="space-y-2">
              <Label>Day of the week</Label>
              <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DAYS.map((d, i) => <SelectItem key={d} value={String(i)}>{d}</SelectItem>)}</SelectContent>
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

          <Button type="button" className="w-full" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save schedule"}
          </Button>
        </div>

        <div className="space-y-2 border-t border-border pt-4">
          <h3 className="text-sm font-semibold">Your schedules</h3>
          {!schedules.length ? (
            <p className="text-sm text-muted-foreground">No schedules yet.</p>
          ) : (
            <ul className="space-y-2">
              {schedules.map((row) => {
                const pkg = packageById.get(row.package_id);
                return (
                  <li key={row.id} className="flex items-start justify-between gap-2 rounded-lg border border-border p-3 text-sm">
                    <div className="min-w-0 space-y-0.5">
                      <p className="font-medium">{row.phone}{pkg ? ` · ${pkg.size_gb}GB` : ""}</p>
                      <p className="text-xs text-muted-foreground">{describe(row)}</p>
                      <p className="text-xs text-muted-foreground">
                        {row.active ? `Next: ${new Date(row.next_run_at).toLocaleString()}` : "Paused"}
                      </p>
                      {row.last_status === "failed" && <p className="text-xs text-destructive">Last run failed: {row.last_error}</p>}
                      {row.last_status === "success" && row.last_run_at && <p className="text-xs text-emerald-600">Last run: {new Date(row.last_run_at).toLocaleString()}</p>}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button type="button" size="icon" variant="ghost" onClick={() => toggle(row)} aria-label={row.active ? "Pause schedule" : "Resume schedule"}>
                        {row.active ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                      </Button>
                      <Button type="button" size="icon" variant="ghost" onClick={() => remove(row)} aria-label="Delete schedule">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
