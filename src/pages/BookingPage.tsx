import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { Calendar, Clock, DollarSign, Loader2 } from "lucide-react";
import { sendBookingConfirmationEmail } from "@/lib/emails";

const BookingPage = () => {
  const { slug } = useParams();
  const [profile, setProfile] = useState<any>(null);
  const [services, setServices] = useState<any[]>([]);
  const [selectedService, setSelectedService] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [bookingFlowState, setBookingFlowState] = useState<'choice' | 'guest'>('choice');
  
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    date: "",
    time: "",
    notes: "",
  });

  useEffect(() => {
    if (slug) fetchCreatorData();
  }, [slug]);

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

    const { data: servicesData } = await supabase
      .from('services')
      .select('*')
      .eq('creator_id', profileData.id)
      .eq('active', true);

    setServices(servicesData || []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedService || !formData.name || !formData.email || !formData.date || !formData.time) {
      toast.error("Please fill in all required fields");
      return;
    }

    setSubmitting(true);

    const bookingDateTime = new Date(`${formData.date}T${formData.time}`);
    
    const { error } = await supabase.from('bookings').insert({
      service_id: selectedService.id,
      creator_id: profile.id,
      client_name: formData.name,
      client_email: formData.email,
      client_phone: formData.phone || null,
      booking_date: bookingDateTime.toISOString(),
      notes: formData.notes || null,
    });

    if (error) {
      toast.error("Failed to create booking");
      console.error(error);
    } else {
      // Send email notification to client
      await sendBookingConfirmationEmail(
        formData.email,
        formData.name,
        selectedService.title,
        bookingDateTime.toLocaleString(),
        'pending'
      );
      
      toast.success("Booking request sent! You'll hear back soon.");
      setFormData({ name: "", email: "", phone: "", date: "", time: "", notes: "" });
      setSelectedService(null);
      setBookingFlowState('choice'); // Reset flow state
    }
    
    setSubmitting(false);
  };

  const handleServiceSelect = (service: any) => {
    setSelectedService(service);
    setBookingFlowState('choice'); // Reset to choice when selecting a service
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
      {/* Block 1: Banner and Profile Info */}
      <div className="w-full max-w-4xl mx-auto px-4 mb-12">
        {/* Banner Section */}
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

        {/* Profile Info Card */}
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
      </div>

      {/* Block 2: Services and Booking Flow */}
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
                        <Link to="/auth?from=booking">
                          <Button variant="outline" size="sm">Log In</Button>
                        </Link>
                        <span>or</span>
                        <Link to="/auth?from=booking">
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
                  <CardDescription>Fill in your details to request a booking</CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
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
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Preferred Date *</Label>
                        <Input type="date" value={formData.date} onChange={(e) => setFormData({...formData, date: e.target.value})} required />
                      </div>
                      <div className="space-y-2">
                        <Label>Preferred Time *</Label>
                        <Input type="time" value={formData.time} onChange={(e) => setFormData({...formData, time: e.target.value})} required />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Additional Notes</Label>
                      <Textarea value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} rows={3} />
                    </div>
                    
                    {/* Payment/Confirmation Section */}
                    <div className="pt-4 border-t space-y-2">
                      <h4 className="font-medium text-sm">Payment/Confirmation</h4>
                      <p className="text-sm text-muted-foreground">
                        By clicking "Request Booking", you agree to pay the service fee of ${selectedService.price.toFixed(2)}.
                      </p>
                    </div>
                    
                    <Button type="submit" className="w-full" disabled={submitting}>
                      {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Request Booking
                    </Button>
                  </form>
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
