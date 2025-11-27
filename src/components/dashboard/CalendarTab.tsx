import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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

const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const CalendarDay: React.FC<{ 
  day: number | string; 
  isHeader?: boolean;
  bookingCount?: number;
  isToday?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
}> = ({ day, isHeader, bookingCount, isToday, isSelected, onClick }) => {
  if (isHeader) {
    return (
      <div className="col-span-1 row-span-1 flex h-8 w-8 items-center justify-center">
        <span className="font-medium text-xs text-muted-foreground">{day}</span>
      </div>
    );
  }

  const baseClasses = "col-span-1 row-span-1 flex flex-col items-center justify-center h-10 w-10 rounded-xl cursor-pointer transition-all duration-200";
  
  let stateClasses = "";
  if (isSelected) {
    stateClasses = "bg-primary text-primary-foreground shadow-md scale-105";
  } else if (isToday) {
    stateClasses = "ring-2 ring-primary ring-offset-2 text-foreground font-semibold";
  } else {
    stateClasses = "text-foreground hover:bg-muted hover:scale-105";
  }

  return (
    <div
      onClick={onClick}
      className={`${baseClasses} ${stateClasses}`}
    >
      <span className="text-sm font-medium">{day}</span>
      {bookingCount && bookingCount > 0 && (
        <div className="flex items-center justify-center gap-0.5 mt-0.5">
          <div className={`h-1 w-1 rounded-full ${isSelected ? 'bg-primary-foreground' : 'bg-primary'}`} />
          {bookingCount > 1 && (
            <span className={`text-[8px] font-semibold ${isSelected ? 'text-primary-foreground' : 'text-primary'}`}>
              {bookingCount}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

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

  const renderCalendarDays = () => {
    const currentDate = selectedDate || new Date();
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const today = new Date();
    
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const firstDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    // Count bookings per day for the current month
    const bookingCountByDay = new Map<number, number>();
    bookings
      .filter(b => {
        const bookingDate = new Date(b.booking_date);
        return bookingDate.getMonth() === currentMonth && bookingDate.getFullYear() === currentYear;
      })
      .forEach(b => {
        const dayNum = new Date(b.booking_date).getDate();
        bookingCountByDay.set(dayNum, (bookingCountByDay.get(dayNum) || 0) + 1);
      });

    let days: React.ReactNode[] = [
      ...dayNames.map((day) => (
        <CalendarDay key={`header-${day}`} day={day} isHeader />
      )),
      ...Array(firstDayOfWeek).fill(null).map((_, i) => (
        <div key={`empty-start-${i}`} className="col-span-1 row-span-1 h-10 w-10" />
      )),
      ...Array(daysInMonth).fill(null).map((_, i) => {
        const dayNum = i + 1;
        const dayDate = new Date(currentYear, currentMonth, dayNum);
        const isToday = isSameDay(dayDate, today);
        const isSelected = selectedDate ? isSameDay(dayDate, selectedDate) : false;
        const bookingCount = bookingCountByDay.get(dayNum) || 0;
        
        return (
          <CalendarDay 
            key={`date-${dayNum}`} 
            day={dayNum}
            bookingCount={bookingCount}
            isToday={isToday}
            isSelected={isSelected}
            onClick={() => setSelectedDate(dayDate)}
          />
        );
      }),
    ];

    return days;
  };

  const changeMonth = (offset: number) => {
    const current = selectedDate || new Date();
    const newDate = new Date(current.getFullYear(), current.getMonth() + offset, 1);
    setSelectedDate(newDate);
  };

  if (loading) {
    return <div className="text-center py-8">Loading calendar...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Schedule</h2>
        <p className="text-muted-foreground">View and manage your appointments</p>
      </div>

      <div className="grid lg:grid-cols-[auto_1fr] gap-6">
        {/* Custom Calendar */}
        <Card className="w-fit border-border hover:border-primary/50 transition-colors">
          <CardContent className="p-4">
            <div className="w-[360px] rounded-2xl border border-border/50 p-4 bg-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <p className="text-sm">
                    <span className="font-semibold">
                      {(selectedDate || new Date()).toLocaleString("default", { month: "long" })}, {(selectedDate || new Date()).getFullYear()}
                    </span>
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => changeMonth(-1)}
                    className="h-8 w-8 p-0 hover:bg-muted"
                  >
                    ←
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => changeMonth(1)}
                    className="h-8 w-8 p-0 hover:bg-muted"
                  >
                    →
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-7 gap-2 place-items-center">
                {renderCalendarDays()}
              </div>
              <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full ring-2 ring-primary" />
                  <span>Today</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2 w-2 rounded-full bg-primary" />
                  <span>Has bookings</span>
                </div>
              </div>
            </div>
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
