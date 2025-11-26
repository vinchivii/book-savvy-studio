import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MINIMUM_LEAD_TIME_HOURS = 2;
const BUFFER_MINUTES = 15;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { creatorSlug, serviceId, date } = await req.json();
    
    if (!creatorSlug || !serviceId || !date) {
      throw new Error("Missing required parameters: creatorSlug, serviceId, date");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get creator profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id")
      .eq("slug", creatorSlug)
      .single();

    if (profileError || !profile) {
      throw new Error("Creator not found");
    }

    // Get service details
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("duration, price")
      .eq("id", serviceId)
      .eq("creator_id", profile.id)
      .single();

    if (serviceError || !service) {
      throw new Error("Service not found");
    }

    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();
    const now = new Date();
    const minStartTime = new Date(now.getTime() + MINIMUM_LEAD_TIME_HOURS * 60 * 60 * 1000);

    // Get availability for this day
    const { data: availability, error: availError } = await supabase
      .from("availability")
      .select("*")
      .eq("creator_id", profile.id)
      .eq("day_of_week", dayOfWeek)
      .eq("is_active", true);

    if (availError || !availability || availability.length === 0) {
      return new Response(
        JSON.stringify({ date, serviceId, timeSlots: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // Get existing bookings for this date
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const { data: bookings, error: bookingsError } = await supabase
      .from("bookings")
      .select("booking_date, service_id")
      .eq("creator_id", profile.id)
      .gte("booking_date", startOfDay.toISOString())
      .lte("booking_date", endOfDay.toISOString())
      .in("status", ["pending", "confirmed"])
      .neq("payment_status", "refunded");

    if (bookingsError) {
      throw new Error("Failed to fetch bookings");
    }

    // Get time off periods
    const { data: timeOff, error: timeOffError } = await supabase
      .from("time_off")
      .select("*")
      .eq("creator_id", profile.id)
      .lte("start_datetime", endOfDay.toISOString())
      .gte("end_datetime", startOfDay.toISOString());

    if (timeOffError) {
      throw new Error("Failed to fetch time off");
    }

    // Generate time slots
    const timeSlots = [];
    const slotDuration = service.duration + BUFFER_MINUTES;

    for (const avail of availability) {
      const [startHour, startMinute] = avail.start_time.split(":").map(Number);
      const [endHour, endMinute] = avail.end_time.split(":").map(Number);

      let currentSlot = new Date(targetDate);
      currentSlot.setHours(startHour, startMinute, 0, 0);

      const endTime = new Date(targetDate);
      endTime.setHours(endHour, endMinute, 0, 0);

      while (currentSlot < endTime) {
        const slotEnd = new Date(currentSlot.getTime() + service.duration * 60 * 1000);

        // Check if slot is in the past or too soon
        if (slotEnd <= minStartTime) {
          currentSlot = new Date(currentSlot.getTime() + slotDuration * 60 * 1000);
          continue;
        }

        // Check if slot overlaps with existing booking
        const hasConflict = bookings?.some((booking) => {
          const bookingStart = new Date(booking.booking_date);
          const bookingEnd = new Date(
            bookingStart.getTime() + 
            (service.duration + BUFFER_MINUTES) * 60 * 1000
          );
          return (
            (currentSlot >= bookingStart && currentSlot < bookingEnd) ||
            (slotEnd > bookingStart && slotEnd <= bookingEnd) ||
            (currentSlot <= bookingStart && slotEnd >= bookingEnd)
          );
        });

        // Check if slot overlaps with time off
        const inTimeOff = timeOff?.some((period) => {
          const timeOffStart = new Date(period.start_datetime);
          const timeOffEnd = new Date(period.end_datetime);
          return (
            (currentSlot >= timeOffStart && currentSlot < timeOffEnd) ||
            (slotEnd > timeOffStart && slotEnd <= timeOffEnd) ||
            (currentSlot <= timeOffStart && slotEnd >= timeOffEnd)
          );
        });

        if (!hasConflict && !inTimeOff) {
          timeSlots.push({
            start: currentSlot.toISOString(),
            end: slotEnd.toISOString(),
          });
        }

        currentSlot = new Date(currentSlot.getTime() + slotDuration * 60 * 1000);
      }
    }

    return new Response(
      JSON.stringify({ date, serviceId, timeSlots }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error in get-available-slots:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
