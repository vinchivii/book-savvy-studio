import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Calendar, Users, Briefcase, Link as LinkIcon, UserCircle, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import ServicesTab from "@/components/dashboard/ServicesTab";
import BookingsTab from "@/components/dashboard/BookingsTab";
import ClientsTab from "@/components/dashboard/ClientsTab";
import ProfileTab from "@/components/dashboard/ProfileTab";

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  useEffect(() => {
    // Check auth and fetch profile
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);

      // Fetch profile
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error) {
        console.error("Error fetching profile:", error);
        toast.error("Failed to load profile");
      } else {
        setProfile(profileData);
      }

      setLoading(false);
    };

    init();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/");
  };

  const copyBookingLink = () => {
    const link = `${window.location.origin}/book/${profile?.slug}`;
    navigator.clipboard.writeText(link);
    toast.success("Booking link copied!");
  };

  const previewBookingPage = () => {
    const link = `${window.location.origin}/book/${profile?.slug}`;
    window.open(link, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/30 animate-fade-in">
      {/* Header */}
      <header className="bg-card border-b shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">BrandBook</h1>
            <p className="text-sm text-muted-foreground">
              Welcome back, {profile?.full_name || user?.email}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {profile?.slug && !isMobile && (
              <>
                <Button onClick={previewBookingPage} variant="outline" size="sm">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Preview
                </Button>
                <Button onClick={copyBookingLink} variant="outline" size="sm">
                  <LinkIcon className="mr-2 h-4 w-4" />
                  Copy Link
                </Button>
              </>
            )}
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Mobile-only Booking Link Buttons */}
        {isMobile && profile?.slug && (
          <div className="mb-6 animate-scale-in space-y-3">
            <Button onClick={previewBookingPage} variant="outline" className="w-full shadow-lg hover:shadow-xl" size="lg">
              <ExternalLink className="mr-2 h-5 w-5" />
              Preview Booking Page
            </Button>
            <Button onClick={copyBookingLink} className="w-full shadow-lg hover:shadow-xl" size="lg">
              <LinkIcon className="mr-2 h-5 w-5" />
              Copy Booking Link
            </Button>
          </div>
        )}
        
        <Tabs defaultValue="services" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="services">
              <Briefcase className="mr-2 h-4 w-4" />
              {!isMobile && "Services"}
            </TabsTrigger>
            <TabsTrigger value="bookings">
              <Calendar className="mr-2 h-4 w-4" />
              {!isMobile && "Bookings"}
            </TabsTrigger>
            <TabsTrigger value="clients">
              <Users className="mr-2 h-4 w-4" />
              {!isMobile && "Clients"}
            </TabsTrigger>
            <TabsTrigger value="profile">
              <UserCircle className="mr-2 h-4 w-4" />
              {!isMobile && "Profile"}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="services">
            <ServicesTab userId={user?.id || ""} />
          </TabsContent>

          <TabsContent value="bookings">
            <BookingsTab userId={user?.id || ""} />
          </TabsContent>

          <TabsContent value="clients">
            <ClientsTab userId={user?.id || ""} />
          </TabsContent>

          <TabsContent value="profile">
            <ProfileTab userId={user?.id || ""} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Dashboard;
