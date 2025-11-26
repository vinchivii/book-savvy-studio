export interface Availability {
  id: string;
  creator_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TimeOff {
  id: string;
  creator_id: string;
  start_datetime: string;
  end_datetime: string;
  reason?: string;
  created_at: string;
}

export interface TimeSlot {
  start: string;
  end: string;
}

export interface BookingWithPayment {
  id: string;
  service_id: string;
  creator_id: string;
  booking_date: string;
  client_name: string;
  client_email: string;
  client_phone?: string;
  notes?: string;
  status: string;
  payment_status: 'unpaid' | 'pending' | 'paid' | 'refunded';
  price_at_booking: number;
  currency: string;
  stripe_checkout_session_id?: string;
  stripe_payment_intent_id?: string;
  created_at: string;
  updated_at: string;
}
