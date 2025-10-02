import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, Calendar, Users, Briefcase, Link as LinkIcon, UserCircle, ExternalLink, Share2, Copy, Mail, MessageCircle } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
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

  const getBookingLink = () => `${window.location.origin}/book/${profile?.slug}`;

  const copyBookingLink = () => {
    navigator.clipboard.writeText(getBookingLink());
    toast.success("Booking link copied!");
  };

  const shareViaEmail = () => {
    const link = getBookingLink();
    const subject = encodeURIComponent("Book a session with me");
    const body = encodeURIComponent(`Check out my booking page: ${link}`);
    window.open(`mailto:?subject=${subject}&body=${body}`, '_blank');
  };

  const shareViaWhatsApp = () => {
    const link = getBookingLink();
    const text = encodeURIComponent(`Check out my booking page: ${link}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const shareViaTwitter = () => {
    const link = getBookingLink();
    const text = encodeURIComponent("Book a session with me!");
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${link}`, '_blank');
  };

  const shareViaLinkedIn = () => {
    const link = getBookingLink();
    window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${link}`, '_blank');
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
    <div className="min-h-screen gradient-subtle animate-fade-in">
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Share2 className="mr-2 h-4 w-4" />
                      Share
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={copyBookingLink}>
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Link
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={shareViaEmail}>
                      <Mail className="mr-2 h-4 w-4" />
                      Share via Email
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={shareViaWhatsApp}>
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Share via WhatsApp
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={shareViaTwitter}>
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                      </svg>
                      Share on X
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={shareViaLinkedIn}>
                      <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                      Share on LinkedIn
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button className="w-full shadow-lg hover:shadow-xl" size="lg">
                  <Share2 className="mr-2 h-5 w-5" />
                  Share Booking Link
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-full">
                <DropdownMenuItem onClick={copyBookingLink}>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Link
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={shareViaEmail}>
                  <Mail className="mr-2 h-4 w-4" />
                  Share via Email
                </DropdownMenuItem>
                <DropdownMenuItem onClick={shareViaWhatsApp}>
                  <MessageCircle className="mr-2 h-4 w-4" />
                  Share via WhatsApp
                </DropdownMenuItem>
                <DropdownMenuItem onClick={shareViaTwitter}>
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                  </svg>
                  Share on X
                </DropdownMenuItem>
                <DropdownMenuItem onClick={shareViaLinkedIn}>
                  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                  </svg>
                  Share on LinkedIn
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
