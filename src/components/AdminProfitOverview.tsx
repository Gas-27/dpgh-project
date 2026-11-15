import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PROFIT_PERIODS,
  formatCount,
  formatGb,
  formatMoney,
  num,
  profitRpcOrThrow,
  profitTone,
  type ProfitPeriod,
  type ProfitReport,
} from "@/lib/adminProfit";

interface Range {
  from: string | null;
  to: string | null;
}

function startOfDayIso(date: string): string {
  return new Date(`${date}T00:00:00`).toISOString();
}

function endOfDayIso(date: string): string {
  return new Date(`${date}T23:59:59.999`).toISOString();
}

function formatRange(from?: string, to?: string): string {
  if (!from || !to) return "";
  const fmt = (value: string) =>
    new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
  const start = fmt(from);
  const end = fmt(to);
  return start === end ? start : `${start} - ${end}`;
}

interface Row {
  label: string;
  value: string;
  tone?: string;
}

function ServiceCard({ title, count, rows, profit, children }: {
  title: string;
  count: string;
  rows: Row[];
  profit: number;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          <span className="text-xs text-muted-foreground">{count}</span>
        </div>
        <p className={`text-2xl font-bold ${profitTone(profit)}`}>{formatMoney(profit)}</p>
        <p className="text-xs text-muted-foreground">Profit</p>
      </CardHeader>
      <CardContent className="space-y-1.5 text-sm">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">{row.label}</span>
            <span className={`font-medium ${row.tone ?? ""}`}>{row.value}</span>
          </div>
        ))}
        {children}
      </CardContent>
    </Card>
  );
}

function Warning({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-300"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="space-y-1">{children}</div>
    </div>
  );
}

