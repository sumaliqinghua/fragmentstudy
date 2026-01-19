/*
  # Create Articles Table

  1. New Tables
    - `articles`
      - `id` (uuid, primary key) - Unique identifier for each article
      - `title` (text) - Article title
      - `original_content` (text) - Full original article content
      - `created_at` (timestamp) - When the article was created

  2. Security
    - Enable RLS on `articles` table
    - Add policy for public read/write access (single-user mode)
*/

CREATE TABLE IF NOT EXISTS articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  original_content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on articles"
  ON articles
  FOR SELECT
  TO anon
  USING (created_at IS NOT NULL);

CREATE POLICY "Allow public insert on articles"
  ON articles
  FOR INSERT
  TO anon
  WITH CHECK (title IS NOT NULL AND original_content IS NOT NULL);

CREATE POLICY "Allow public delete on articles"
  ON articles
  FOR DELETE
  TO anon
  USING (created_at IS NOT NULL);