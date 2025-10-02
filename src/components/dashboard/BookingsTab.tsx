import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Calendar, Clock, Mail, Phone, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";

interface Booking {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  booking_date: string;
  status: string;
  notes: string | null;
  services: {
    title: string;
    price: number;
    duration: number;
  };
}

const BookingsTab = ({ userId }: { userId: string }) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookings();
  }, [userId]);

  const fetchBookings = async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select(`
        *,
        services (
          title,
          price,
          duration
        )
      `)
      .eq('creator_id', userId)
      .order('booking_date', { ascending: true });

    if (error) {
      console.error("Error fetching bookings:", error);
      toast.error("Failed to load bookings");
    } else {
      setBookings(data || []);
    }
    setLoading(false);
  };

  const handleStatusUpdate = async (bookingId: string, newStatus: string) => {
    const { error } = await supabase
      .from('bookings')
      .update({ status: newStatus })
      .eq('id', bookingId);

    if (error) {
      toast.error("Failed to update booking");
    } else {
      toast.success(`Booking ${newStatus}`);
      fetchBookings();
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      accepted: "default",
      declined: "destructive",
      completed: "outline",
    };
    
    return (
      <Badge variant={variants[status] || "secondary"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (loading) {
    return <div className="text-center py-8">Loading bookings...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Booking Requests</h2>
        <p className="text-muted-foreground">Manage your upcoming appointments</p>
      </div>

      {bookings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No bookings yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Share your booking link to start receiving requests
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <Card key={booking.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl">{booking.services.title}</CardTitle>
                    <CardDescription className="flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(new Date(booking.booking_date), "PPP")}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {format(new Date(booking.booking_date), "p")}
                      </span>
                    </CardDescription>
                  </div>
                  {getStatusBadge(booking.status)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="font-medium mb-2">Client Information</p>
                    <div className="space-y-1 text-muted-foreground">
                      <p>{booking.client_name}</p>
                      <p className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {booking.client_email}
                      </p>
                      {booking.client_phone && (
                        <p className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {booking.client_phone}
                        </p>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="font-medium mb-2">Service Details</p>
                    <div className="space-y-1 text-muted-foreground">
                      <p>Price: ${booking.services.price.toFixed(2)}</p>
                      <p>Duration: {booking.services.duration} min</p>
                    </div>
                  </div>
                </div>

                {booking.notes && (
                  <div className="pt-2 border-t">
                    <p className="font-medium text-sm mb-1">Client Notes</p>
                    <p className="text-sm text-muted-foreground">{booking.notes}</p>
                  </div>
                )}

                {booking.status === 'pending' && (
                  <div className="flex gap-2 pt-2 border-t">
                    <Button
                      onClick={() => handleStatusUpdate(booking.id, 'accepted')}
                      className="flex-1"
                    >
                      <CheckCircle className="mr-2 h-4 w-4" />
                      Accept
                    </Button>
                    <Button
                      onClick={() => handleStatusUpdate(booking.id, 'declined')}
                      variant="outline"
                      className="flex-1"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Decline
                    </Button>
                  </div>
                )}

                {booking.status === 'accepted' && (
                  <Button
                    onClick={() => handleStatusUpdate(booking.id, 'completed')}
                    variant="outline"
                    className="w-full"
                  >
                    Mark as Completed
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default BookingsTab;
