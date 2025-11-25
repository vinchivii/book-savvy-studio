import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"creator" | "client">("creator");
  const navigate = useNavigate();
  
  // Check if user came from booking page
  const searchParams = new URLSearchParams(window.location.search);
  const fromBooking = searchParams.get('from') === 'booking';
  const returnTo = searchParams.get('returnTo');
  const serviceId = searchParams.get('serviceId');
  
  // Set default role to client if coming from booking
  useEffect(() => {
    if (fromBooking) {
      setRole("client");
    }
  }, [fromBooking]);

  useEffect(() => {
    // Check if user is already logged in
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        // If from booking, redirect back to the booking page
        if (fromBooking && returnTo && serviceId) {
          navigate(`/book/${returnTo}?returned=true&serviceId=${serviceId}`);
          return;
        } else if (fromBooking) {
          navigate("/client-dashboard");
          return;
        }
        
        const role = await checkUserRole(session.user.id);
        redirectBasedOnRole(role);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        // Defer role check to avoid blocking auth state change
        setTimeout(async () => {
          // If from booking, redirect back to the booking page
          if (fromBooking && returnTo && serviceId) {
            navigate(`/book/${returnTo}?returned=true&serviceId=${serviceId}`);
            return;
          } else if (fromBooking) {
            navigate("/client-dashboard");
            return;
          }
          
          const role = await checkUserRole(session.user.id);
          redirectBasedOnRole(role);
        }, 0);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, fromBooking]);

  const checkUserRole = async (userId: string): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();

      if (error || !data) {
        return "client"; // Default to client if no profile exists
      }

      return data.role || "creator";
    } catch (error) {
      console.error("Error checking user role:", error);
      return "client";
    }
  };

  const redirectBasedOnRole = (role: string) => {
    if (role === "creator") {
      navigate("/dashboard");
    } else {
      navigate("/client-dashboard");
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    if (!isLogin && !fullName) {
      toast.error("Please enter your full name");
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        toast.success("Welcome back!");
      } else {
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) throw error;

        if (data.user) {
          // Create profile with slug and user-selected role
          const slug = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '-');
          const { error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: data.user.id,
              full_name: fullName,
              slug: slug,
              role: role, // Use the role selected during signup
            });

          if (profileError) {
            console.error("Profile creation error:", profileError);
            toast.error("Account created but profile setup failed. Please contact support.");
          } else {
            toast.success("Account created! Welcome to BrandBook.");
          }
        }
      }
    } catch (error: any) {
      console.error("Auth error:", error);
      if (error.message.includes("already registered")) {
        toast.error("This email is already registered. Please login instead.");
      } else if (error.message.includes("Invalid login credentials")) {
        toast.error("Invalid email or password");
      } else {
        toast.error(error.message || "An error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4 animate-fade-in">
      <Card className="w-full max-w-md shadow-xl animate-scale-in">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {isLogin ? "Welcome Back" : "Create Account"}
          </CardTitle>
          <CardDescription className="text-center">
            {isLogin 
              ? "Sign in to manage your bookings" 
              : "Start your professional booking page"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={!isLogin}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role">I am a...</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole("creator")}
                      className={`p-4 border rounded-lg text-left transition-all ${
                        role === "creator"
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="font-medium mb-1">Business</div>
                      <div className="text-xs text-muted-foreground">
                        I want to list my services
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole("client")}
                      className={`p-4 border rounded-lg text-left transition-all ${
                        role === "client"
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="font-medium mb-1">Client</div>
                      <div className="text-xs text-muted-foreground">
                        I'm looking for services
                      </div>
                    </button>
                  </div>
                </div>
              </>
            )}
            
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isLogin ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            <button
              type="button"
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:underline"
            >
              {isLogin 
                ? "Don't have an account? Sign up" 
                : "Already have an account? Sign in"}
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
