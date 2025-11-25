import { Button } from "@/components/ui/button";
import { ArrowRight, Calendar, Users, Sparkles, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            BrandBook
          </Link>
          <Button asChild variant="default">
            <Link to="/auth">
              Login
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-[image:var(--gradient-hero)] opacity-10"
          style={{ backgroundImage: 'var(--gradient-hero)' }}
        />
        <div className="container mx-auto px-4 py-20 md:py-32 relative">
          <div className="max-w-4xl mx-auto text-center space-y-8">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium animate-fade-in">
              <Sparkles className="w-4 h-4" />
              Professional Booking Made Simple
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight animate-fade-in">
              Your Business,
              <br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                One Beautiful Link
              </span>
            </h1>
            
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto animate-fade-in">
              Stop losing clients in DMs. BrandBook gives service creators a professional booking page, 
              client management, and automated notifications—all in one place.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in">
              <Button asChild size="lg" className="text-lg px-8 shadow-lg hover:shadow-xl transition-all">
                <Link to="/auth">
                  Get Started Free
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="text-lg px-8">
                <a href="#features">Learn More</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4">
              Everything You Need to Grow
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Built for photographers, barbers, trainers, and all service creators
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <FeatureCard
              icon={<Calendar className="w-10 h-10 text-primary" />}
              title="Smart Booking"
              description="Clients book directly through your custom link. Set your services, pricing, and availability in minutes."
              delay="0.1s"
            />
            <FeatureCard
              icon={<Users className="w-10 h-10 text-primary" />}
              title="Client Management"
              description="Keep track of all your clients and their booking history in one organized dashboard."
              delay="0.2s"
            />
            <FeatureCard
              icon={<Sparkles className="w-10 h-10 text-primary" />}
              title="Auto Notifications"
              description="Automatic email confirmations for you and your clients whenever a booking is made or updated."
              delay="0.3s"
            />
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-5xl font-bold text-center mb-16">
              Get Booked in 3 Steps
            </h2>
            
            <div className="space-y-8">
              <StepCard
                number="1"
                title="Create Your Profile"
                description="Sign up and add your services with descriptions, prices, and duration."
              />
              <StepCard
                number="2"
                title="Share Your Link"
                description="Get a beautiful booking page with your custom URL. Share it everywhere."
              />
              <StepCard
                number="3"
                title="Manage Bookings"
                description="Accept or decline requests, track clients, and grow your business."
              />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary to-accent text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Ready to Get Professional?
          </h2>
          <p className="text-lg md:text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Join hundreds of creators who stopped losing clients to unreliable DMs
          </p>
          <Button asChild size="lg" variant="secondary" className="text-lg px-8 shadow-xl">
            <Link to="/auth">
              Start Free Today
              <ArrowRight className="ml-2 w-5 h-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2025 BrandBook. Built for creators, by creators.</p>
        </div>
      </footer>
    </div>
  );
};

const FeatureCard = ({ 
  icon, 
  title, 
  description,
  delay = "0s"
}: { 
  icon: React.ReactNode; 
  title: string; 
  description: string;
  delay?: string;
}) => (
  <div 
    className="bg-card rounded-xl p-8 shadow-md hover-lift border animate-fade-up"
    style={{ animationDelay: delay }}
  >
    <div className="mb-4">{icon}</div>
    <h3 className="text-xl font-bold mb-3">{title}</h3>
    <p className="text-muted-foreground">{description}</p>
  </div>
);

const StepCard = ({ 
  number, 
  title, 
  description 
}: { 
  number: string; 
  title: string; 
  description: string; 
}) => (
  <div className="flex gap-6 items-start animate-fade-in" style={{ animationDelay: `${(parseInt(number) - 1) * 0.2}s` }}>
    <div className="flex-shrink-0 w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-glow-sm">
      <CheckCircle2 className="w-6 h-6" />
    </div>
    <div>
      <h3 className="text-2xl font-bold mb-2">{title}</h3>
      <p className="text-muted-foreground text-lg">{description}</p>
    </div>
  </div>
);

export default Index;
