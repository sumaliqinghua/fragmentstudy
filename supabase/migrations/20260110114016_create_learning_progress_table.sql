/*
  # Create Learning Progress Table

  1. New Tables
    - `learning_progress`
      - `id` (uuid, primary key) - Unique identifier
      - `article_id` (uuid, foreign key) - Reference to article
      - `current_index` (int) - Current card index user is on
      - `completed_count` (int) - Number of cards completed
      - `total_count` (int) - Total number of cards
      - `last_read_at` (timestamp) - Last reading timestamp

  2. Security
    - Enable RLS on `learning_progress` table
    - Add policy for public read/write/update access (single-user mode)
*/

CREATE TABLE IF NOT EXISTS learning_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  current_index int NOT NULL DEFAULT 0,
  completed_count int NOT NULL DEFAULT 0,
  total_count int NOT NULL DEFAULT 0,
  last_read_at timestamptz DEFAULT now(),
  UNIQUE(article_id)
);

ALTER TABLE learning_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on learning_progress"
  ON learning_progress
  FOR SELECT
  TO anon
  USING (last_read_at IS NOT NULL);

CREATE POLICY "Allow public insert on learning_progress"
  ON learning_progress
  FOR INSERT
  TO anon
  WITH CHECK (article_id IS NOT NULL);

CREATE POLICY "Allow public update on learning_progress"
  ON learning_progress
  FOR UPDATE
  TO anon
  USING (last_read_at IS NOT NULL)
  WITH CHECK (article_id IS NOT NULL);