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
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    console.log("Checking for completed bookings to follow up...");

    // Find recently completed bookings
    const { data: completedBookings } = await supabase
      .from("bookings")
      .select(`
        id,
        booking_date,
        client_name,
        client_email,
        services!inner (title),
        profiles!creator_id (id, full_name, business_name, slug)
      `)
      .eq("status", "completed")
      .gte("booking_date", twentyFourHoursAgo.toISOString())
      .lte("booking_date", now.toISOString());

    console.log(`Found ${completedBookings?.length || 0} completed bookings`);

    let followupsSent = 0;
    let reviewRequestsSent = 0;

    if (completedBookings && completedBookings.length > 0) {
      for (const booking of completedBookings) {
        const profile = Array.isArray(booking.profiles) ? booking.profiles[0] : booking.profiles;
        const service = Array.isArray(booking.services) ? booking.services[0] : booking.services;
        const creatorName = profile.business_name || profile.full_name;

        // Check if followup already sent
        const { data: existingFollowup } = await supabase
          .from("notifications_sent")
          .select("id")
          .eq("booking_id", booking.id)
          .eq("notification_type", "followup")
          .maybeSingle();

        if (!existingFollowup) {
          await resend.emails.send({
            from: "Bookings <onboarding@resend.dev>",
            to: [booking.client_email],
            subject: `Thank you for your visit to ${creatorName}!`,
            html: `
              <h2>Thank You!</h2>
              <p>Hi ${booking.client_name},</p>
              <p>Thank you for booking ${service.title} with ${creatorName}. We hope you had a great experience!</p>
              <p>We'd love to see you again soon.</p>
              <p>Best regards,<br>${creatorName}</p>
            `,
          });

          // Mark as sent
          await supabase.from("notifications_sent").insert({
            booking_id: booking.id,
            notification_type: "followup",
          });

          followupsSent++;
          console.log(`Sent followup for booking ${booking.id}`);
        }

        // Check if review request already sent
        const { data: existingReview } = await supabase
          .from("notifications_sent")
          .select("id")
          .eq("booking_id", booking.id)
          .eq("notification_type", "review_request")
          .maybeSingle();

        if (!existingReview) {
          const reviewUrl = `${req.headers.get("origin")}/review/${booking.id}`;

          await resend.emails.send({
            from: "Bookings <onboarding@resend.dev>",
            to: [booking.client_email],
            subject: `How was your experience with ${creatorName}?`,
            html: `
              <h2>Share Your Feedback</h2>
              <p>Hi ${booking.client_name},</p>
              <p>We hope you enjoyed your ${service.title} appointment with ${creatorName}!</p>
              <p>We'd love to hear about your experience. Your feedback helps us improve and helps others make informed decisions.</p>
              <p><a href="${reviewUrl}" style="display: inline-block; padding: 12px 24px; background-color: #0070f3; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Leave a Review</a></p>
              <p>Thank you for your time!</p>
              <p>Best regards,<br>${creatorName}</p>
            `,
          });

          // Mark as sent
          await supabase.from("notifications_sent").insert({
            booking_id: booking.id,
            notification_type: "review_request",
          });

          reviewRequestsSent++;
          console.log(`Sent review request for booking ${booking.id}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        followupsSent,
        reviewRequestsSent,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in booking-followup:", error);
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
