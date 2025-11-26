import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Clock, Plus, Trash2 } from "lucide-react";
import type { Availability } from "@/types/booking";

const DAYS_OF_WEEK = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

export function AvailabilityTab({ userId }: { userId: string }) {
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchAvailability();
  }, [userId]);

  const fetchAvailability = async () => {
    try {
      const { data, error } = await supabase
        .from("availability")
        .select("*")
        .eq("creator_id", userId)
        .order("day_of_week");

      if (error) throw error;
      setAvailability(data || []);
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

  const handleAddSlot = async (dayOfWeek: number) => {
    try {
      const { error } = await supabase.from("availability").insert({
        creator_id: userId,
        day_of_week: dayOfWeek,
        start_time: "09:00",
        end_time: "17:00",
        is_active: true,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Availability slot added",
      });
      fetchAvailability();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleUpdateSlot = async (
    id: string,
    field: string,
    value: string | boolean
  ) => {
    try {
      const { error } = await supabase
        .from("availability")
        .update({ [field]: value })
        .eq("id", id);

      if (error) throw error;
      fetchAvailability();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    }
  };

  const handleDeleteSlot = async (id: string) => {
    try {
      const { error } = await supabase
        .from("availability")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Availability slot deleted",
      });
      fetchAvailability();
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
        <Clock className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle>Weekly Availability</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {DAYS_OF_WEEK.map((day) => {
            const daySlots = availability.filter(
              (slot) => slot.day_of_week === day.value
            );

            return (
              <div key={day.value} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{day.label}</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleAddSlot(day.value)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Slot
                  </Button>
                </div>

                {daySlots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No availability set for this day
                  </p>
                ) : (
                  <div className="space-y-2">
                    {daySlots.map((slot) => (
                      <Card key={slot.id} className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="flex-1 grid grid-cols-2 gap-4">
                            <div>
                              <Label>Start Time</Label>
                              <Input
                                type="time"
                                value={slot.start_time}
                                onChange={(e) =>
                                  handleUpdateSlot(
                                    slot.id,
                                    "start_time",
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                            <div>
                              <Label>End Time</Label>
                              <Input
                                type="time"
                                value={slot.end_time}
                                onChange={(e) =>
                                  handleUpdateSlot(
                                    slot.id,
                                    "end_time",
                                    e.target.value
                                  )
                                }
                              />
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={slot.is_active}
                              onCheckedChange={(checked) =>
                                handleUpdateSlot(slot.id, "is_active", checked)
                              }
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleDeleteSlot(slot.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
