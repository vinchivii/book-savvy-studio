import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Mail, Phone, Calendar, Search } from "lucide-react";
import { format } from "date-fns";

interface Client {
  client_name: string;
  client_email: string;
  client_phone: string | null;
  booking_count: number;
  last_booking: string;
}

const ClientsTab = ({ userId }: { userId: string }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchClients();
  }, [userId]);

  useEffect(() => {
    if (searchTerm) {
      const filtered = clients.filter((client) =>
        client.client_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.client_email.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredClients(filtered);
    } else {
      setFilteredClients(clients);
    }
  }, [searchTerm, clients]);

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from('bookings')
      .select('client_name, client_email, client_phone, booking_date')
      .eq('creator_id', userId)
      .order('booking_date', { ascending: false });

    if (error) {
      console.error("Error fetching clients:", error);
      toast.error("Failed to load clients");
      setLoading(false);
      return;
    }

    // Group by email and aggregate
    const clientMap = new Map<string, Client>();
    
    data?.forEach((booking) => {
      const existing = clientMap.get(booking.client_email);
      if (existing) {
        existing.booking_count += 1;
        if (new Date(booking.booking_date) > new Date(existing.last_booking)) {
          existing.last_booking = booking.booking_date;
        }
      } else {
        clientMap.set(booking.client_email, {
          client_name: booking.client_name,
          client_email: booking.client_email,
          client_phone: booking.client_phone,
          booking_count: 1,
          last_booking: booking.booking_date,
        });
      }
    });

    const clientList = Array.from(clientMap.values()).sort(
      (a, b) => new Date(b.last_booking).getTime() - new Date(a.last_booking).getTime()
    );

    setClients(clientList);
    setFilteredClients(clientList);
    setLoading(false);
  };

  if (loading) {
    return <div className="text-center py-8">Loading clients...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Your Clients</h2>
        <p className="text-muted-foreground">View and manage your client database</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search clients by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {filteredClients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {searchTerm ? "No clients found matching your search" : "No clients yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {filteredClients.map((client, index) => (
            <Card key={client.client_email} className="hover-lift animate-fade-up" style={{ animationDelay: `${index * 0.1}s` }}>
              <CardHeader>
                <CardTitle className="text-lg">{client.client_name}</CardTitle>
                <CardDescription className="space-y-1">
                  <span className="flex items-center gap-1 text-sm">
                    <Mail className="h-3 w-3" />
                    {client.client_email}
                  </span>
                  {client.client_phone && (
                    <span className="flex items-center gap-1 text-sm">
                      <Phone className="h-3 w-3" />
                      {client.client_phone}
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm">
                  <div className="text-muted-foreground">
                    <p>{client.booking_count} booking{client.booking_count !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>Last: {format(new Date(client.last_booking), "PP")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClientsTab;
