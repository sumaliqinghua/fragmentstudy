/*
  # Create Quiz Questions Table

  1. New Tables
    - `quiz_questions`
      - `id` (uuid, primary key)
      - `article_id` (uuid, foreign key)
      - `question` (text)
      - `options` (text[])
      - `correct_index` (int)
      - `explanation` (text)
      - `sequence_order` (int)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS
    - Policies for authenticated users (match article owner)
*/

CREATE TABLE IF NOT EXISTS quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  question text NOT NULL,
  options text[] NOT NULL,
  correct_index int NOT NULL DEFAULT 0,
  explanation text DEFAULT '',
  sequence_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quiz_questions_article_id_idx ON quiz_questions(article_id);
CREATE INDEX IF NOT EXISTS quiz_questions_sequence_order_idx ON quiz_questions(article_id, sequence_order);

ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view quiz of own articles" ON quiz_questions;
DROP POLICY IF EXISTS "Users can insert quiz to own articles" ON quiz_questions;
DROP POLICY IF EXISTS "Users can update quiz of own articles" ON quiz_questions;
DROP POLICY IF EXISTS "Users can delete quiz of own articles" ON quiz_questions;

CREATE POLICY "Users can view quiz of own articles"
  ON quiz_questions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM articles
      WHERE articles.id = quiz_questions.article_id
      AND articles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert quiz to own articles"
  ON quiz_questions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM articles
      WHERE articles.id = quiz_questions.article_id
      AND articles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update quiz of own articles"
  ON quiz_questions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM articles
      WHERE articles.id = quiz_questions.article_id
      AND articles.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM articles
      WHERE articles.id = quiz_questions.article_id
      AND articles.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete quiz of own articles"
  ON quiz_questions FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM articles
      WHERE articles.id = quiz_questions.article_id
      AND articles.user_id = auth.uid()
    )
  );