export default function AdminProfitOverview() {
  const [period, setPeriod] = useState<ProfitPeriod>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [appliedRange, setAppliedRange] = useState<Range>({ from: null, to: null });

  const customReady = period !== "custom" || (appliedRange.from !== null && appliedRange.to !== null);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin-profit-report", period, appliedRange.from, appliedRange.to],
    enabled: customReady,
    queryFn: () =>
      profitRpcOrThrow<ProfitReport>("admin_profit_report", {
        p_period: period,
        p_from: period === "custom" ? appliedRange.from : null,
        p_to: period === "custom" ? appliedRange.to : null,
      }),
  });

  const applyCustom = () => {
    if (!customFrom || !customTo) return;
    const [from, to] = customFrom <= customTo ? [customFrom, customTo] : [customTo, customFrom];
    setAppliedRange({ from: startOfDayIso(from), to: endOfDayIso(to) });
  };

  const chartData = useMemo(
    () =>
      (data?.data_daily ?? []).map((row) => ({
        day: new Date(row.day).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
        profit: num(row.revenue) - num(row.cost),
      })),
    [data],
  );

  const missingPackages = data?.data_packages_missing_cost ?? [];
  const utilityTypes = data?.utilities?.by_type ?? [];
  const allCommissionsZero = utilityTypes.length > 0 && utilityTypes.every((row) => num(row.commission_percent) === 0);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {PROFIT_PERIODS.map((option) => (
            <Button
              key={option.value}
              size="sm"
              variant={period === option.value ? "default" : "outline"}
              onClick={() => setPeriod(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
        {period === "custom" && (
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label htmlFor="profit-from">From</Label>
              <Input id="profit-from" type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="profit-to">To</Label>
              <Input id="profit-to" type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
            <Button size="sm" onClick={applyCustom} disabled={!customFrom || !customTo}>
              Apply
            </Button>
          </div>
        )}
      </div>

      {period === "custom" && !customReady && (
        <p className="text-sm text-muted-foreground">Pick a start and end date, then tap Apply.</p>
      )}

      {isLoading && customReady && (
        <div className="flex items-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading profit report...
        </div>
      )}

      {error && (
        <Warning>
          <p>Could not load the profit report: {(error as Error).message}</p>
          <Button size="sm" variant="outline" onClick={() => void refetch()}>
            Try again
          </Button>
        </Warning>
      )}

      {data && (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4 md:p-6">
              <div>
                <p className="text-sm text-muted-foreground">Total profit</p>
                <p className={`text-3xl font-bold md:text-4xl ${profitTone(data.total_profit)}`}>
                  {formatMoney(data.total_profit)}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{formatRange(data.from, data.to)}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => void refetch()} disabled={isFetching}>
                {isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Refresh
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-2">
            {num(data.data.missing_cost) > 0 && (
              <Warning>
                <p>
                  {formatCount(data.data.missing_cost)} data orders have no provider cost set, so their profit is
                  overstated. Set costs in the Cost prices tab.
                </p>
                {missingPackages.length > 0 && (
                  <ul className="list-disc space-y-0.5 pl-5">
                    {missingPackages.map((pkg) => (
                      <li key={`${pkg.package_id}-${pkg.provider ?? "none"}`}>
                        {pkg.network} {num(pkg.size_gb)}GB
                        {pkg.provider ? ` (${pkg.provider})` : ""} - {formatCount(pkg.orders)} orders
                      </li>
                    ))}
                  </ul>
                )}
              </Warning>
            )}
            {!data.sms.cost_per_page_set && (
              <Warning>
                <p>Set your SMS cost per page in the Cost prices tab so Bulk SMS profit is accurate.</p>
              </Warning>
            )}
            {num(data.social_boost.missing_cost) > 0 && (
              <Warning>
                <p>
                  {formatCount(data.social_boost.missing_cost)} Social Boost orders have no cost set, so their profit
                  is overstated. Set your costs in the Cost prices tab.
                </p>
              </Warning>
            )}
            {allCommissionsZero && (
              <Warning>
                <p>Set your Korba commission % in the Cost prices tab so utilities profit is accurate.</p>
              </Warning>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <ServiceCard
              title="Data"
              count={`${formatCount(data.data.orders)} orders`}
              profit={data.data.profit}
              rows={[
                { label: "GB sold", value: formatGb(data.data.gb) },
                { label: "Sales", value: formatMoney(data.data.sales) },
                { label: "Revenue (kept)", value: formatMoney(data.data.revenue) },
                { label: "Reseller commission", value: formatMoney(data.data.reseller_commission) },
                { label: "Paystack fees", value: formatMoney(data.data.paystack_fees) },
                { label: "Cost", value: formatMoney(data.data.cost) },
              ]}
            />

            <ServiceCard
              title="Utilities"
              count={`${formatCount(data.utilities.transactions)} transactions`}
              profit={data.utilities.profit}
              rows={[
                { label: "Sales", value: formatMoney(data.utilities.sales) },
                { label: "Revenue (kept)", value: formatMoney(data.utilities.revenue) },
                { label: "Cost", value: formatMoney(data.utilities.cost) },
              ]}
            >
              {utilityTypes.length > 0 && (
                <div className="mt-2 space-y-1 border-t border-border pt-2">
                  {utilityTypes.map((row) => (
                    <div key={row.type} className="flex items-center justify-between gap-2 text-xs">
                      <span className="uppercase text-muted-foreground">
                        {row.type} ({formatCount(row.transactions)}) - {num(row.commission_percent)}%
                      </span>
                      <span className={`font-medium ${profitTone(row.profit)}`}>{formatMoney(row.profit)}</span>
                    </div>
                  ))}
                </div>
              )}
            </ServiceCard>

            <ServiceCard
              title="Bulk SMS"
              count={`${formatCount(data.sms.campaigns)} campaigns`}
              profit={data.sms.profit}
              rows={[
                { label: "Messages sent", value: formatCount(data.sms.messages_sent) },
                { label: "Pages sent", value: formatCount(data.sms.pages_sent) },
                { label: "Revenue (kept)", value: formatMoney(data.sms.revenue) },
                { label: "Cost", value: formatMoney(data.sms.cost) },
              ]}
            />

            <ServiceCard
              title="Social Boost"
              count={`${formatCount(data.social_boost.orders)} orders`}
              profit={data.social_boost.profit}
              rows={[
                { label: "Sales", value: formatMoney(data.social_boost.sales) },
                { label: "Revenue (kept)", value: formatMoney(data.social_boost.revenue) },
                { label: "Cost", value: formatMoney(data.social_boost.cost) },
              ]}
            />

            <ServiceCard
              title="Free data given away"
              count={`${formatCount(data.free_data.orders)} orders`}
              profit={data.free_data.profit}
              rows={[
                { label: "GB given", value: formatGb(data.free_data.gb) },
                { label: "Cost", value: formatMoney(data.free_data.cost) },
              ]}
            >
              <p className="pt-1 text-xs text-muted-foreground">Game Hub claims and spin wheel rewards.</p>
            </ServiceCard>
          </div>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Data profit per day</CardTitle>
            </CardHeader>
            <CardContent>
              {chartData.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No data sales in this period.</p>
              ) : (
                <div className="h-64 w-full" role="img" aria-label="Bar chart of data profit per day">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                      <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={48} />
                      <Tooltip
                        formatter={(value: number) => [formatMoney(value), "Profit"]}
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: 8,
                          color: "hsl(var(--foreground))",
                        }}
                      />
                      <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                        {chartData.map((entry) => (
                          <Cell
                            key={entry.day}
                            fill={entry.profit >= 0 ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
