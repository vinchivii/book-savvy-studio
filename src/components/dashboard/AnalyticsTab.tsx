import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { DollarSign, TrendingUp, Users, Calendar } from "lucide-react";

interface Analytics {
  totalRevenue: number;
  thisMonthRevenue: number;
  lastMonthRevenue: number;
  totalBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  avgSpendPerClient: number;
  topServices: Array<{ name: string; revenue: number; count: number }>;
  revenueByMonth: Array<{ month: string; revenue: number }>;
}

const AnalyticsTab = ({ userId }: { userId: string }) => {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [userId]);

  const fetchAnalytics = async () => {
    try {
      // Fetch all bookings
      const { data: bookings, error: bookingsError } = await supabase
        .from("bookings")
        .select("*, services(title, price)")
        .eq("creator_id", userId);

      if (bookingsError) throw bookingsError;

      // Fetch clients
      const { data: clients, error: clientsError } = await supabase
        .from("clients")
        .select("total_spent")
        .eq("creator_id", userId);

      if (clientsError) throw clientsError;

      const now = new Date();
      const thisMonth = now.getMonth();
      const thisYear = now.getFullYear();
      const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
      const lastMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

      // Calculate analytics
      const paidBookings = bookings?.filter(b => b.payment_status === "paid") || [];
      const totalRevenue = paidBookings.reduce((sum, b) => sum + Number(b.price_at_booking), 0);

      const thisMonthBookings = paidBookings.filter(b => {
        const date = new Date(b.booking_date);
        return date.getMonth() === thisMonth && date.getFullYear() === thisYear;
      });
      const thisMonthRevenue = thisMonthBookings.reduce((sum, b) => sum + Number(b.price_at_booking), 0);

      const lastMonthBookings = paidBookings.filter(b => {
        const date = new Date(b.booking_date);
        return date.getMonth() === lastMonth && date.getFullYear() === lastMonthYear;
      });
      const lastMonthRevenue = lastMonthBookings.reduce((sum, b) => sum + Number(b.price_at_booking), 0);

      const pendingBookings = bookings?.filter(b => b.status === "pending").length || 0;
      const cancelledBookings = bookings?.filter(b => b.status === "cancelled").length || 0;

      const avgSpendPerClient = clients && clients.length > 0
        ? clients.reduce((sum, c) => sum + Number(c.total_spent), 0) / clients.length
        : 0;

      // Top services
      const serviceMap = new Map();
      paidBookings.forEach(booking => {
        const service = Array.isArray(booking.services) ? booking.services[0] : booking.services;
        if (service) {
          const existing = serviceMap.get(service.title) || { name: service.title, revenue: 0, count: 0 };
          existing.revenue += Number(booking.price_at_booking);
          existing.count += 1;
          serviceMap.set(service.title, existing);
        }
      });
      const topServices = Array.from(serviceMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      // Revenue by month (last 6 months)
      const revenueByMonth = [];
      for (let i = 5; i >= 0; i--) {
        const month = new Date(thisYear, thisMonth - i, 1);
        const monthBookings = paidBookings.filter(b => {
          const date = new Date(b.booking_date);
          return date.getMonth() === month.getMonth() && date.getFullYear() === month.getFullYear();
        });
        const revenue = monthBookings.reduce((sum, b) => sum + Number(b.price_at_booking), 0);
        revenueByMonth.push({
          month: month.toLocaleDateString("en-US", { month: "short" }),
          revenue,
        });
      }

      setAnalytics({
        totalRevenue,
        thisMonthRevenue,
        lastMonthRevenue,
        totalBookings: bookings?.length || 0,
        pendingBookings,
        cancelledBookings,
        avgSpendPerClient,
        topServices,
        revenueByMonth,
      });
    } catch (error: any) {
      console.error("Error fetching analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading analytics...</div>;
  }

  if (!analytics) {
    return <div className="text-center py-8">No data available</div>;
  }

  const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8"];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Analytics Dashboard</h2>
        <p className="text-muted-foreground">Track your business performance</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${analytics.totalRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">All-time earnings</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${analytics.thisMonthRevenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.lastMonthRevenue > 0
                ? `${(((analytics.thisMonthRevenue - analytics.lastMonthRevenue) / analytics.lastMonthRevenue) * 100).toFixed(1)}% from last month`
                : "First month"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Per Client</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${analytics.avgSpendPerClient.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">Average lifetime value</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalBookings}</div>
            <p className="text-xs text-muted-foreground">
              {analytics.pendingBookings} pending, {analytics.cancelledBookings} cancelled
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Month */}
        <Card>
          <CardHeader>
            <CardTitle>Revenue Trend</CardTitle>
            <CardDescription>Last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analytics.revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                <Legend />
                <Bar dataKey="revenue" fill="#0088FE" name="Revenue" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Services */}
        <Card>
          <CardHeader>
            <CardTitle>Top Services by Revenue</CardTitle>
            <CardDescription>Best performing services</CardDescription>
          </CardHeader>
          <CardContent>
            {analytics.topServices.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={analytics.topServices}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="revenue"
                  >
                    {analytics.topServices.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `$${Number(value).toFixed(2)}`} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No services data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Services Table */}
      {analytics.topServices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Service Performance</CardTitle>
            <CardDescription>Detailed breakdown of your services</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.topServices.map((service, idx) => (
                <div key={idx} className="flex justify-between items-center">
                  <div>
                    <p className="font-medium">{service.name}</p>
                    <p className="text-sm text-muted-foreground">{service.count} bookings</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">${service.revenue.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">
                      ${(service.revenue / service.count).toFixed(2)} avg
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AnalyticsTab;
