import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, LogOut, Calendar, Clock, Settings, User, Mail, Phone, Star, X, Edit } from "lucide-react";
import { toast } from "sonner";
import { format, isPast, isFuture } from "date-fns";
import { NotificationBell } from "@/components/NotificationBell";

interface Booking {
  id: string;
  booking_date: string;
  status: string;
  payment_status: string;
  notes: string | null;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  price_at_booking: number;
  profiles: {
    full_name: string;
    business_name: string | null;
    slug: string;
  };
  services: {
    title: string;
    price: number;
    duration: number;
  };
}

interface Review {
  id: string;
  booking_id: string;
}

const ClientDashboard = () => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [cancellingBookingId, setCancellingBookingId] = useState<string | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState({
    full_name: "",
    phone: "",
  });
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (user) {
      fetchBookings();
      fetchReviews();
      fetchUserProfile();
    }
  }, [user]);

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
      
      // Check if user has client role
      if (data?.role === "creator") {
        toast.info("You're viewing as Business. Switch to Client role in Settings to see this page.");
        navigate("/dashboard");
      }
    } catch (error: any) {
      console.error("Error fetching profile:", error);
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
          profiles:creator_id(full_name, business_name, slug),
          services:service_id(title, price, duration)
        `)
        .eq("client_email", session.user.email)
        .order("booking_date", { ascending: false });

      if (error) throw error;
      setBookings(data || []);
      
      // Set edit form data from first booking or profile
      if (data && data.length > 0) {
        setEditFormData({
          full_name: data[0].client_name || "",
          phone: data[0].client_phone || "",
        });
      }
    } catch (error: any) {
      console.error("Error fetching bookings:", error);
      toast.error("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.email) return;

      // Get all reviews for bookings made by this client
      const { data, error } = await supabase
        .from("reviews")
        .select("id, booking_id")
        .in("booking_id", bookings.map(b => b.id));

      if (error) throw error;
      setReviews(data || []);
    } catch (error: any) {
      console.error("Error fetching reviews:", error);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    setCancellingBookingId(bookingId);
    
    try {
      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", bookingId)
        .select("*, profiles(*), services(*)")
        .single();

      if (bookingError) throw bookingError;

      // Get client user to send notification
      if (booking) {
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const clientUser = users?.find((u: any) => u.email === booking.client_email);

        if (clientUser) {
          await supabase.from("notifications").insert({
            user_id: clientUser.id,
            type: "booking_cancelled",
            title: "Booking Cancelled",
            body: `Your booking for ${booking.services.title} has been cancelled.`,
            action_url: "/client-dashboard",
          });
        }
      }

      toast.success("Booking cancelled successfully");
      fetchBookings(); // Refresh bookings
    } catch (error: any) {
      console.error("Error cancelling booking:", error);
      toast.error("Failed to cancel booking");
    } finally {
      setCancellingBookingId(null);
    }
  };

  const handleUpdateInfo = async () => {
    try {
      if (!user?.email) return;

      // Update all future bookings with new info
      const { error } = await supabase
        .from("bookings")
        .update({
          client_name: editFormData.full_name,
          client_phone: editFormData.phone,
        })
        .eq("client_email", user.email)
        .gte("booking_date", new Date().toISOString());

      if (error) throw error;

      toast.success("Contact information updated");
      setEditModalOpen(false);
      fetchBookings();
    } catch (error: any) {
      console.error("Error updating info:", error);
      toast.error("Failed to update information");
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

  const getPaymentStatusVariant = (status: string) => {
    switch (status) {
      case "paid":
        return "default";
      case "pending":
        return "secondary";
      case "unpaid":
        return "destructive";
      default:
        return "outline";
    }
  };

  const hasReview = (bookingId: string) => {
    return reviews.some(r => r.booking_id === bookingId);
  };

  const upcomingBookings = bookings.filter(b => 
    isFuture(new Date(b.booking_date)) && b.status !== "cancelled"
  );

  const pastBookings = bookings.filter(b => 
    isPast(new Date(b.booking_date)) || b.status === "cancelled"
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto p-6 max-w-7xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold">Client Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Manage your bookings and appointments
            </p>
          </div>
          <div className="flex gap-2">
            <NotificationBell />
            <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Edit className="mr-2 h-4 w-4" />
                  Update Info
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Update Contact Information</DialogTitle>
                  <DialogDescription>
                    Update your default contact details used for bookings
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={editFormData.full_name}
                      onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={user?.email || ""}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={editFormData.phone}
                      onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpdateInfo}>
                    Save Changes
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            
            <Button variant="outline" onClick={() => navigate("/settings")}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
            <Button variant="outline" onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>

        {/* Client Info Card */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Your Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{editFormData.full_name || "Not set"}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{user?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{editFormData.phone || "Not set"}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bookings Tabs */}
        <Tabs defaultValue="upcoming" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="upcoming">
              <Calendar className="mr-2 h-4 w-4" />
              Upcoming ({upcomingBookings.length})
            </TabsTrigger>
            <TabsTrigger value="past">
              <Clock className="mr-2 h-4 w-4" />
              Past ({pastBookings.length})
            </TabsTrigger>
          </TabsList>

          {/* Upcoming Bookings */}
          <TabsContent value="upcoming" className="space-y-4">
            {upcomingBookings.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-medium mb-2">No upcoming bookings</p>
                    <p className="text-muted-foreground">
                      Browse services and book your next appointment
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              upcomingBookings.map((booking) => (
                <Card key={booking.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-xl">
                          {booking.services.title}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          with{" "}
                          <Link
                            to={`/book/${booking.profiles.slug}`}
                            className="underline hover:text-foreground"
                          >
                            {booking.profiles.business_name || booking.profiles.full_name}
                          </Link>
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={getStatusVariant(booking.status)}>
                          {booking.status}
                        </Badge>
                        <Badge variant={getPaymentStatusVariant(booking.payment_status)}>
                          {booking.payment_status}
                        </Badge>
                      </div>
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
                        <p className="font-medium mb-2">Booking Details</p>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <p>Amount: ${booking.price_at_booking.toFixed(2)}</p>
                          <p>Status: {booking.payment_status === "paid" ? "Paid" : "Payment Pending"}</p>
                        </div>
                      </div>
                    </div>

                    {booking.notes && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="font-medium text-sm mb-1">Notes</p>
                        <p className="text-sm text-muted-foreground">{booking.notes}</p>
                      </div>
                    )}

                    {/* Actions */}
                    {booking.payment_status !== "paid" && booking.status !== "cancelled" && (
                      <div className="mt-4 pt-4 border-t">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={cancellingBookingId === booking.id}
                            >
                              {cancellingBookingId === booking.id ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Cancelling...
                                </>
                              ) : (
                                <>
                                  <X className="mr-2 h-4 w-4" />
                                  Cancel Booking
                                </>
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to cancel this booking? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Keep Booking</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleCancelBooking(booking.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Yes, Cancel Booking
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Past Bookings */}
          <TabsContent value="past" className="space-y-4">
            {pastBookings.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-12">
                    <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-medium mb-2">No past bookings</p>
                    <p className="text-muted-foreground">
                      Your completed bookings will appear here
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              pastBookings.map((booking) => (
                <Card key={booking.id} className="hover:shadow-md transition-shadow">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <CardTitle className="text-xl">
                          {booking.services.title}
                        </CardTitle>
                        <CardDescription className="mt-1">
                          with{" "}
                          <Link
                            to={`/book/${booking.profiles.slug}`}
                            className="underline hover:text-foreground"
                          >
                            {booking.profiles.business_name || booking.profiles.full_name}
                          </Link>
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant={getStatusVariant(booking.status)}>
                          {booking.status}
                        </Badge>
                        {hasReview(booking.id) && (
                          <Badge variant="secondary">
                            <Star className="h-3 w-3 mr-1 fill-current" />
                            Reviewed
                          </Badge>
                        )}
                      </div>
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
                        <p className="font-medium mb-2">Booking Details</p>
                        <div className="space-y-1 text-sm text-muted-foreground">
                          <p>Amount: ${booking.price_at_booking.toFixed(2)}</p>
                          <p>Status: {booking.status === "completed" ? "Completed" : "Cancelled"}</p>
                        </div>
                      </div>
                    </div>

                    {booking.notes && (
                      <div className="mt-4 pt-4 border-t">
                        <p className="font-medium text-sm mb-1">Notes</p>
                        <p className="text-sm text-muted-foreground">{booking.notes}</p>
                      </div>
                    )}

                    {/* Review Action */}
                    {booking.status === "confirmed" && !hasReview(booking.id) && (
                      <div className="mt-4 pt-4 border-t">
                        <Link to={`/review/${booking.id}`}>
                          <Button variant="outline" size="sm">
                            <Star className="mr-2 h-4 w-4" />
                            Leave a Review
                          </Button>
                        </Link>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ClientDashboard;
