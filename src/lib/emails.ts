import { supabase } from "@/integrations/supabase/client";

export async function sendBookingConfirmationEmail(
  toEmail: string,
  clientName: string,
  serviceTitle: string,
  bookingDate: string,
  status: 'pending' | 'accepted' | 'declined'
) {
  try {
    const { data, error } = await supabase.functions.invoke('send-booking-email', {
      body: { toEmail, clientName, serviceTitle, bookingDate, status },
    });

    if (error) {
      console.error('Email sending failed:', error);
      return { success: false, message: 'Failed to send email' };
    }

    console.log('Email sent successfully:', data);
    return { success: true, message: 'Email sent successfully' };
  } catch (error) {
    console.error('Error calling email function:', error);
    return { success: false, message: 'Email service error' };
  }
}
