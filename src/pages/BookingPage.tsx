import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Calendar, Clock, DollarSign, Loader2, Home } from "lucide-react";
import { TimeSlot } from "@/types/booking";
import { format } from "date-fns";

const BookingPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bookingFlowState, setBookingFlowState] = useState<'choice' | 'guest'>('choice');
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [pendingServiceId, setPendingServiceId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  
  // Availability state
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [weeklyAvailability, setWeeklyAvailability] = useState<Set<number>>(new Set());
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    notes: "",
  });

  useEffect(() => {
    if (slug) fetchCreatorData();
  }, [slug]);

  useEffect(() => {
    checkAuthAndPrefill();
  }, []);

  useEffect(() => {
    if (services.length > 0 && pendingServiceId) {
      const service = services.find(s => s.id === pendingServiceId);
      if (service) {
        setSelectedService(service);
        setBookingFlowState('guest');
        setPendingServiceId(null);
      }
    }
  }, [services, pendingServiceId]);

  // Fetch available slots when date changes
  useEffect(() => {
    if (selectedDate && selectedService && profile) {
      fetchAvailableSlots();
    }
  }, [selectedDate, selectedService, profile]);

  const checkAuthAndPrefill = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setCurrentUser(session.user);
      
      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, role')
        .eq('id', session.user.id)
        .maybeSingle();
      
      setUserRole(profileData?.role || null);
      
      setFormData(prev => ({
        ...prev,
        name: profileData?.full_name || "",
        email: session.user.email || "",
      }));
      
      const urlParams = new URLSearchParams(window.location.search);
      const returnedFromAuth = urlParams.get('returned');
      const serviceId = urlParams.get('serviceId');
      
      if (returnedFromAuth === 'true' && serviceId) {
        setPendingServiceId(serviceId);
        window.history.replaceState({}, '', window.location.pathname);
      }
    }
  };

  const handleDashboardClick = () => {
    if (!currentUser) {
      navigate('/auth');
      return;
    }
    
    if (userRole === 'creator') {
      navigate('/dashboard');
    } else {
      navigate('/client-dashboard');
    }
  };

  const fetchCreatorData = async () => {
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('slug', slug)
      .maybeSingle();

    if (profileError || !profileData) {
      toast.error("Creator not found");
      setLoading(false);
      return;
    }

    setProfile(profileData);

    // Fetch weekly availability
    const { data: availabilityData } = await supabase
      .from('availability')
      .select('day_of_week')
      .eq('creator_id', profileData.id)
      .eq('is_active', true);

    if (availabilityData) {
      const activeDays = new Set(availabilityData.map(a => a.day_of_week));
      setWeeklyAvailability(activeDays);
    }

    const { data: servicesData } = await supabase
      .from('services')
      .select('*')
      .eq('creator_id', profileData.id)
      .eq('active', true);

    setServices(servicesData || []);

    // Fetch public reviews
    const { data: reviewsData } = await supabase
      .from('reviews')
      .select('*')
      .eq('creator_id', profileData.id)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(5);

    setReviews(reviewsData || []);
    setLoading(false);
  };

  const fetchAvailableSlots = async () => {
    if (!selectedDate || !selectedService || !profile) return;
    
    setLoadingSlots(true);
    try {
      const { data, error } = await supabase.functions.invoke('get-available-slots', {
        body: {
          creatorSlug: slug,
          serviceId: selectedService.id,
          date: format(selectedDate, 'yyyy-MM-dd'),
        },
      });

      if (error) throw error;
      
      setAvailableSlots(data.availableSlots || []);
      setSelectedSlot(null);
    } catch (error: any) {
      console.error('Error fetching slots:', error);
      toast.error(error.message || "Failed to load available time slots");
      setAvailableSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedService || !formData.name || !formData.email || !selectedDate || !selectedSlot) {
      toast.error("Please fill in all required fields and select a time slot");
      return;
    }

    setSubmitting(true);

    try {
      // Check if business user is trying to book
      if (userRole === "business") {
        toast.error("Business accounts cannot make bookings. Please switch to Client role in Settings.");
        return;
      }

      // Combine date and time into ISO string
      const [hours, minutes] = selectedSlot.start.split(':');
      const bookingDateTime = new Date(selectedDate);
      bookingDateTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);

      // Determine if this is a guest booking
      const isGuest = !currentUser;

      // Call create-checkout-session edge function
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          serviceId: selectedService.id,
          creatorSlug: slug,
          bookingStartDatetime: bookingDateTime.toISOString(),
          clientName: formData.name,
          clientEmail: formData.email,
          clientPhone: formData.phone || null,
          notes: formData.notes || null,
          isGuest: isGuest,
        },
      });

      if (error) throw error;

      if (data?.checkoutUrl) {
        // Redirect to Stripe Checkout
        window.open(data.checkoutUrl, '_blank');
        toast.success("Redirecting to payment...");
      } else {
        throw new Error("No checkout URL received");
      }
    } catch (error: any) {
      console.error('Booking error:', error);
      toast.error(error.message || "Failed to create booking");
    } finally {
      setSubmitting(false);
    }
  };

  const handleServiceSelect = (service: any) => {
    setSelectedService(service);
    setSelectedDate(undefined);
    setAvailableSlots([]);
    setSelectedSlot(null);
    setBookingFlowState('choice');
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center"><p>Creator not found</p></div>;
  }

  const themeClass = profile.background_style === 'dark' ? 'dark' : profile.background_style === 'light' ? 'light' : '';

  return (
    <div className={`${themeClass} min-h-screen bg-background text-foreground flex flex-col items-center py-12 animate-fade-in`}>
      {currentUser && (
        <div className="w-full max-w-6xl mx-auto px-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDashboardClick}
            className="gap-2"
          >
            <Home className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      )}
      
      {/* Banner and Profile Info */}
      <div className="w-full max-w-4xl mx-auto px-4 mb-12">
        {profile.banner_url && (
          <div className="mb-8">
            <div className="relative h-48 md:h-64 rounded-xl overflow-hidden shadow-xl">
              <img
                src={profile.banner_url}
                alt="Creator Banner"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}

        <Card className="max-w-xl mx-auto shadow-lg hover:shadow-xl transition-shadow animate-fade-in">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                <AvatarImage src={profile.avatar_url} alt={profile.full_name} className="object-cover" />
                <AvatarFallback className="text-2xl">
                  {profile.full_name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
            <CardTitle className="text-2xl">{profile.full_name}</CardTitle>
            {profile.business_name && (
              <CardDescription className="text-lg font-medium">
                {profile.business_name}
              </CardDescription>
            )}
            {profile.bio && (
              <CardDescription className="text-left mt-4">
                {profile.bio}
              </CardDescription>
            )}
          </CardHeader>
        </Card>

        {/* Reviews Section */}
        {reviews.length > 0 && (
          <Card className="max-w-xl mx-auto shadow-lg mt-8">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Client Reviews</CardTitle>
              <CardDescription>
                {(() => {
                  const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
                  return (
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <div className="flex">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <span key={star} className={star <= Math.round(avgRating) ? "text-yellow-400" : "text-gray-300"}>★</span>
                        ))}
                      </div>
                      <span className="font-semibold">{avgRating.toFixed(1)}</span>
                      <span className="text-muted-foreground">({reviews.length} reviews)</span>
                    </div>
                  );
                })()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {reviews.slice(0, 3).map((review) => (
                <div key={review.id} className="border-b last:border-0 pb-4 last:pb-0">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="font-medium">{review.client_name}</div>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={star} className={`text-sm ${star <= review.rating ? "text-yellow-400" : "text-gray-300"}`}>★</span>
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-muted-foreground">{review.comment}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(review.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Services and Booking Flow */}
      <div className="w-full max-w-6xl mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-8">
          {/* Services Column */}
          <div className="space-y-8 animate-slide-in-left">
            <div>
              <h2 className="text-3xl font-bold mb-2">Available Services</h2>
              <p className="text-muted-foreground mb-6">Select a service to book an appointment</p>
              
              <div className="grid gap-4">
                {services.map((service, index) => (
                  <Card 
                    key={service.id}
                    className={`cursor-pointer transition-all hover-lift ${selectedService?.id === service.id ? 'ring-2 ring-primary shadow-glow-sm' : 'hover:shadow-md'}`}
                    onClick={() => handleServiceSelect(service)}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    <CardHeader>
                      <CardTitle>{service.title}</CardTitle>
                      <CardDescription className="flex items-center gap-4">
                        <span className="flex items-center gap-1"><DollarSign className="h-4 w-4" />${service.price}</span>
                        <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{service.duration} min</span>
                      </CardDescription>
                    </CardHeader>
                    {service.description && <CardContent><p className="text-sm">{service.description}</p></CardContent>}
                  </Card>
                ))}
              </div>
            </div>
          </div>

          {/* Booking Flow Column */}
          <div className="space-y-8 animate-slide-in-right">
            {selectedService && bookingFlowState === 'choice' && (
              <Card className="animate-scale-in shadow-lg">
                <CardHeader>
                  <CardTitle>How would you like to book?</CardTitle>
                  <CardDescription>Choose your preferred booking method</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Button 
                      onClick={() => setBookingFlowState('guest')} 
                      className="w-full text-lg"
                      size="lg"
                    >
                      Continue as Guest
                    </Button>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-card px-2 text-muted-foreground">
                          Or
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                      <p>Already have an account?</p>
                      <div className="flex items-center gap-2">
                        <Link to={`/auth?from=booking&returnTo=${slug}&serviceId=${selectedService.id}`}>
                          <Button variant="outline" size="sm">Log In</Button>
                        </Link>
                        <span>or</span>
                        <Link to={`/auth?from=booking&returnTo=${slug}&serviceId=${selectedService.id}`}>
                          <Button variant="outline" size="sm">Sign Up</Button>
                        </Link>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {selectedService && bookingFlowState === 'guest' && (
              <Card className="animate-scale-in shadow-lg">
                <CardHeader>
                  <CardTitle>Book {selectedService.title}</CardTitle>
                  <CardDescription>
                    {userRole === "business" 
                      ? "⚠️ Business accounts cannot make bookings. Switch to Client role in Settings to book services."
                      : "Fill in your details and select a time slot"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {userRole === "business" ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">
                        You are currently logged in as a Business account.
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Go to Settings → Account Role to switch to Client mode if you want to book services.
                      </p>
                    </div>
                  ) : (
                  <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Client Info */}
                    <div className="space-y-4">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Name *</Label>
                          <Input value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required />
                        </div>
                        <div className="space-y-2">
                          <Label>Email *</Label>
                          <Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} required />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Phone</Label>
                        <Input type="tel" value={formData.phone} onChange={(e) => setFormData({...formData, phone: e.target.value})} />
                      </div>
                    </div>

                    {/* Date Selection */}
                    <div className="space-y-2">
                      <Label>Select Date *</Label>
                      <CalendarComponent
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        disabled={(date) => {
                          // Disable past dates
                          if (date < new Date(new Date().setHours(0, 0, 0, 0))) return true;
                          
                          // Disable days without availability
                          const dayOfWeek = date.getDay();
                          return !weeklyAvailability.has(dayOfWeek);
                        }}
                        className="rounded-md border"
                      />
                      {weeklyAvailability.size === 0 && (
                        <p className="text-xs text-muted-foreground">
                          No availability configured yet. Please check back later.
                        </p>
                      )}
                    </div>

                    {/* Time Slot Selection */}
                    {selectedDate && (
                      <div className="space-y-2">
                        <Label>Select Time Slot *</Label>
                        {loadingSlots ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin" />
                          </div>
                        ) : availableSlots.length === 0 ? (
                          <p className="text-sm text-muted-foreground py-4">No available slots for this date</p>
                        ) : (
                          <div className="grid grid-cols-3 gap-2">
                            {availableSlots.map((slot, index) => (
                              <Button
                                key={index}
                                type="button"
                                variant={selectedSlot?.start === slot.start ? "default" : "outline"}
                                onClick={() => setSelectedSlot(slot)}
                                className="w-full"
                              >
                                {slot.start}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label>Additional Notes</Label>
                      <Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={3} />
                    </div>
                    
                    {/* Payment Info */}
                    <div className="pt-4 border-t space-y-2">
                      <h4 className="font-medium text-sm">Payment Information</h4>
                      <p className="text-sm text-muted-foreground">
                        Total amount: ${selectedService.price.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        You'll be redirected to Stripe to complete your payment securely.
                      </p>
                    </div>
                    
                    <Button type="submit" className="w-full" disabled={submitting || !selectedSlot}>
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Proceed to Payment
                    </Button>
                  </form>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingPage;
