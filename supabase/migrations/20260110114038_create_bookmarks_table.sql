/*
  # Create Bookmarks Table

  1. New Tables
    - `bookmarks`
      - `id` (uuid, primary key) - Unique identifier
      - `card_id` (uuid, foreign key) - Reference to bookmarked card
      - `created_at` (timestamp) - When bookmark was created

  2. Security
    - Enable RLS on `bookmarks` table
    - Add policy for public read/write/delete access (single-user mode)
*/

CREATE TABLE IF NOT EXISTS bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(card_id)
);

ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on bookmarks"
  ON bookmarks
  FOR SELECT
  TO anon
  USING (created_at IS NOT NULL);

CREATE POLICY "Allow public insert on bookmarks"
  ON bookmarks
  FOR INSERT
  TO anon
  WITH CHECK (card_id IS NOT NULL);

CREATE POLICY "Allow public delete on bookmarks"
  ON bookmarks
  FOR DELETE
  TO anon
  USING (created_at IS NOT NULL);