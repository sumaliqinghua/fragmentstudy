/*
  # Create Article Text Q&A Table

  1. New Tables
    - `article_text_qa`
      - `id` (uuid, primary key)
      - `article_id` (uuid, references articles)
      - `user_id` (uuid, references auth.users)
      - `selected_text` (text, the text user selected when asking)
      - `start_offset` (int, character position where selection starts)
      - `end_offset` (int, character position where selection ends)
      - `question` (text, user's question)
      - `answer` (text, AI's response)
      - `include_full_article` (boolean, whether full article was used as context)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `article_text_qa` table
    - Add policies for authenticated users to manage their own Q&A records

  3. Purpose
    - Stores AI Q&A records for selected text in original article view
    - Tracks which text was selected, the question asked, and AI's answer
    - Allows viewing previous Q&A history when clicking marked text
*/

CREATE TABLE IF NOT EXISTS article_text_qa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  selected_text text NOT NULL,
  start_offset int NOT NULL,
  end_offset int NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  include_full_article boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_qa_offset CHECK (start_offset >= 0 AND end_offset > start_offset)
);

CREATE INDEX IF NOT EXISTS article_text_qa_article_id_idx ON article_text_qa(article_id);
CREATE INDEX IF NOT EXISTS article_text_qa_user_id_idx ON article_text_qa(user_id);
CREATE INDEX IF NOT EXISTS article_text_qa_offset_idx ON article_text_qa(article_id, start_offset, end_offset);

ALTER TABLE article_text_qa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own article text qa"
  ON article_text_qa
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own article text qa"
  ON article_text_qa
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own article text qa"
  ON article_text_qa
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
