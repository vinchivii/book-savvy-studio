-- Extend bookings table with payment fields
ALTER TABLE public.bookings
ADD COLUMN IF NOT EXISTS price_at_booking numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'usd',
ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

-- Add check constraint for payment_status
ALTER TABLE public.bookings
ADD CONSTRAINT bookings_payment_status_check 
CHECK (payment_status IN ('unpaid', 'pending', 'paid', 'refunded'));

-- Create availability table
CREATE TABLE IF NOT EXISTS public.availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week smallint NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create time_off table
CREATE TABLE IF NOT EXISTS public.time_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_datetime timestamptz NOT NULL,
  end_datetime timestamptz NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_availability_creator_day 
ON public.availability(creator_id, day_of_week);

CREATE INDEX IF NOT EXISTS idx_time_off_creator_datetime 
ON public.time_off(creator_id, start_datetime, end_datetime);

CREATE INDEX IF NOT EXISTS idx_bookings_creator_date_status 
ON public.bookings(creator_id, booking_date, status);

-- Enable RLS on new tables
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_off ENABLE ROW LEVEL SECURITY;

-- RLS policies for availability
CREATE POLICY "Creators can manage their own availability"
ON public.availability
FOR ALL
USING (auth.uid() = creator_id)
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Public can view active availability"
ON public.availability
FOR SELECT
USING (is_active = true);

-- RLS policies for time_off
CREATE POLICY "Creators can manage their own time off"
ON public.time_off
FOR ALL
USING (auth.uid() = creator_id)
WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Public can view time off for scheduling"
ON public.time_off
FOR SELECT
USING (true);

-- Add trigger for availability updated_at
CREATE TRIGGER update_availability_updated_at
BEFORE UPDATE ON public.availability
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment to tables
COMMENT ON TABLE public.availability IS 'Stores creator weekly availability schedules';
COMMENT ON TABLE public.time_off IS 'Stores creator time-off periods';
COMMENT ON COLUMN public.bookings.price_at_booking IS 'Price captured at time of booking';
COMMENT ON COLUMN public.bookings.payment_status IS 'Payment status: unpaid, pending, paid, or refunded';