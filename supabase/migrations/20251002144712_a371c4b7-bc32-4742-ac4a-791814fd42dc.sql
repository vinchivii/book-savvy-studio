-- Add payment_intent_id column to bookings table for future Stripe integration
ALTER TABLE public.bookings ADD COLUMN payment_intent_id TEXT;