import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, User, Briefcase, Check } from "lucide-react";
import { toast } from "sonner";
import { NotificationBell } from "@/components/NotificationBell";

const Settings = () => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    
    setUser(session.user);
    await fetchProfile(session.user.id);
  };

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchToClient = async () => {
    setSwitching(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: "client" })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Switched to Client view");
      navigate("/client-dashboard");
    } catch (error: any) {
      console.error("Error switching to client:", error);
      toast.error("Failed to switch to client view");
    } finally {
      setSwitching(false);
    }
  };

  const handleSwitchToBusiness = async () => {
    setSwitching(true);
    try {
      // Check if business profile is complete
      const profileComplete = profile?.business_name && profile?.slug && profile?.bio;
      
      if (!profileComplete) {
        toast.error("Please complete your business profile (Business Name, Booking URL, and Bio) before switching to Business role.");
        setSwitching(false);
        return;
      }

      const { error } = await supabase
        .from("profiles")
        .update({ role: "creator" })
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Switched to Business view");
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Error switching to business:", error);
      toast.error("Failed to switch to business view");
    } finally {
      setSwitching(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="container mx-auto p-6 max-w-4xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <NotificationBell />
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground mt-1">
              Manage your account preferences
            </p>
          </div>

          {/* Role Switching Card */}
          <Card>
            <CardHeader>
              <CardTitle>Account View</CardTitle>
              <CardDescription>
                Switch between Client and Business dashboards
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                {/* Client View Card */}
                <Card 
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    profile?.role === "client" ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => profile?.role !== "client" && handleSwitchToClient()}
                >
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center text-center space-y-4">
                      <div className={`p-4 rounded-full ${
                        profile?.role === "client" ? "bg-primary/10" : "bg-muted"
                      }`}>
                        <User className={`h-8 w-8 ${
                          profile?.role === "client" ? "text-primary" : "text-muted-foreground"
                        }`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg flex items-center justify-center gap-2">
                          Client View
                          {profile?.role === "client" && (
                            <Check className="h-5 w-5 text-primary" />
                          )}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Manage bookings and appointments
                        </p>
                      </div>
                      {profile?.role !== "client" && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSwitchToClient();
                          }}
                          disabled={switching}
                          variant="outline"
                          className="w-full"
                        >
                          {switching ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Switching...
                            </>
                          ) : (
                            "Switch to Client"
                          )}
                        </Button>
                      )}
                      {profile?.role === "client" && (
                        <Badge variant="default" className="w-full justify-center">
                          Current View
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Business View Card */}
                <Card 
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    profile?.role === "creator" ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => profile?.role !== "creator" && handleSwitchToBusiness()}
                >
                  <CardContent className="pt-6">
                    <div className="flex flex-col items-center text-center space-y-4">
                    <div className={`p-4 rounded-full ${
                        profile?.role === "creator" ? "bg-primary/10" : "bg-muted"
                      }`}>
                        <Briefcase className={`h-8 w-8 ${
                          profile?.role === "creator" ? "text-primary" : "text-muted-foreground"
                        }`} />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg flex items-center justify-center gap-2">
                          Business View
                          {profile?.role === "creator" && (
                            <Check className="h-5 w-5 text-primary" />
                          )}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          Manage services, bookings, and clients
                        </p>
                      </div>
                      {profile?.role !== "creator" && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSwitchToBusiness();
                          }}
                          disabled={switching}
                          variant="outline"
                          className="w-full"
                        >
                          {switching ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Switching...
                            </>
                          ) : (
                            "Switch to Business"
                          )}
                        </Button>
                      )}
                      {profile?.role === "creator" && (
                        <Badge variant="default" className="w-full justify-center">
                          Current View
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {!profile?.business_name && profile?.role !== "creator" && (
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">
                    💡 To use Business view, complete your business profile first by switching to Business view and filling in your Business Name, Booking URL, and Bio.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Settings;
