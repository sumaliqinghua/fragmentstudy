/*
  # Create Article Text Annotations Table

  1. New Tables
    - `article_text_annotations`
      - `id` (uuid, primary key)
      - `article_id` (uuid, references articles)
      - `user_id` (uuid, references auth.users)
      - `text` (text, the annotated text content)
      - `start_offset` (int, character position where annotation starts)
      - `end_offset` (int, character position where annotation ends)
      - `style` (text, one of: highlight, underline, bold)
      - `color` (text, hex color code)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `article_text_annotations` table
    - Add policies for authenticated users to manage their own annotations

  3. Purpose
    - Stores annotations (highlighter, underline, bold) made directly on original article text
    - Separate from card-level highlights, these are article-level annotations
*/

CREATE TABLE IF NOT EXISTS article_text_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  text text NOT NULL,
  start_offset int NOT NULL,
  end_offset int NOT NULL,
  style text NOT NULL DEFAULT 'highlight',
  color text DEFAULT '#fef08a',
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_style CHECK (style IN ('highlight', 'underline', 'bold')),
  CONSTRAINT valid_offset CHECK (start_offset >= 0 AND end_offset > start_offset)
);

CREATE INDEX IF NOT EXISTS article_text_annotations_article_id_idx ON article_text_annotations(article_id);
CREATE INDEX IF NOT EXISTS article_text_annotations_user_id_idx ON article_text_annotations(user_id);

ALTER TABLE article_text_annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own article text annotations"
  ON article_text_annotations
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own article text annotations"
  ON article_text_annotations
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own article text annotations"
  ON article_text_annotations
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
