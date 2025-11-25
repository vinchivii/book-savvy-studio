import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Trash2, Edit, Upload, X, Loader2 } from "lucide-react";

interface Service {
  id: string;
  title: string;
  description: string | null;
  price: number;
  duration: number;
  active: boolean;
  media_url: string | null;
}

const ServicesTab = ({ userId }: { userId: string }) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price: "",
    duration: "",
    media_url: "",
  });

  useEffect(() => {
    fetchServices();
  }, [userId]);

  const fetchServices = async () => {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .eq('creator_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Error fetching services:", error);
      toast.error("Failed to load services");
    } else {
      setServices(data || []);
    }
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.price || !formData.duration) {
      toast.error("Please fill in all required fields");
      return;
    }

    const serviceData = {
      title: formData.title,
      description: formData.description,
      price: parseFloat(formData.price),
      duration: parseInt(formData.duration),
      media_url: formData.media_url || null,
      creator_id: userId,
    };

    if (editingService) {
      const { error } = await supabase
        .from('services')
        .update(serviceData)
        .eq('id', editingService.id);

      if (error) {
        toast.error("Failed to update service");
      } else {
        toast.success("Service updated!");
        fetchServices();
        resetForm();
      }
    } else {
      const { error } = await supabase
        .from('services')
        .insert(serviceData);

      if (error) {
        toast.error("Failed to create service");
      } else {
        toast.success("Service created!");
        fetchServices();
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this service?")) return;

    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error("Failed to delete service");
    } else {
      toast.success("Service deleted");
      fetchServices();
    }
  };

  const resetForm = () => {
    setFormData({ title: "", description: "", price: "", duration: "", media_url: "" });
    setEditingService(null);
    setDialogOpen(false);
  };

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type (images and videos)
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime'];
    if (!validTypes.includes(file.type)) {
      toast.error("Please upload an image (JPEG, PNG, WEBP, GIF) or video (MP4, WEBM, MOV)");
      return;
    }

    // Validate file size (20MB max)
    if (file.size > 20 * 1024 * 1024) {
      toast.error("File size must be less than 20MB");
      return;
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      // Delete old media if exists
      if (formData.media_url) {
        const oldPath = formData.media_url.split('/').slice(-2).join('/');
        if (oldPath.includes(userId)) {
          await supabase.storage.from('service-media').remove([oldPath]);
        }
      }

      const { error: uploadError } = await supabase.storage
        .from('service-media')
        .upload(fileName, file, {
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('service-media')
        .getPublicUrl(fileName);

      setFormData(prev => ({ ...prev, media_url: publicUrl }));
      toast.success("Media uploaded successfully");
    } catch (error) {
      console.error("Error uploading media:", error);
      toast.error("Failed to upload media");
    } finally {
      setUploading(false);
    }
  };

  const removeMedia = () => {
    setFormData(prev => ({ ...prev, media_url: "" }));
  };

  const startEdit = (service: Service) => {
    setEditingService(service);
    setFormData({
      title: service.title,
      description: service.description || "",
      price: service.price.toString(),
      duration: service.duration.toString(),
      media_url: service.media_url || "",
    });
    setDialogOpen(true);
  };

  if (loading) {
    return <div className="text-center py-8">Loading services...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Your Services</h2>
          <p className="text-muted-foreground">Manage the services you offer</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />
              Add Service
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingService ? "Edit Service" : "Add New Service"}</DialogTitle>
              <DialogDescription>
                Create a service that clients can book
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Service Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Haircut, Portrait Session"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what's included..."
                  rows={3}
                />
              </div>

              {/* Media Upload Section */}
              <div className="space-y-2">
                <Label>Service Image/Video</Label>
                
                {formData.media_url && (
                  <div className="relative w-full rounded-lg overflow-hidden border">
                    {formData.media_url.match(/\.(mp4|webm|mov)$/i) ? (
                      <video 
                        src={formData.media_url} 
                        className="w-full h-40 object-cover"
                        controls
                      />
                    ) : (
                      <img 
                        src={formData.media_url} 
                        alt="Service media" 
                        className="w-full h-40 object-cover"
                      />
                    )}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('media-upload')?.click()}
                    disabled={uploading}
                    className="flex-1"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Media
                      </>
                    )}
                  </Button>
                  
                  {formData.media_url && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={removeMedia}
                      disabled={uploading}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <input
                  id="media-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime"
                  onChange={handleMediaUpload}
                  className="hidden"
                />
                
                <p className="text-sm text-muted-foreground">
                  Upload an image or video (max 20MB)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Price ($) *</Label>
                  <Input
                    id="price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="50.00"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duration">Duration (min) *</Label>
                  <Input
                    id="duration"
                    type="number"
                    min="1"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    placeholder="60"
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full">
                {editingService ? "Update Service" : "Create Service"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {services.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No services yet</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Your First Service
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {services.map((service, index) => (
            <Card key={service.id} className="hover-lift animate-fade-up overflow-hidden" style={{ animationDelay: `${index * 0.1}s` }}>
              {service.media_url && (
                <div className="w-full h-48 overflow-hidden">
                  {service.media_url.match(/\.(mp4|webm|mov)$/i) ? (
                    <video 
                      src={service.media_url} 
                      className="w-full h-full object-cover"
                      controls
                    />
                  ) : (
                    <img 
                      src={service.media_url} 
                      alt={service.title}
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
              )}
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{service.title}</CardTitle>
                    <CardDescription className="mt-1">
                      ${service.price.toFixed(2)} • {service.duration} min
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startEdit(service)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(service.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {service.description && (
                <CardContent>
                  <p className="text-sm text-muted-foreground">{service.description}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ServicesTab;
