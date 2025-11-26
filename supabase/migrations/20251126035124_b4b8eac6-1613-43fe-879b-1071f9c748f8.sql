-- Add RLS policy for clients to view their own bookings by email
CREATE POLICY "Clients can view their own bookings by email"
ON public.bookings
FOR SELECT
TO authenticated
USING (client_email = auth.email());

-- Drop existing status check constraint
ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

-- Update existing status values to match new enum
UPDATE public.bookings SET status = 'confirmed' WHERE status = 'accepted';
UPDATE public.bookings SET status = 'cancelled' WHERE status = 'declined';

-- Add new constraint with updated status values
ALTER TABLE public.bookings ADD CONSTRAINT bookings_status_check 
  CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed'));