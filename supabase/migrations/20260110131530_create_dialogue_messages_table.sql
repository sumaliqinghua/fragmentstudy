/*
  # Create dialogue messages table

  1. New Tables
    - `dialogue_messages`
      - `id` (uuid, primary key)
      - `article_id` (uuid, references articles)
      - `character_name` (text) - Name of the speaking character
      - `avatar_seed` (text) - Seed for generating avatar (character name or custom)
      - `content` (text) - Message content
      - `sequence_order` (integer) - Order of message in conversation
      - `is_right_side` (boolean) - Whether to display on right side (like WeChat self messages)
      - `knowledge_point` (text) - Associated knowledge point summary
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `dialogue_messages` table
    - Add policy for public read access (no auth required for this app)
*/

CREATE TABLE IF NOT EXISTS dialogue_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid REFERENCES articles(id) ON DELETE CASCADE NOT NULL,
  character_name text NOT NULL,
  avatar_seed text NOT NULL,
  content text NOT NULL,
  sequence_order integer NOT NULL,
  is_right_side boolean DEFAULT false,
  knowledge_point text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dialogue_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to dialogue messages"
  ON dialogue_messages
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to dialogue messages"
  ON dialogue_messages
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public delete to dialogue messages"
  ON dialogue_messages
  FOR DELETE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_dialogue_messages_article_id ON dialogue_messages(article_id);
CREATE INDEX IF NOT EXISTS idx_dialogue_messages_sequence ON dialogue_messages(article_id, sequence_order);