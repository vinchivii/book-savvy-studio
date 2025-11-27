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
    <div className={`${themeClass} min-h-screen bg-gradient-to-br from-background via-background to-muted/20 text-foreground animate-fade-in`}>
      {/* Hero Section with Banner and Profile */}
      <div className="relative w-full">
        {profile.banner_url && (
          <div className="relative h-[300px] md:h-[400px] overflow-hidden">
            <img
              src={profile.banner_url}
              alt="Creator Banner"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background" />
          </div>
        )}
        
        {/* Floating Profile Card */}
        <div className="relative max-w-6xl mx-auto px-4 md:px-6">
          <div className={`${profile.banner_url ? '-mt-20' : 'pt-12'} mb-8`}>
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[32px] p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.12)] hover:shadow-[0_8px_48px_rgba(0,0,0,0.16)] transition-all duration-300 animate-scale-in">
              <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
                {/* Avatar */}
                <div className="relative">
                  <div className="absolute inset-0 bg-[#2E7BFF]/20 rounded-full blur-xl animate-pulse" />
                  <Avatar className="relative h-24 w-24 md:h-32 md:w-32 border-4 border-white/20 shadow-2xl ring-2 ring-[#2E7BFF]/30">
                    <AvatarImage src={profile.avatar_url} alt={profile.full_name} className="object-cover" />
                    <AvatarFallback className="text-3xl bg-gradient-to-br from-[#2E7BFF] to-[#1E5FDF] text-white">
                      {profile.full_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </div>

                {/* Profile Info */}
                <div className="flex-1 text-center md:text-left space-y-3">
                  <div>
                    <h1 className="text-3xl md:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                      {profile.full_name}
                    </h1>
                    {profile.business_name && (
                      <p className="text-lg md:text-xl text-muted-foreground font-medium mt-1">
                        {profile.business_name}
                      </p>
                    )}
                  </div>
                  {profile.bio && (
                    <p className="text-sm md:text-base text-muted-foreground/90 leading-relaxed max-w-2xl">
                      {profile.bio}
                    </p>
                  )}
                </div>

                {/* Dashboard Button */}
                {currentUser && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDashboardClick}
                    className="gap-2 bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10"
                  >
                    <Home className="h-4 w-4" />
                    Dashboard
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Reviews Section */}
      {reviews.length > 0 && (
        <div className="max-w-6xl mx-auto px-4 md:px-6 mb-12">
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.12)] animate-fade-in">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">Client Reviews</h2>
              {(() => {
                const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
                return (
                  <div className="flex items-center justify-center gap-3">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={star} className={`text-2xl ${star <= Math.round(avgRating) ? "text-[#FFB800]" : "text-muted-foreground/30"}`}>★</span>
                      ))}
                    </div>
                    <span className="text-xl font-bold">{avgRating.toFixed(1)}</span>
                    <span className="text-muted-foreground">({reviews.length} reviews)</span>
                  </div>
                );
              })()}
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              {reviews.slice(0, 3).map((review, index) => (
                <div 
                  key={review.id} 
                  className="bg-white/5 backdrop-blur-sm border border-white/5 rounded-2xl p-4 hover:bg-white/10 transition-all duration-300"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="font-semibold">{review.client_name}</div>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={star} className={`text-sm ${star <= review.rating ? "text-[#FFB800]" : "text-muted-foreground/30"}`}>★</span>
                      ))}
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-sm text-muted-foreground/90 line-clamp-3">{review.comment}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {new Date(review.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Services and Booking Flow */}
      <div className="w-full max-w-6xl mx-auto px-4 md:px-6 pb-12">
        <div className="grid lg:grid-cols-2 gap-8">
          {/* Services Column */}
          <div className="space-y-6 animate-fade-in">
            <div>
              <h2 className="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                Available Services
              </h2>
              <p className="text-muted-foreground/90 mb-6">Select a service to book an appointment</p>
              
              <div className="grid gap-4">
                {services.map((service, index) => (
                  <div 
                    key={service.id}
                    className={`group relative bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_8px_32px_rgba(46,123,255,0.15)] ${
                      selectedService?.id === service.id 
                        ? 'ring-2 ring-[#2E7BFF] shadow-[0_8px_32px_rgba(46,123,255,0.2)] bg-white/10' 
                        : 'hover:bg-white/10'
                    }`}
                    onClick={() => handleServiceSelect(service)}
                    style={{ animationDelay: `${index * 0.1}s` }}
                  >
                    {selectedService?.id === service.id && (
                      <div className="absolute top-4 right-4 h-6 w-6 rounded-full bg-[#2E7BFF] flex items-center justify-center">
                        <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                    <h3 className="text-xl font-bold mb-3 group-hover:text-[#2E7BFF] transition-colors">
                      {service.title}
                    </h3>
                    <div className="flex items-center gap-4 mb-3 text-muted-foreground">
                      <span className="flex items-center gap-1.5 text-sm">
                        <DollarSign className="h-4 w-4" />
                        <span className="font-semibold">${service.price}</span>
                      </span>
                      <span className="flex items-center gap-1.5 text-sm">
                        <Clock className="h-4 w-4" />
                        <span>{service.duration} min</span>
                      </span>
                    </div>
                    {service.description && (
                      <p className="text-sm text-muted-foreground/80 leading-relaxed">
                        {service.description}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Booking Flow Column */}
          <div className="space-y-6 animate-fade-in">
            {selectedService && bookingFlowState === 'choice' && (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.12)] animate-scale-in">
                <h3 className="text-2xl font-bold mb-2">How would you like to book?</h3>
                <p className="text-muted-foreground/90 mb-6">Choose your preferred booking method</p>
                
                <div className="space-y-4">
                  <Button 
                    onClick={() => setBookingFlowState('guest')} 
                    className="w-full text-lg py-6 rounded-xl bg-[#2E7BFF] hover:bg-[#1E5FDF] text-white shadow-[0_4px_20px_rgba(46,123,255,0.3)] hover:shadow-[0_6px_30px_rgba(46,123,255,0.4)] transition-all duration-300"
                    size="lg"
                  >
                    Continue as Guest
                  </Button>
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-3 py-1 text-muted-foreground rounded-full bg-white/5 backdrop-blur-sm">
                        Or
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
                    <p>Already have an account?</p>
                    <div className="flex items-center gap-3">
                      <Link to={`/auth?from=booking&returnTo=${slug}&serviceId=${selectedService.id}`}>
                        <Button variant="outline" size="sm" className="bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10">
                          Log In
                        </Button>
                      </Link>
                      <span>or</span>
                      <Link to={`/auth?from=booking&returnTo=${slug}&serviceId=${selectedService.id}`}>
                        <Button variant="outline" size="sm" className="bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10">
                          Sign Up
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {selectedService && bookingFlowState === 'guest' && (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.12)] animate-scale-in">
                <h3 className="text-2xl font-bold mb-2">Book {selectedService.title}</h3>
                <p className="text-muted-foreground/90 mb-6">
                  {userRole === "business" 
                    ? "⚠️ Business accounts cannot make bookings. Switch to Client role in Settings to book services."
                    : "Fill in your details and select a time slot"}
                </p>
                
                {userRole === "business" ? (
                  <div className="text-center py-12 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/5">
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
                    <div className="space-y-4 p-4 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/5">
                      <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Name *</Label>
                          <Input 
                            value={formData.name} 
                            onChange={(e) => setFormData({...formData, name: e.target.value})} 
                            required 
                            className="bg-white/5 backdrop-blur-sm border-white/10 focus:border-[#2E7BFF] focus:ring-[#2E7BFF]/20"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Email *</Label>
                          <Input 
                            type="email" 
                            value={formData.email} 
                            onChange={(e) => setFormData({...formData, email: e.target.value})} 
                            required 
                            className="bg-white/5 backdrop-blur-sm border-white/10 focus:border-[#2E7BFF] focus:ring-[#2E7BFF]/20"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Phone</Label>
                        <Input 
                          type="tel" 
                          value={formData.phone} 
                          onChange={(e) => setFormData({...formData, phone: e.target.value})} 
                          className="bg-white/5 backdrop-blur-sm border-white/10 focus:border-[#2E7BFF] focus:ring-[#2E7BFF]/20"
                        />
                      </div>
                    </div>

                    {/* Date Selection */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Select Date *
                      </Label>
                      <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                        <CalendarComponent
                          mode="single"
                          selected={selectedDate}
                          onSelect={setSelectedDate}
                          disabled={(date) => {
                            if (date < new Date(new Date().setHours(0, 0, 0, 0))) return true;
                            const dayOfWeek = date.getDay();
                            return !weeklyAvailability.has(dayOfWeek);
                          }}
                          className="rounded-xl pointer-events-auto"
                          classNames={{
                            months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                            month: "space-y-4",
                            caption: "flex justify-center pt-1 relative items-center",
                            caption_label: "text-sm font-medium",
                            nav: "space-x-1 flex items-center",
                            nav_button: "h-7 w-7 bg-white/5 backdrop-blur-sm border border-white/10 hover:bg-white/10 rounded-lg transition-all",
                            table: "w-full border-collapse space-y-1",
                            head_row: "flex",
                            head_cell: "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
                            row: "flex w-full mt-2",
                            cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
                            day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100 hover:bg-white/10 rounded-lg transition-all",
                            day_range_end: "day-range-end",
                            day_selected: "bg-[#2E7BFF] text-white hover:bg-[#1E5FDF] hover:text-white focus:bg-[#2E7BFF] focus:text-white rounded-lg shadow-[0_4px_12px_rgba(46,123,255,0.4)]",
                            day_today: "bg-white/10 text-accent-foreground font-semibold ring-2 ring-[#2E7BFF]/50 rounded-lg",
                            day_outside: "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
                            day_disabled: "text-muted-foreground opacity-30",
                            day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
                            day_hidden: "invisible",
                          }}
                        />
                      </div>
                      {weeklyAvailability.size === 0 && (
                        <p className="text-xs text-muted-foreground/70 px-4">
                          No availability configured yet. Please check back later.
                        </p>
                      )}
                    </div>

                    {/* Time Slot Selection */}
                    {selectedDate && (
                      <div className="space-y-3">
                        <Label className="text-sm font-medium flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          Select Time Slot *
                        </Label>
                        {loadingSlots ? (
                          <div className="flex items-center justify-center py-12 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/5">
                            <Loader2 className="h-8 w-8 animate-spin text-[#2E7BFF]" />
                          </div>
                        ) : availableSlots.length === 0 ? (
                          <div className="text-center py-12 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/5">
                            <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                            <p className="text-sm text-muted-foreground">No available slots for this date</p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-3 gap-2 p-4 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/5">
                            {availableSlots.map((slot, index) => (
                              <Button
                                key={index}
                                type="button"
                                variant={selectedSlot?.start === slot.start ? "default" : "outline"}
                                onClick={() => setSelectedSlot(slot)}
                                className={`w-full transition-all duration-200 ${
                                  selectedSlot?.start === slot.start
                                    ? 'bg-[#2E7BFF] hover:bg-[#1E5FDF] text-white shadow-[0_4px_12px_rgba(46,123,255,0.4)] scale-105'
                                    : 'bg-white/5 backdrop-blur-sm border-white/10 hover:bg-white/10 hover:scale-105'
                                }`}
                              >
                                {slot.start}
                              </Button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Additional Notes</Label>
                      <Textarea 
                        value={formData.notes} 
                        onChange={(e) => setFormData({...formData, notes: e.target.value})} 
                        rows={3} 
                        className="bg-white/5 backdrop-blur-sm border-white/10 focus:border-[#2E7BFF] focus:ring-[#2E7BFF]/20"
                      />
                    </div>
                    
                    {/* Payment Info */}
                    <div className="pt-4 border-t border-white/10 space-y-3 p-4 bg-white/5 backdrop-blur-sm rounded-2xl">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <DollarSign className="h-4 w-4" />
                        Payment Information
                      </h4>
                      <p className="text-lg font-bold text-[#2E7BFF]">
                        Total: ${selectedService.price.toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground/70">
                        You'll be redirected to Stripe to complete your payment securely.
                      </p>
                    </div>
                    
                    <Button 
                      type="submit" 
                      className="w-full text-lg py-6 rounded-xl bg-[#2E7BFF] hover:bg-[#1E5FDF] text-white shadow-[0_4px_20px_rgba(46,123,255,0.3)] hover:shadow-[0_6px_30px_rgba(46,123,255,0.4)] transition-all duration-300" 
                      disabled={submitting || !selectedSlot}
                    >
                      {submitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                      Proceed to Payment
                    </Button>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingPage;
