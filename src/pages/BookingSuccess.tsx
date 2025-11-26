import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Calendar, Clock, DollarSign, Home } from "lucide-react";

export default function BookingSuccess() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const bookingId = searchParams.get("bookingId");
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (bookingId) {
      fetchBooking();
    }
  }, [bookingId]);

  const fetchBooking = async () => {
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          services(*),
          profiles(full_name, business_name)
        `)
        .eq("id", bookingId)
        .single();

      if (error) throw error;
      setBooking(data);
    } catch (error) {
      console.error("Error fetching booking:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-subtle">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-subtle">
        <Card className="glass-card max-w-md w-full mx-4">
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Booking not found</p>
            <Button onClick={() => navigate("/")} className="mt-4">
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const bookingDate = new Date(booking.booking_date);

  return (
    <div className="min-h-screen gradient-subtle py-12 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        <Card className="glass-card">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-green-500/10 p-4">
                <CheckCircle className="h-16 w-16 text-green-500" />
              </div>
            </div>
            <CardTitle className="text-3xl">Booking Confirmed!</CardTitle>
            <p className="text-muted-foreground mt-2">
              Payment received successfully
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="glass-card p-6 space-y-4">
              <div className="flex items-start gap-4">
                <Calendar className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Date & Time</p>
                  <p className="text-muted-foreground">
                    {bookingDate.toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                  <p className="text-muted-foreground">
                    {bookingDate.toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Clock className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Service</p>
                  <p className="text-muted-foreground">
                    {booking.services.title}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Duration: {booking.services.duration} minutes
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <DollarSign className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Amount Paid</p>
                  <p className="text-muted-foreground">
                    ${booking.price_at_booking.toFixed(2)} {booking.currency.toUpperCase()}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <Home className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Provider</p>
                  <p className="text-muted-foreground">
                    {booking.profiles.business_name || booking.profiles.full_name}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <p className="text-sm text-center">
                A confirmation email has been sent to{" "}
                <span className="font-medium">{booking.client_email}</span>
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <Button onClick={() => navigate("/")} className="w-full">
                Return to Home
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
