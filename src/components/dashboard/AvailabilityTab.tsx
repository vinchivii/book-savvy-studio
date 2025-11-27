import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Clock, Copy } from "lucide-react";

interface DayAvailability {
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  id?: string;
}

const DAYS = [
  { name: "Sunday", value: 0 },
  { name: "Monday", value: 1 },
  { name: "Tuesday", value: 2 },
  { name: "Wednesday", value: 3 },
  { name: "Thursday", value: 4 },
  { name: "Friday", value: 5 },
  { name: "Saturday", value: 6 },
];

export function AvailabilityTab({ userId }: { userId: string }) {
  const [availability, setAvailability] = useState<Record<number, DayAvailability>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAvailability();
  }, [userId]);

  const fetchAvailability = async () => {
    const { data, error } = await supabase
      .from('availability')
      .select('*')
      .eq('creator_id', userId);

    if (error) {
      console.error("Error fetching availability:", error);
      toast.error("Failed to load availability");
    } else {
      const availMap: Record<number, DayAvailability> = {};
      
      // Initialize with defaults
      DAYS.forEach(day => {
        availMap[day.value] = {
          day_of_week: day.value,
          start_time: "09:00",
          end_time: "17:00",
          is_active: false,
        };
      });
      
      // Override with actual data
      data?.forEach(item => {
        availMap[item.day_of_week] = {
          ...item,
          start_time: item.start_time.substring(0, 5), // Format HH:MM
          end_time: item.end_time.substring(0, 5),
        };
      });
      
      setAvailability(availMap);
    }
    setLoading(false);
  };

  const handleToggle = (dayValue: number) => {
    setAvailability(prev => ({
      ...prev,
      [dayValue]: {
        ...prev[dayValue],
        is_active: !prev[dayValue].is_active,
      },
    }));
  };

  const handleTimeChange = (dayValue: number, field: 'start_time' | 'end_time', value: string) => {
    setAvailability(prev => ({
      ...prev,
      [dayValue]: {
        ...prev[dayValue],
        [field]: value,
      },
    }));
  };

  const validateTimes = () => {
    for (const day of DAYS) {
      const avail = availability[day.value];
      if (avail.is_active && avail.start_time >= avail.end_time) {
        toast.error(`${day.name}: Start time must be before end time`);
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (!validateTimes()) return;

    setSaving(true);
    try {
      // Prepare upsert data
      const upsertData = DAYS.map(day => {
        const avail = availability[day.value];
        return {
          creator_id: userId,
          day_of_week: day.value,
          start_time: avail.start_time,
          end_time: avail.end_time,
          is_active: avail.is_active,
        };
      });

      const { error } = await supabase
        .from('availability')
        .upsert(upsertData, { 
          onConflict: 'creator_id,day_of_week',
          ignoreDuplicates: false 
        });

      if (error) throw error;

      toast.success("Availability updated successfully");
      fetchAvailability();
    } catch (error: any) {
      console.error("Error saving availability:", error);
      toast.error(error.message || "Failed to save availability");
    } finally {
      setSaving(false);
    }
  };

  const copyMondayToAll = () => {
    const mondayAvail = availability[1];
    if (!mondayAvail) {
      toast.error("Configure Monday first");
      return;
    }

    const updated = { ...availability };
    DAYS.forEach(day => {
      if (day.value !== 1) {
        updated[day.value] = {
          ...updated[day.value],
          start_time: mondayAvail.start_time,
          end_time: mondayAvail.end_time,
          is_active: mondayAvail.is_active,
        };
      }
    });
    
    setAvailability(updated);
    toast.success("Copied Monday hours to all days");
  };

  if (loading) {
    return <div className="text-center py-8">Loading availability...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Weekly Availability</h2>
          <p className="text-muted-foreground">Set your working hours for each day of the week</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={copyMondayToAll}
          className="gap-2"
        >
          <Copy className="h-4 w-4" />
          Copy Mon to All
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Working Hours
          </CardTitle>
          <CardDescription>
            Clients can only book during your available hours. Toggle days on/off and set your preferred time slots.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {DAYS.map((day) => {
            const avail = availability[day.value];
            
            return (
              <div 
                key={day.value}
                className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors"
              >
                <div className="flex items-center gap-3 sm:w-40">
                  <Switch
                    checked={avail?.is_active || false}
                    onCheckedChange={() => handleToggle(day.value)}
                  />
                  <Label className="font-semibold cursor-pointer" onClick={() => handleToggle(day.value)}>
                    {day.name}
                  </Label>
                </div>

                {avail?.is_active && (
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground">From</Label>
                      <input
                        type="time"
                        value={avail.start_time}
                        onChange={(e) => handleTimeChange(day.value, 'start_time', e.target.value)}
                        className="px-3 py-2 border rounded-md bg-background text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-sm text-muted-foreground">To</Label>
                      <input
                        type="time"
                        value={avail.end_time}
                        onChange={(e) => handleTimeChange(day.value, 'end_time', e.target.value)}
                        className="px-3 py-2 border rounded-md bg-background text-sm"
                      />
                    </div>
                  </div>
                )}

                {!avail?.is_active && (
                  <div className="text-sm text-muted-foreground italic">
                    Not available
                  </div>
                )}
              </div>
            );
          })}

          <div className="flex justify-end pt-4 border-t">
            <Button 
              onClick={handleSave}
              disabled={saving}
              size="lg"
            >
              {saving ? "Saving..." : "Save Availability"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="space-y-2 text-sm">
            <p className="font-medium">💡 Tips:</p>
            <ul className="list-disc list-inside space-y-1 text-muted-foreground">
              <li>Clients can only book time slots during your available hours</li>
              <li>Time slots respect your service duration plus a 15-minute buffer</li>
              <li>Use Time Off to block specific dates or periods</li>
              <li>Changes take effect immediately for new bookings</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
