import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { format, isSameDay } from "date-fns";
import { Clock, Mail, Phone, CheckCircle, XCircle } from "lucide-react";
import { sendBookingConfirmationEmail } from "@/lib/emails";

interface Booking {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  booking_date: string;
  status: string;
  notes: string | null;
  payment_intent_id: string | null;
  services: {
    title: string;
    price: number;
    duration: number;
  };
}

const CalendarTab = ({ userId }: { userId: string }) => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [selectedDateBookings, setSelectedDateBookings] = useState<Booking[]>([]);

  useEffect(() => {
    fetchBookings();
  }, [userId]);

  useEffect(() => {
    if (selectedDate) {
      const dayBookings = bookings.filter(booking =>
        isSameDay(new Date(booking.booking_date), selectedDate)
      );
      setSelectedDateBookings(dayBookings);
    }
  }, [selectedDate, bookings]);

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
    const booking = bookings.find(b => b.id === bookingId);
    
    const { error } = await supabase
      .from('bookings')
      .update({ status: newStatus })
      .eq('id', bookingId);

    if (error) {
      toast.error("Failed to update booking");
    } else {
      if (booking && (newStatus === 'accepted' || newStatus === 'declined')) {
        await sendBookingConfirmationEmail(
          booking.client_email,
          booking.client_name,
          booking.services.title,
          format(new Date(booking.booking_date), "PPP 'at' p"),
          newStatus as 'accepted' | 'declined'
        );
      }
      
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

  const getDayModifiers = () => {
    const bookedDates = bookings.map(b => new Date(b.booking_date));
    return {
      booked: bookedDates
    };
  };

  const modifiersClassNames = {
    booked: "relative after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-primary"
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full glass animate-pulse">
            <Clock className="h-6 w-6 text-primary" />
          </div>
          <p className="text-foreground font-medium">Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Schedule</h2>
        <p className="text-muted-foreground">View and manage your appointments</p>
      </div>

      <div className="grid lg:grid-cols-[auto_1fr] gap-6">
        {/* Calendar */}
        <Card className="w-fit">
          <CardContent className="p-6">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              modifiers={getDayModifiers()}
              modifiersClassNames={modifiersClassNames}
              className="rounded-md"
            />
          </CardContent>
        </Card>

        {/* Bookings for Selected Date */}
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">
              {selectedDate ? format(selectedDate, "EEEE, MMMM d, yyyy") : "Select a date"}
            </h3>
            
            {selectedDateBookings.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Clock className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No bookings for this date</p>
              </div>
            ) : (
              <div className="space-y-4">
                {selectedDateBookings.map((booking) => (
                  <Card key={booking.id} className="border-2">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <h4 className="font-semibold text-lg">{booking.services.title}</h4>
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(booking.booking_date), "p")} ({booking.services.duration} min)
                          </p>
                        </div>
                        {getStatusBadge(booking.status)}
                      </div>

                      <div className="space-y-2 text-sm">
                        <div>
                          <p className="font-medium">Client</p>
                          <p className="text-muted-foreground">{booking.client_name}</p>
                          <p className="text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {booking.client_email}
                          </p>
                          {booking.client_phone && (
                            <p className="text-muted-foreground flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {booking.client_phone}
                            </p>
                          )}
                        </div>

                        {booking.notes && (
                          <div className="pt-2 border-t">
                            <p className="font-medium">Notes</p>
                            <p className="text-muted-foreground">{booking.notes}</p>
                          </div>
                        )}
                      </div>

                      {booking.status === 'pending' && (
                        <div className="flex gap-2 pt-2 border-t">
                          <Button
                            onClick={() => handleStatusUpdate(booking.id, 'accepted')}
                            size="sm"
                            className="flex-1"
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Accept
                          </Button>
                          <Button
                            onClick={() => handleStatusUpdate(booking.id, 'declined')}
                            variant="outline"
                            size="sm"
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
                          size="sm"
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CalendarTab;
