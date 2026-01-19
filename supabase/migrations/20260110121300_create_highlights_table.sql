/*
  # Create Highlights Table

  1. New Tables
    - `highlights`
      - `id` (uuid, primary key) - Unique identifier
      - `card_id` (uuid, foreign key) - Reference to the card
      - `text` (text) - The highlighted text
      - `start_offset` (int) - Start position in card content
      - `end_offset` (int) - End position in card content
      - `style` (text) - Highlight style (highlight, underline, bold)
      - `color` (text) - Color for highlight style
      - `created_at` (timestamp) - When highlight was created

  2. Security
    - Enable RLS on `highlights` table
    - Add policy for public read/write/delete access (single-user mode)
*/

CREATE TABLE IF NOT EXISTS highlights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  text text NOT NULL,
  start_offset int NOT NULL,
  end_offset int NOT NULL,
  style text NOT NULL DEFAULT 'highlight',
  color text DEFAULT '#fef08a',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS highlights_card_id_idx ON highlights(card_id);

ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on highlights"
  ON highlights
  FOR SELECT
  TO anon
  USING (created_at IS NOT NULL);

CREATE POLICY "Allow public insert on highlights"
  ON highlights
  FOR INSERT
  TO anon
  WITH CHECK (card_id IS NOT NULL);

CREATE POLICY "Allow public delete on highlights"
  ON highlights
  FOR DELETE
  TO anon
  USING (created_at IS NOT NULL);