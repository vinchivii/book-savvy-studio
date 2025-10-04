-- Add role field to profiles table for user role separation
ALTER TABLE public.profiles ADD COLUMN role TEXT NOT NULL DEFAULT 'creator';

-- Add a check constraint to ensure only valid roles
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('creator', 'client'));