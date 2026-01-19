/*
  # Create Cards Table

  1. New Tables
    - `cards`
      - `id` (uuid, primary key) - Unique identifier for each card
      - `article_id` (uuid, foreign key) - Reference to parent article
      - `content` (text) - Card content text
      - `sequence_order` (int) - Order of card in article
      - `semantic_label` (text) - Semantic type label (concept, example, etc.)
      - `context_summary` (text) - Summary of surrounding context
      - `created_at` (timestamp) - When the card was created

  2. Security
    - Enable RLS on `cards` table
    - Add policy for public read/write access (single-user mode)
*/

CREATE TABLE IF NOT EXISTS cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  content text NOT NULL,
  sequence_order int NOT NULL DEFAULT 0,
  semantic_label text DEFAULT '',
  context_summary text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cards_article_id_idx ON cards(article_id);
CREATE INDEX IF NOT EXISTS cards_sequence_order_idx ON cards(article_id, sequence_order);

ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on cards"
  ON cards
  FOR SELECT
  TO anon
  USING (created_at IS NOT NULL);

CREATE POLICY "Allow public insert on cards"
  ON cards
  FOR INSERT
  TO anon
  WITH CHECK (content IS NOT NULL);

CREATE POLICY "Allow public delete on cards"
  ON cards
  FOR DELETE
  TO anon
  USING (created_at IS NOT NULL);