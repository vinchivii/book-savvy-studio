import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalendarIcon, Trash2, Plus } from "lucide-react";
import type { TimeOff } from "@/types/booking";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function TimeOffTab({ userId }: { userId: string }) {
  const [timeOff, setTimeOff] = useState<TimeOff[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    start_datetime: "",
    end_datetime: "",
    reason: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchTimeOff();
  }, [userId]);

  const fetchTimeOff = async () => {
    try {
      const { data, error } = await supabase
        .from("time_off")
        .select("*")
        .eq("creator_id", userId)
        .order("start_datetime", { ascending: true });

      if (error) throw error;
      setTimeOff(data || []);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.start_datetime || !formData.end_datetime) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please fill in all required fields",
      });
      return;
    }

    try {
      const { error } = await supabase.from("time_off").insert({
        creator_id: userId,
        start_datetime: formData.start_datetime,
        end_datetime: formData.end_datetime,
        reason: formData.reason,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Time off added successfully",
      });

      setFormData({
        start_datetime: "",
        end_datetime: "",
        reason: "",
      });
      setOpen(false);
      fetchTimeOff();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("time_off").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Time off deleted",
      });
      fetchTimeOff();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <CalendarIcon className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Time Off</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Time Off
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Time Off</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="start">Start Date & Time</Label>
                <Input
                  id="start"
                  type="datetime-local"
                  value={formData.start_datetime}
                  onChange={(e) =>
                    setFormData({ ...formData, start_datetime: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="end">End Date & Time</Label>
                <Input
                  id="end"
                  type="datetime-local"
                  value={formData.end_datetime}
                  onChange={(e) =>
                    setFormData({ ...formData, end_datetime: e.target.value })
                  }
                  required
                />
              </div>
              <div>
                <Label htmlFor="reason">Reason (Optional)</Label>
                <Textarea
                  id="reason"
                  value={formData.reason}
                  onChange={(e) =>
                    setFormData({ ...formData, reason: e.target.value })
                  }
                  placeholder="e.g., Vacation, Conference, etc."
                />
              </div>
              <Button type="submit" className="w-full">
                Add Time Off
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {timeOff.length === 0 ? (
        <Card className="glass-card">
          <CardContent className="py-8 text-center text-muted-foreground">
            No time off scheduled
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {timeOff.map((period) => (
            <Card key={period.id} className="glass-card">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {new Date(period.start_datetime).toLocaleDateString()} -{" "}
                      {new Date(period.end_datetime).toLocaleDateString()}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(period.start_datetime).toLocaleTimeString()} -{" "}
                      {new Date(period.end_datetime).toLocaleTimeString()}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDelete(period.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              {period.reason && (
                <CardContent>
                  <p className="text-sm">{period.reason}</p>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
