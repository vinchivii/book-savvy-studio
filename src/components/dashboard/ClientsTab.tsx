import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Users, DollarSign, Calendar, Tag, X } from "lucide-react";
import { format } from "date-fns";

interface Client {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  first_booking_date: string;
  last_booking_date: string;
  total_bookings: number;
  total_spent: number;
  notes: string | null;
  tags: string[];
}

const ClientsTab = ({ userId }: { userId: string }) => {
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [notes, setNotes] = useState("");
  const [newTag, setNewTag] = useState("");

  useEffect(() => {
    fetchClients();
  }, [userId]);

  useEffect(() => {
    filterClients();
  }, [searchTerm, clients]);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("creator_id", userId)
        .order("last_booking_date", { ascending: false });

      if (error) throw error;
      setClients(data || []);
      setFilteredClients(data || []);
    } catch (error: any) {
      console.error("Error fetching clients:", error);
      toast.error("Failed to load clients");
    } finally {
      setLoading(false);
    }
  };

  const filterClients = () => {
    if (!searchTerm) {
      setFilteredClients(clients);
      return;
    }

    const filtered = clients.filter(
      (client) =>
        client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );
    setFilteredClients(filtered);
  };

  const openClientProfile = (client: Client) => {
    setSelectedClient(client);
    setNotes(client.notes || "");
  };

  const closeClientProfile = () => {
    setSelectedClient(null);
    setNotes("");
    setNewTag("");
  };

  const saveNotes = async () => {
    if (!selectedClient) return;

    try {
      const { error } = await supabase
        .from("clients")
        .update({ notes })
        .eq("id", selectedClient.id);

      if (error) throw error;

      toast.success("Notes saved");
      fetchClients();
      setSelectedClient({ ...selectedClient, notes });
    } catch (error: any) {
      console.error("Error saving notes:", error);
      toast.error("Failed to save notes");
    }
  };

  const addTag = async () => {
    if (!selectedClient || !newTag.trim()) return;

    const updatedTags = [...selectedClient.tags, newTag.trim()];

    try {
      const { error } = await supabase
        .from("clients")
        .update({ tags: updatedTags })
        .eq("id", selectedClient.id);

      if (error) throw error;

      toast.success("Tag added");
      setNewTag("");
      fetchClients();
      setSelectedClient({ ...selectedClient, tags: updatedTags });
    } catch (error: any) {
      console.error("Error adding tag:", error);
      toast.error("Failed to add tag");
    }
  };

  const removeTag = async (tagToRemove: string) => {
    if (!selectedClient) return;

    const updatedTags = selectedClient.tags.filter(tag => tag !== tagToRemove);

    try {
      const { error } = await supabase
        .from("clients")
        .update({ tags: updatedTags })
        .eq("id", selectedClient.id);

      if (error) throw error;

      toast.success("Tag removed");
      fetchClients();
      setSelectedClient({ ...selectedClient, tags: updatedTags });
    } catch (error: any) {
      console.error("Error removing tag:", error);
      toast.error("Failed to remove tag");
    }
  };

  if (loading) {
    return <div className="text-center py-8">Loading clients...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Client Relationship Management</h2>
        <p className="text-muted-foreground">Manage your clients and track their activity</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search by name, email, or tag..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{clients.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${clients.reduce((sum, c) => sum + Number(c.total_spent), 0).toFixed(2)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Bookings</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {clients.reduce((sum, c) => sum + c.total_bookings, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client List */}
      {filteredClients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchTerm ? "No clients match your search" : "No clients yet"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredClients.map((client) => (
            <Card
              key={client.id}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => openClientProfile(client)}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{client.name}</CardTitle>
                    <CardDescription>{client.email}</CardDescription>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold">${Number(client.total_spent).toFixed(2)}</div>
                    <p className="text-sm text-muted-foreground">{client.total_bookings} bookings</p>
                  </div>
                </div>
              </CardHeader>
              {client.tags.length > 0 && (
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {client.tags.map((tag, idx) => (
                      <Badge key={idx} variant="outline">
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Client Profile Dialog */}
      <Dialog open={!!selectedClient} onOpenChange={(open) => !open && closeClientProfile()}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          {selectedClient && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedClient.name}</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-6">
                {/* Contact Info */}
                <div>
                  <h3 className="font-medium mb-2">Contact Information</h3>
                  <div className="space-y-1 text-sm">
                    <p><strong>Email:</strong> {selectedClient.email}</p>
                    {selectedClient.phone && <p><strong>Phone:</strong> {selectedClient.phone}</p>}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Spent</p>
                    <p className="text-xl font-bold">${Number(selectedClient.total_spent).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Bookings</p>
                    <p className="text-xl font-bold">{selectedClient.total_bookings}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">First Booking</p>
                    <p className="text-sm">{format(new Date(selectedClient.first_booking_date), "PP")}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Last Booking</p>
                    <p className="text-sm">{format(new Date(selectedClient.last_booking_date), "PP")}</p>
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <h3 className="font-medium mb-2">Tags</h3>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {selectedClient.tags.map((tag, idx) => (
                      <Badge key={idx} variant="secondary" className="gap-1">
                        {tag}
                        <button
                          onClick={() => removeTag(tag)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add tag..."
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addTag()}
                    />
                    <Button onClick={addTag}>Add</Button>
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <h3 className="font-medium mb-2">Notes</h3>
                  <Textarea
                    placeholder="Add notes about this client..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={4}
                  />
                  <Button onClick={saveNotes} className="mt-2">
                    Save Notes
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientsTab;
