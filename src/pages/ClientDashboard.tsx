import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, LogOut, Calendar, Clock, ArrowLeftRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Booking {
  id: string;
  booking_date: string;
  status: string;
  notes: string | null;
  client_name: string;
  profiles: {
    full_name: string;
    business_name: string | null;
  };
  services: {
    title: string;
    price: number;
    duration: number;
  };
}

const ClientDashboard = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
    fetchBookings();
    fetchUserProfile();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);
  };

  const fetchUserProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      if (error) throw error;
      setUserProfile(data);
    } catch (error: any) {
      console.error("Error fetching profile:", error);
    }
  };

  const handleSwitchToBusinessDashboard = async () => {
    try {
      // Check if user already has creator role
      if (userProfile?.role === "creator") {
        navigate("/dashboard");
        return;
      }

      // Update user role to creator
      const { error } = await supabase
        .from("profiles")
        .update({ role: "creator" })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Switched to Business account! Please complete your profile setup.");
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Error switching to business:", error);
      toast.error("Failed to switch to business account");
    }
  };

  const fetchBookings = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) return;

      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          profiles:creator_id(full_name, business_name),
          services:service_id(title, price, duration)
        `)
        .eq("client_email", session.user.email)
        .order("booking_date", { ascending: false });

      if (error) throw error;
      setBookings(data || []);
    } catch (error: any) {
      console.error("Error fetching bookings:", error);
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Failed to logout");
    } else {
      toast.success("Logged out successfully");
      navigate("/");
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "confirmed":
        return "default";
      case "pending":
        return "secondary";
      case "cancelled":
        return "destructive";
      default:
        return "outline";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <div className="container mx-auto p-6 max-w-6xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold">My Bookings</h1>
            <p className="text-muted-foreground mt-1">
              Welcome back, {user?.email}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSwitchToBusinessDashboard}>
              <ArrowLeftRight className="mr-2 h-4 w-4" />
              Business View
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Bookings List */}
        {bookings.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">No bookings yet</p>
                <p className="text-muted-foreground">
                  Your bookings will appear here once you make a reservation
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {bookings.map((booking) => (
              <Card key={booking.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-xl">
                        {booking.services.title}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        with {booking.profiles.business_name || booking.profiles.full_name}
                      </CardDescription>
                    </div>
                    <Badge variant={getStatusVariant(booking.status)}>
                      {booking.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Date & Time */}
                    <div className="space-y-2">
                      <div className="flex items-center text-sm">
                        <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span className="font-medium">
                          {format(new Date(booking.booking_date), "PPP")}
                        </span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span>
                          {format(new Date(booking.booking_date), "p")} ({booking.services.duration} min)
                        </span>
                      </div>
                    </div>

                    {/* Service Details */}
                    <div>
                      <p className="font-medium mb-2">Service Details</p>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>Price: ${booking.services.price.toFixed(2)}</p>
                        <p>Client: {booking.client_name}</p>
                      </div>
                    </div>
                  </div>

                  {booking.notes && (
                    <div className="mt-4 pt-4 border-t">
                      <p className="font-medium text-sm mb-1">Notes</p>
                      <p className="text-sm text-muted-foreground">{booking.notes}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientDashboard;
