'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, DollarSign, Package, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AnalyticsData {
  packageName: string;
  registrations: number;
  revenue: number;
  activeUsers: number;
}

interface DailyStats {
  date: string;
  registrations: number;
  revenue: number;
  conversions: number;
}

interface TopPackage {
  name: string;
  registrations: number;
  revenue: number;
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function AFAAnalyticsMonitoring() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  
  // Summary stats
  const [totalRegistrations, setTotalRegistrations] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [activeUsers, setActiveUsers] = useState(0);
  const [conversionRate, setConversionRate] = useState(0);
  
  // Charts data
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [packageAnalytics, setPackageAnalytics] = useState<AnalyticsData[]>([]);
  const [topPackages, setTopPackages] = useState<TopPackage[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<Array<{ name: string; value: number }>>([]);

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const getDaysFromTimeRange = (range: '7d' | '30d' | '90d') => {
    switch (range) {
      case '7d': return 7;
      case '30d': return 30;
      case '90d': return 90;
    }
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const daysBack = getDaysFromTimeRange(timeRange);
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Fetch registrations with related data
      const { data: registrations, error } = await supabase
        .from('afa_registrations')
        .select(`
          id,
          created_at,
          amount_paid,
          registration_status,
          afa_packages:afa_package_id (
            name,
            id
          )
        `)
        .gte('created_at', startDate.toISOString());

      if (error) throw error;

      // Calculate summary stats
      const total = registrations?.length || 0;
      const revenue = registrations?.reduce((sum, r) => sum + (r.amount_paid || 0), 0) || 0;
      const active = registrations?.filter(r => r.registration_status === 'active').length || 0;

      setTotalRegistrations(total);
      setTotalRevenue(revenue);
      setActiveUsers(active);
      setConversionRate(total > 0 ? (active / total) * 100 : 0);

      // Generate daily stats
      const dailyMap = new Map<string, { registrations: number; revenue: number; conversions: number }>();
      registrations?.forEach(reg => {
        const date = new Date(reg.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        if (!dailyMap.has(date)) {
          dailyMap.set(date, { registrations: 0, revenue: 0, conversions: 0 });
        }
        const current = dailyMap.get(date)!;
        current.registrations += 1;
        current.revenue += reg.amount_paid || 0;
        if (reg.registration_status === 'active') current.conversions += 1;
      });

      const daily = Array.from(dailyMap.entries())
        .map(([date, data]) => ({
          date,
          ...data
        }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      setDailyStats(daily);

      // Package analytics
      const packageMap = new Map<string, { name: string; registrations: number; revenue: number; activeUsers: number }>();
      registrations?.forEach(reg => {
        const pkgName = (reg.afa_packages as any)?.name || 'Unknown';
        if (!packageMap.has(pkgName)) {
          packageMap.set(pkgName, { name: pkgName, registrations: 0, revenue: 0, activeUsers: 0 });
        }
        const current = packageMap.get(pkgName)!;
        current.registrations += 1;
        current.revenue += reg.amount_paid || 0;
        if (reg.registration_status === 'active') current.activeUsers += 1;
      });

      const analytics = Array.from(packageMap.values());
      setPackageAnalytics(analytics);

      // Top packages by revenue
      const topByRevenue = analytics
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);
      setTopPackages(topByRevenue);

      // Status breakdown
      const statusMap = new Map<string, number>();
      registrations?.forEach(reg => {
        const status = reg.registration_status || 'unknown';
        statusMap.set(status, (statusMap.get(status) || 0) + 1);
      });

      const breakdown = Array.from(statusMap.entries()).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value
      }));
      setStatusBreakdown(breakdown);

    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Time Range Selection */}
      <div className="flex gap-2">
        {(['7d', '30d', '90d'] as const).map(range => (
          <button
            key={range}
            onClick={() => setTimeRange(range)}
            className={`px-4 py-2 rounded-lg border transition-all ${
              timeRange === range
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:border-primary/50'
            }`}
          >
            {range === '7d' ? 'Last 7 Days' : range === '30d' ? 'Last 30 Days' : 'Last 90 Days'}
          </button>
        ))}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Registrations</p>
                <p className="text-3xl font-bold">{totalRegistrations}</p>
              </div>
              <div className="bg-blue-500/10 p-3 rounded-lg">
                <Users className="h-6 w-6 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-3xl font-bold">GHS {totalRevenue.toFixed(2)}</p>
              </div>
              <div className="bg-green-500/10 p-3 rounded-lg">
                <DollarSign className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Users</p>
                <p className="text-3xl font-bold">{activeUsers}</p>
              </div>
              <div className="bg-purple-500/10 p-3 rounded-lg">
                <TrendingUp className="h-6 w-6 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
                <p className="text-3xl font-bold">{conversionRate.toFixed(1)}%</p>
              </div>
              <div className="bg-orange-500/10 p-3 rounded-lg">
                <Package className="h-6 w-6 text-orange-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="revenue" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="revenue">Revenue Trend</TabsTrigger>
          <TabsTrigger value="packages">By Package</TabsTrigger>
          <TabsTrigger value="status">Status Breakdown</TabsTrigger>
        </TabsList>

        <TabsContent value="revenue" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Daily Revenue Trend</CardTitle>
            </CardHeader>
            <CardContent>
              {dailyStats.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={dailyStats}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10b981"
                      name="Revenue (GHS)"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="registrations"
                      stroke="#3b82f6"
                      name="Registrations"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="packages" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Revenue by Package</CardTitle>
            </CardHeader>
            <CardContent>
              {packageAnalytics.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={packageAnalytics}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="packageName" fontSize={12} />
                    <YAxis fontSize={12} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="revenue" fill="#10b981" name="Revenue (GHS)" />
                    <Bar dataKey="registrations" fill="#3b82f6" name="Registrations" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}
            </CardContent>
          </Card>

          {topPackages.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top 5 Packages by Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topPackages.map((pkg, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <div className="text-sm font-semibold text-muted-foreground">#{idx + 1}</div>
                        <div>
                          <p className="font-semibold">{pkg.name}</p>
                          <p className="text-sm text-muted-foreground">{pkg.registrations} registrations</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">GHS {pkg.revenue.toFixed(2)}</p>
                        <p className="text-sm text-muted-foreground">{(pkg.revenue / totalRevenue * 100).toFixed(1)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Registration Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              {statusBreakdown.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusBreakdown}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusBreakdown.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-64 flex items-center justify-center text-muted-foreground">
                  No data available
                </div>
              )}

              {statusBreakdown.length > 0 && (
                <div className="grid grid-cols-2 gap-3 mt-6">
                  {statusBreakdown.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 rounded-lg border border-border">
                      <div className="w-3 h-3 rounded-full" style={{ background: COLORS[idx % COLORS.length] }} />
                      <div className="flex-1">
                        <p className="text-sm font-semibold">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.value} ({(item.value / totalRegistrations * 100).toFixed(1)}%)</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
