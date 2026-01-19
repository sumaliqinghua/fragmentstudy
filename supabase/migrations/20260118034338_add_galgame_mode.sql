/*
  # Add Galgame Visual Novel Mode

  1. Description
    - Adds support for a new "galgame" mode in the articles table
    - Creates galgame_messages table to store visual novel style dialogue
    - Each message includes emotion emoji, screen effects, and character positioning

  2. New Tables
    - `galgame_messages`
      - `id` (uuid, primary key)
      - `article_id` (uuid, foreign key to articles)
      - `character_name` (text) - Name of the speaking character
      - `avatar_seed` (text) - Seed for generating avatar color
      - `content` (text) - The dialogue content
      - `sequence_order` (integer) - Order of the message
      - `emotion_emoji` (text, optional) - Emoji to display (e.g., sweat, angry, love)
      - `screen_effect` (text, optional) - Screen effect (shake, flash, pulse, none)
      - `knowledge_point` (text, optional) - Knowledge point annotation
      - `position` (text) - Character position (left, right, center)
      - `created_at` (timestamptz)

  3. Security
    - Enable RLS on galgame_messages table
    - Add policies for authenticated users (currently open for anonymous access during development)
*/

-- Create galgame_messages table
CREATE TABLE IF NOT EXISTS galgame_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  character_name text NOT NULL,
  avatar_seed text NOT NULL,
  content text NOT NULL,
  sequence_order integer NOT NULL DEFAULT 0,
  emotion_emoji text,
  screen_effect text DEFAULT 'none',
  knowledge_point text,
  position text NOT NULL DEFAULT 'left',
  created_at timestamptz DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_galgame_messages_article_id ON galgame_messages(article_id);
CREATE INDEX IF NOT EXISTS idx_galgame_messages_sequence ON galgame_messages(article_id, sequence_order);

-- Enable RLS
ALTER TABLE galgame_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for galgame_messages (allow all operations for now, similar to other tables)
CREATE POLICY "Allow select galgame_messages"
  ON galgame_messages FOR SELECT
  USING (true);

CREATE POLICY "Allow insert galgame_messages"
  ON galgame_messages FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update galgame_messages"
  ON galgame_messages FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow delete galgame_messages"
  ON galgame_messages FOR DELETE
  USING (true);
