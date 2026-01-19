/*
  # Create AI Conversations Table

  1. New Tables
    - `ai_conversations`
      - `id` (uuid, primary key) - Unique identifier
      - `card_id` (uuid, foreign key) - Reference to the card
      - `question_type` (text) - Type of question (story, beginner, connect, custom)
      - `question` (text) - The question asked
      - `answer` (text) - AI's response
      - `created_at` (timestamp) - When conversation was created

  2. Security
    - Enable RLS on `ai_conversations` table
    - Add policy for public read/write access (single-user mode)
*/

CREATE TABLE IF NOT EXISTS ai_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id uuid NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  question_type text NOT NULL DEFAULT 'custom',
  question text NOT NULL,
  answer text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_conversations_card_id_idx ON ai_conversations(card_id);

ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on ai_conversations"
  ON ai_conversations
  FOR SELECT
  TO anon
  USING (created_at IS NOT NULL);

CREATE POLICY "Allow public insert on ai_conversations"
  ON ai_conversations
  FOR INSERT
  TO anon
  WITH CHECK (card_id IS NOT NULL);