-- Add DELETE policies for bookings, reviews, and profiles tables

-- Allow creators to delete their own bookings
CREATE POLICY "Creators can delete their own bookings"
ON public.bookings
FOR DELETE
USING (auth.uid() = creator_id);

-- Allow creators to delete reviews on their services
CREATE POLICY "Creators can delete their own reviews"
ON public.reviews
FOR DELETE
USING (auth.uid() = creator_id);

-- Allow users to delete their own profile
CREATE POLICY "Users can delete their own profile"
ON public.profiles
FOR DELETE
USING (auth.uid() = id);