-- Add media_url column to services table
ALTER TABLE public.services ADD COLUMN media_url TEXT;

-- Create storage bucket for service media
INSERT INTO storage.buckets (id, name, public)
VALUES ('service-media', 'service-media', true);

-- Create RLS policies for service media bucket
CREATE POLICY "Anyone can view service media"
ON storage.objects FOR SELECT
USING (bucket_id = 'service-media');

CREATE POLICY "Authenticated users can upload service media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'service-media' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own service media"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'service-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own service media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'service-media' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);