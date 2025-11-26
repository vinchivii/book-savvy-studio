import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
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
    const {
      serviceId,
      creatorSlug,
      bookingStartDatetime,
      clientName,
      clientEmail,
      clientPhone,
      notes,
    } = await req.json();

    if (!serviceId || !creatorSlug || !bookingStartDatetime || !clientName || !clientEmail) {
      throw new Error("Missing required fields");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get creator profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("slug", creatorSlug)
      .single();

    if (profileError || !profile) {
      throw new Error("Creator not found");
    }

    // Get service
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("*")
      .eq("id", serviceId)
      .eq("creator_id", profile.id)
      .single();

    if (serviceError || !service) {
      throw new Error("Service not found");
    }

    const bookingStart = new Date(bookingStartDatetime);
    const now = new Date();
    const minStartTime = new Date(now.getTime() + MINIMUM_LEAD_TIME_HOURS * 60 * 60 * 1000);

    if (bookingStart <= minStartTime) {
      throw new Error(`Bookings must be made at least ${MINIMUM_LEAD_TIME_HOURS} hours in advance`);
    }

    // Check availability - get day of week (0 = Sunday, 1 = Monday, etc.)
    const dayOfWeek = bookingStart.getDay();
    const timeString = bookingStart.toTimeString().slice(0, 5); // HH:MM format
    
    const { data: availability, error: availError } = await supabase
      .from("availability")
      .select("*")
      .eq("creator_id", profile.id)
      .eq("day_of_week", dayOfWeek)
      .eq("is_active", true);

    if (availError || !availability || availability.length === 0) {
      throw new Error("Creator is not available on this day");
    }

    // Check if time falls within any availability slot
    const isWithinAvailability = availability.some(slot => {
      return timeString >= slot.start_time && timeString < slot.end_time;
    });

    if (!isWithinAvailability) {
      throw new Error("Selected time is outside creator's availability hours");
    }

    // Check for conflicts with booking end time
    const bookingEnd = new Date(bookingStart.getTime() + (service.duration + BUFFER_MINUTES) * 60 * 1000);
    
    const { data: conflicts } = await supabase
      .from("bookings")
      .select("id, booking_date")
      .eq("creator_id", profile.id)
      .in("status", ["pending", "confirmed"])
      .neq("payment_status", "refunded");

    // Check for overlapping bookings
    if (conflicts && conflicts.length > 0) {
      const hasConflict = conflicts.some((existingBooking: any) => {
        const existingStart = new Date(existingBooking.booking_date);
        const existingEnd = new Date(existingStart.getTime() + (service.duration + BUFFER_MINUTES) * 60 * 1000);
        
        // Check if bookings overlap
        return (bookingStart < existingEnd && bookingEnd > existingStart);
      });

      if (hasConflict) {
        throw new Error("This time slot is no longer available");
      }
    }

    // Check time off
    const { data: timeOff } = await supabase
      .from("time_off")
      .select("id")
      .eq("creator_id", profile.id)
      .lte("start_datetime", bookingEnd.toISOString())
      .gte("end_datetime", bookingStart.toISOString());

    if (timeOff && timeOff.length > 0) {
      throw new Error("Creator is not available during this time");
    }

    // Create booking record
    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .insert({
        service_id: serviceId,
        creator_id: profile.id,
        booking_date: bookingStartDatetime,
        client_name: clientName,
        client_email: clientEmail,
        client_phone: clientPhone,
        notes: notes,
        status: "pending",
        payment_status: "pending",
        price_at_booking: service.price,
        currency: "usd",
      })
      .select()
      .single();

    if (bookingError || !booking) {
      console.error("Booking error:", bookingError);
      throw new Error("Failed to create booking");
    }

    // Create Stripe checkout session
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const session = await stripe.checkout.sessions.create({
      customer_email: clientEmail,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: service.title,
              description: `Session with ${profile.full_name}`,
            },
            unit_amount: Math.round(service.price * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/booking/success?bookingId=${booking.id}`,
      cancel_url: `${req.headers.get("origin")}/booking/cancelled?bookingId=${booking.id}`,
      metadata: {
        bookingId: booking.id,
      },
    });

    // Update booking with Stripe session ID
    await supabase
      .from("bookings")
      .update({
        stripe_checkout_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent as string,
      })
      .eq("id", booking.id);

    console.log("Checkout session created:", session.id);

    return new Response(
      JSON.stringify({ checkoutUrl: session.url, bookingId: booking.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error in create-checkout-session:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
