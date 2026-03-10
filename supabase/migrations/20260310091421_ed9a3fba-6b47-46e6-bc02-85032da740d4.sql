
-- Add quality_mode to projects for tracking which preset was used
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS quality_mode text NOT NULL DEFAULT 'balanced';

-- Add continuity_profile JSONB to projects for persistent continuity data
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS continuity_profile jsonb DEFAULT NULL;

-- Add narration and audio columns to scenes
ALTER TABLE public.scenes ADD COLUMN IF NOT EXISTS narration_text text DEFAULT '';
ALTER TABLE public.scenes ADD COLUMN IF NOT EXISTS sound_fx_notes text DEFAULT '';
ALTER TABLE public.scenes ADD COLUMN IF NOT EXISTS ambience_notes text DEFAULT '';
ALTER TABLE public.scenes ADD COLUMN IF NOT EXISTS narration_audio_url text DEFAULT NULL;

-- Add generation metadata to transitions
ALTER TABLE public.transitions ADD COLUMN IF NOT EXISTS provider_mode text DEFAULT 'guided_start_frame';
ALTER TABLE public.transitions ADD COLUMN IF NOT EXISTS video_model text DEFAULT '';

-- Add audio columns to projects for overall audio direction
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS voiceover_script text DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS music_direction text DEFAULT '';

-- Add model tracking to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS planning_model text DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS image_model text DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS video_model text DEFAULT '';
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS voice_model text DEFAULT '';
