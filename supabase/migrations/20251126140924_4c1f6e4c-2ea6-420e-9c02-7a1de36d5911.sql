-- Add is_guest field to bookings table for tracking guest vs authenticated bookings
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS is_guest boolean NOT NULL DEFAULT false;

-- Add comment for clarity
COMMENT ON COLUMN public.bookings.is_guest IS 'Tracks whether booking was made by guest (true) or authenticated user (false)';