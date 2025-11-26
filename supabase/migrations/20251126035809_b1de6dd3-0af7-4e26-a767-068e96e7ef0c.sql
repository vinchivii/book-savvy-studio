-- Create clients table for CRM
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  first_booking_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_booking_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_bookings INTEGER DEFAULT 1,
  total_spent NUMERIC DEFAULT 0,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(creator_id, email)
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clients
CREATE POLICY "Creators can view their own clients"
ON public.clients FOR SELECT
TO authenticated
USING (auth.uid() = creator_id);

CREATE POLICY "Creators can insert their own clients"
ON public.clients FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update their own clients"
ON public.clients FOR UPDATE
TO authenticated
USING (auth.uid() = creator_id);

CREATE POLICY "Creators can delete their own clients"
ON public.clients FOR DELETE
TO authenticated
USING (auth.uid() = creator_id);

-- Create reviews table
CREATE TABLE public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  client_name TEXT NOT NULL,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id)
);

-- Enable RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reviews
CREATE POLICY "Anyone can view public reviews"
ON public.reviews FOR SELECT
USING (is_public = true);

CREATE POLICY "Creators can view all their reviews"
ON public.reviews FOR SELECT
TO authenticated
USING (auth.uid() = creator_id);

CREATE POLICY "Anyone can insert reviews"
ON public.reviews FOR INSERT
WITH CHECK (true);

CREATE POLICY "Creators can update their own reviews"
ON public.reviews FOR UPDATE
TO authenticated
USING (auth.uid() = creator_id);

-- Create notifications_sent table to track sent emails
CREATE TABLE public.notifications_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('reminder_24h', 'reminder_2h', 'followup', 'review_request')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(booking_id, notification_type)
);

-- Enable RLS
ALTER TABLE public.notifications_sent ENABLE ROW LEVEL SECURITY;

-- RLS Policies for notifications_sent
CREATE POLICY "Service can manage notifications"
ON public.notifications_sent FOR ALL
USING (true)
WITH CHECK (true);

-- Create function to update clients when booking is paid
CREATE OR REPLACE FUNCTION update_client_from_booking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only process when status changes to confirmed and payment is paid
  IF NEW.status = 'confirmed' AND NEW.payment_status = 'paid' THEN
    -- Insert or update client
    INSERT INTO clients (
      creator_id,
      email,
      name,
      phone,
      first_booking_date,
      last_booking_date,
      total_bookings,
      total_spent
    )
    VALUES (
      NEW.creator_id,
      NEW.client_email,
      NEW.client_name,
      NEW.client_phone,
      NEW.booking_date,
      NEW.booking_date,
      1,
      NEW.price_at_booking
    )
    ON CONFLICT (creator_id, email)
    DO UPDATE SET
      last_booking_date = NEW.booking_date,
      total_bookings = clients.total_bookings + 1,
      total_spent = clients.total_spent + NEW.price_at_booking,
      phone = COALESCE(NULLIF(NEW.client_phone, ''), clients.phone),
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for auto-updating clients
CREATE TRIGGER update_client_on_booking_paid
AFTER UPDATE ON bookings
FOR EACH ROW
WHEN (NEW.status = 'confirmed' AND NEW.payment_status = 'paid')
EXECUTE FUNCTION update_client_from_booking();

-- Create indexes for performance
CREATE INDEX idx_clients_creator_id ON clients(creator_id);
CREATE INDEX idx_clients_email ON clients(email);
CREATE INDEX idx_reviews_creator_id ON reviews(creator_id);
CREATE INDEX idx_reviews_booking_id ON reviews(booking_id);
CREATE INDEX idx_reviews_public ON reviews(is_public) WHERE is_public = true;
CREATE INDEX idx_notifications_booking_id ON notifications_sent(booking_id);
CREATE INDEX idx_bookings_date_status ON bookings(booking_date, status) WHERE status IN ('confirmed', 'completed');