/*
  # Add dialogue mode support to articles

  1. Changes to articles table
    - `mode` (text) - Learning mode: 'card' or 'dialogue', defaults to 'card'
    - `characters` (text) - User-provided character names/descriptions for dialogue generation

  2. Notes
    - Existing articles will default to 'card' mode
    - Characters field is optional, only used for dialogue mode
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles' AND column_name = 'mode'
  ) THEN
    ALTER TABLE articles ADD COLUMN mode text DEFAULT 'card';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'articles' AND column_name = 'characters'
  ) THEN
    ALTER TABLE articles ADD COLUMN characters text;
  END IF;
END $$;