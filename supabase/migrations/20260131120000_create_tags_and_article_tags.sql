/*
  # Create Tags and Article Tags Tables

  1. New Tables
    - `tags`
      - `id` (uuid, primary key)
      - `name` (text)
      - `parent_id` (uuid, nullable, self-referencing)
      - `user_id` (uuid, references auth.users)
      - `created_at` (timestamptz)
    - `article_tags`
      - `id` (uuid, primary key)
      - `article_id` (uuid, references articles)
      - `tag_id` (uuid, references tags)
      - `user_id` (uuid, references auth.users)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Policies restrict rows to the owning user
*/

CREATE TABLE IF NOT EXISTS tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  parent_id uuid REFERENCES tags(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, parent_id, name)
);

CREATE TABLE IF NOT EXISTS article_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id uuid NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, article_id, tag_id)
);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own tags" ON tags;
DROP POLICY IF EXISTS "Users can insert own tags" ON tags;
DROP POLICY IF EXISTS "Users can update own tags" ON tags;
DROP POLICY IF EXISTS "Users can delete own tags" ON tags;

CREATE POLICY "Users can view own tags"
  ON tags FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tags"
  ON tags FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tags"
  ON tags FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own tags"
  ON tags FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own article_tags" ON article_tags;
DROP POLICY IF EXISTS "Users can insert own article_tags" ON article_tags;
DROP POLICY IF EXISTS "Users can delete own article_tags" ON article_tags;

CREATE POLICY "Users can view own article_tags"
  ON article_tags FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own article_tags"
  ON article_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM articles
      WHERE articles.id = article_tags.article_id
        AND articles.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM tags
      WHERE tags.id = article_tags.tag_id
        AND tags.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own article_tags"
  ON article_tags FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
