/*
  # Create dialogue Q&A table for side panel conversations

  1. New Tables
    - `dialogue_qa`
      - `id` (uuid, primary key)
      - `message_id` (uuid, references dialogue_messages) - The message user long-pressed
      - `article_id` (uuid, references articles)
      - `question` (text) - User's question
      - `answer` (text) - AI's response
      - `context_up_to` (integer) - Sequence order up to which context was included
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `dialogue_qa` table
    - Add policies for public access
*/

CREATE TABLE IF NOT EXISTS dialogue_qa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES dialogue_messages(id) ON DELETE CASCADE NOT NULL,
  article_id uuid REFERENCES articles(id) ON DELETE CASCADE NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  context_up_to integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dialogue_qa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to dialogue qa"
  ON dialogue_qa
  FOR SELECT
  USING (true);

CREATE POLICY "Allow public insert to dialogue qa"
  ON dialogue_qa
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow public delete to dialogue qa"
  ON dialogue_qa
  FOR DELETE
  USING (true);

CREATE INDEX IF NOT EXISTS idx_dialogue_qa_message_id ON dialogue_qa(message_id);
CREATE INDEX IF NOT EXISTS idx_dialogue_qa_article_id ON dialogue_qa(article_id);