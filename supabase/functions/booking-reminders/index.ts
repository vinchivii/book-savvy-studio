import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@4.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const in24HoursPlus15Min = new Date(in24Hours.getTime() + 15 * 60 * 1000);
    const in2HoursPlus15Min = new Date(in2Hours.getTime() + 15 * 60 * 1000);

    console.log("Checking for reminders to send...");

    // Find bookings that need 24h reminder
    const { data: bookings24h } = await supabase
      .from("bookings")
      .select(`
        id,
        booking_date,
        client_name,
        client_email,
        services!inner (title, duration),
        profiles!creator_id (full_name, business_name)
      `)
      .eq("status", "confirmed")
      .eq("payment_status", "paid")
      .gte("booking_date", in24Hours.toISOString())
      .lte("booking_date", in24HoursPlus15Min.toISOString());

    console.log(`Found ${bookings24h?.length || 0} bookings for 24h reminders`);

    // Send 24h reminders
    if (bookings24h && bookings24h.length > 0) {
      for (const booking of bookings24h) {
        // Check if already sent
        const { data: existing } = await supabase
          .from("notifications_sent")
          .select("id")
          .eq("booking_id", booking.id)
          .eq("notification_type", "reminder_24h")
          .maybeSingle();

        if (!existing) {
          const bookingDate = new Date(booking.booking_date);
          const profile = Array.isArray(booking.profiles) ? booking.profiles[0] : booking.profiles;
          const service = Array.isArray(booking.services) ? booking.services[0] : booking.services;
          const creatorName = profile.business_name || profile.full_name;

          await resend.emails.send({
            from: "Bookings <onboarding@resend.dev>",
            to: [booking.client_email],
            subject: `Reminder: Your appointment tomorrow with ${creatorName}`,
            html: `
              <h2>Appointment Reminder</h2>
              <p>Hi ${booking.client_name},</p>
              <p>This is a reminder that you have an appointment scheduled for tomorrow:</p>
              <ul>
                <li><strong>Service:</strong> ${service.title}</li>
                <li><strong>Date:</strong> ${bookingDate.toLocaleDateString()}</li>
                <li><strong>Time:</strong> ${bookingDate.toLocaleTimeString()}</li>
                <li><strong>Duration:</strong> ${service.duration} minutes</li>
                <li><strong>Provider:</strong> ${creatorName}</li>
              </ul>
              <p>Looking forward to seeing you!</p>
            `,
          });

          // Mark as sent
          await supabase.from("notifications_sent").insert({
            booking_id: booking.id,
            notification_type: "reminder_24h",
          });

          console.log(`Sent 24h reminder for booking ${booking.id}`);
        }
      }
    }

    // Find bookings that need 2h reminder
    const { data: bookings2h } = await supabase
      .from("bookings")
      .select(`
        id,
        booking_date,
        client_name,
        client_email,
        services!inner (title, duration),
        profiles!creator_id (full_name, business_name)
      `)
      .eq("status", "confirmed")
      .eq("payment_status", "paid")
      .gte("booking_date", in2Hours.toISOString())
      .lte("booking_date", in2HoursPlus15Min.toISOString());

    console.log(`Found ${bookings2h?.length || 0} bookings for 2h reminders`);

    // Send 2h reminders
    if (bookings2h && bookings2h.length > 0) {
      for (const booking of bookings2h) {
        // Check if already sent
        const { data: existing } = await supabase
          .from("notifications_sent")
          .select("id")
          .eq("booking_id", booking.id)
          .eq("notification_type", "reminder_2h")
          .maybeSingle();

        if (!existing) {
          const bookingDate = new Date(booking.booking_date);
          const profile = Array.isArray(booking.profiles) ? booking.profiles[0] : booking.profiles;
          const service = Array.isArray(booking.services) ? booking.services[0] : booking.services;
          const creatorName = profile.business_name || profile.full_name;

          await resend.emails.send({
            from: "Bookings <onboarding@resend.dev>",
            to: [booking.client_email],
            subject: `Your appointment is in 2 hours with ${creatorName}`,
            html: `
              <h2>Upcoming Appointment</h2>
              <p>Hi ${booking.client_name},</p>
              <p>Your appointment is coming up soon:</p>
              <ul>
                <li><strong>Service:</strong> ${service.title}</li>
                <li><strong>Time:</strong> ${bookingDate.toLocaleTimeString()}</li>
                <li><strong>Duration:</strong> ${service.duration} minutes</li>
                <li><strong>Provider:</strong> ${creatorName}</li>
              </ul>
              <p>See you soon!</p>
            `,
          });

          // Mark as sent
          await supabase.from("notifications_sent").insert({
            booking_id: booking.id,
            notification_type: "reminder_2h",
          });

          console.log(`Sent 2h reminder for booking ${booking.id}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        reminders24h: bookings24h?.length || 0,
        reminders2h: bookings2h?.length || 0,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in booking-reminders:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
