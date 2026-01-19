/*
  # Create Rewards Table

  1. New Tables
    - `rewards`
      - `id` (uuid, primary key) - Unique identifier
      - `article_id` (uuid, foreign key) - Reference to article
      - `milestone` (int) - Milestone percentage (30, 60, 80)
      - `points` (int) - Points earned from this reward
      - `claimed_at` (timestamp) - When reward was claimed

  2. Security
    - Enable RLS on `rewards` table
    - Add policy for public read/write access (single-user mode)
*/

CREATE TABLE IF NOT EXISTS rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  milestone int NOT NULL,
  points int NOT NULL DEFAULT 0,
  claimed_at timestamptz DEFAULT now(),
  UNIQUE(article_id, milestone)
);

ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on rewards"
  ON rewards
  FOR SELECT
  TO anon
  USING (claimed_at IS NOT NULL);

CREATE POLICY "Allow public insert on rewards"
  ON rewards
  FOR INSERT
  TO anon
  WITH CHECK (milestone IN (30, 60, 80));