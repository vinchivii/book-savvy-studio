-- Add unique constraint to prevent duplicate availability entries per day (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'availability_creator_day_unique'
  ) THEN
    ALTER TABLE public.availability 
    ADD CONSTRAINT availability_creator_day_unique UNIQUE (creator_id, day_of_week);
  END IF;
END $$;

-- Add check constraint to ensure start_time is before end_time (if not exists)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'availability_time_check'
  ) THEN
    ALTER TABLE public.availability 
    ADD CONSTRAINT availability_time_check CHECK (start_time < end_time);
  END IF;
END $$;

-- Create index for faster lookups by creator and active status
CREATE INDEX IF NOT EXISTS idx_availability_creator_active 
ON public.availability(creator_id, is_active) 
WHERE is_active = true;