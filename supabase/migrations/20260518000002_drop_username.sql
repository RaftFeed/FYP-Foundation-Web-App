-- Drop the username field from profiles as requested
ALTER TABLE public.profiles 
DROP COLUMN IF EXISTS username;
