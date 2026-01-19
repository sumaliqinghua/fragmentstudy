/*
  # Create card notes table

  1. New Tables
    - `card_notes`
      - `id` (uuid, primary key)
      - `card_id` (uuid, references cards) - The card this note belongs to
      - `content` (text) - Note content
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `card_notes` table
    - Add policies for public access (this app doesn't use auth)

  3. Notes
    - One note per card (upsert pattern)
    - Unique constraint on card_id
*/

CREATE TABLE IF NOT EXISTS card_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid REFERENCES cards(id) ON DELETE CASCADE NOT NULL UNIQUE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE card_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to card notes"
  ON card_notes
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to card notes"
  ON card_notes
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public update to card notes"
  ON card_notes
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow public delete to card notes"
  ON card_notes
  FOR DELETE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_card_notes_card_id ON card_notes(card_id);