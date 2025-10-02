-- Add branding fields to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS banner_url TEXT,
ADD COLUMN IF NOT EXISTS background_style TEXT;