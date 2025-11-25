import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@3.5.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BookingEmailRequest {
  toEmail: string;
  clientName: string;
  serviceTitle: string;
  bookingDate: string;
  status: 'pending' | 'accepted' | 'declined';
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { toEmail, clientName, serviceTitle, bookingDate, status }: BookingEmailRequest = await req.json();

    console.log(`Sending ${status} email to: ${toEmail} for service: ${serviceTitle}`);

    // Create email subject based on status
    let subject = "";
    let message = "";
    
    if (status === 'pending') {
      subject = `Booking Request for ${serviceTitle}`;
      message = `
        <h1>Booking Request Received!</h1>
        <p>Hi ${clientName},</p>
        <p>We've received your booking request for <strong>${serviceTitle}</strong>.</p>
        <p><strong>Booking Date:</strong> ${bookingDate}</p>
        <p>Your booking is currently <strong>pending</strong>. You'll receive another email once the creator responds.</p>
        <p>Best regards,<br>BrandBook Team</p>
      `;
    } else if (status === 'accepted') {
      subject = `Booking Confirmed for ${serviceTitle}`;
      message = `
        <h1>Booking Confirmed!</h1>
        <p>Hi ${clientName},</p>
        <p>Great news! Your booking for <strong>${serviceTitle}</strong> has been confirmed.</p>
        <p><strong>Booking Date:</strong> ${bookingDate}</p>
        <p>We look forward to seeing you!</p>
        <p>Best regards,<br>BrandBook Team</p>
      `;
    } else if (status === 'declined') {
      subject = `Booking Update for ${serviceTitle}`;
      message = `
        <h1>Booking Update</h1>
        <p>Hi ${clientName},</p>
        <p>Unfortunately, your booking request for <strong>${serviceTitle}</strong> on ${bookingDate} could not be accommodated at this time.</p>
        <p>Please try selecting a different date or reach out to the creator directly.</p>
        <p>Best regards,<br>BrandBook Team</p>
      `;
    }

    const emailResponse = await resend.emails.send({
      from: "BrandBook <onboarding@resend.dev>",
      to: [toEmail],
      subject: subject,
      html: message,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-booking-email function:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
