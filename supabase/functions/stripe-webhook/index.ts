import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    console.error("Missing signature or webhook secret");
    return new Response("Missing configuration", { status: 400 });
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    console.log("Received webhook event:", event.type);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const bookingId = session.metadata?.bookingId;

        if (!bookingId) {
          console.error("No bookingId in session metadata");
          break;
        }

        console.log("Processing completed checkout for booking:", bookingId);

        // Update booking status
        const { data: booking, error: updateError } = await supabase
          .from("bookings")
          .update({
            payment_status: "paid",
            status: "confirmed",
          })
          .eq("id", bookingId)
          .select("*, services(*), profiles(*)")
          .single();

        if (updateError) {
          console.error("Error updating booking:", updateError);
          break;
        }

        if (booking) {
          console.log("Booking confirmed:", bookingId);

          // Send confirmation email
          try {
            const bookingDate = new Date(booking.booking_date).toLocaleString();
            await supabase.functions.invoke("send-booking-email", {
              body: {
                toEmail: booking.client_email,
                clientName: booking.client_name,
                serviceTitle: booking.services.title,
                bookingDate: bookingDate,
                status: "accepted",
              },
            });
            console.log("Confirmation email sent to:", booking.client_email);
          } catch (emailError) {
            console.error("Error sending email:", emailError);
          }
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log("Payment failed:", paymentIntent.id);

        // Find booking by payment intent ID
        const { data: booking } = await supabase
          .from("bookings")
          .select("id")
          .eq("stripe_payment_intent_id", paymentIntent.id)
          .single();

        if (booking) {
          await supabase
            .from("bookings")
            .update({
              payment_status: "unpaid",
              status: "cancelled",
            })
            .eq("id", booking.id);

          console.log("Booking cancelled due to payment failure:", booking.id);
        }
        break;
      }

      case "checkout.session.expired": {
        const expiredSession = event.data.object as Stripe.Checkout.Session;
        const bookingId = expiredSession.metadata?.bookingId;
        
        if (bookingId) {
          await supabase
            .from("bookings")
            .update({
              payment_status: "unpaid",
              status: "cancelled"
            })
            .eq("id", bookingId);
          
          console.log("Booking cancelled due to expired session:", bookingId);
        }
        break;
      }

      default:
        console.log("Unhandled event type:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { "Content-Type": "application/json" }, status: 400 }
    );
  }
});
