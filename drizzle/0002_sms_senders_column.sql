-- 0001 gained this column after some databases had already applied it, and
-- Drizzle never re-runs an applied migration. IF NOT EXISTS keeps fresh
-- databases (which get it from 0001) and older ones in step.
ALTER TABLE "user_preferences" ADD COLUMN IF NOT EXISTS "smsSenders" text[];
