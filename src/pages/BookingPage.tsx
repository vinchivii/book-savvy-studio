import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
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
      .single();

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
    }
    
    setSubmitting(false);
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center"><p>Creator not found</p></div>;
  }

  return (
    <div className="min-h-screen bg-muted/30 py-12">
      <div className="container max-w-6xl mx-auto px-4">
        <div className="grid md:grid-cols-[1fr_2fr] gap-8">
          {/* Left Column - Creator Profile Card */}
          <div className="space-y-6">
            <Card className="sticky top-8">
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <Avatar className="h-24 w-24">
                    <AvatarImage src={profile.avatar_url} alt={profile.full_name} />
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

          {/* Right Column - Services and Booking Form */}
          <div className="space-y-8">
            <div>
              <h2 className="text-3xl font-bold mb-2">Available Services</h2>
              <p className="text-muted-foreground mb-6">Select a service to book an appointment</p>
              
              <div className="grid gap-4">
                {services.map((service) => (
                  <Card 
                    key={service.id}
                    className={`cursor-pointer transition-all ${selectedService?.id === service.id ? 'ring-2 ring-primary' : ''}`}
                    onClick={() => setSelectedService(service)}
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

            {selectedService && (
              <Card>
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
