CREATE TABLE IF NOT EXISTS subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subjects"
  ON subjects FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can create own subjects"
  ON subjects FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own subjects"
  ON subjects FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own subjects"
  ON subjects FOR DELETE TO authenticated
  USING (user_id = auth.uid());

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES subjects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS source_url text;

ALTER TABLE articles DROP CONSTRAINT IF EXISTS articles_source_type_check;
ALTER TABLE articles ADD CONSTRAINT articles_source_type_check
  CHECK (source_type IN ('text', 'pdf', 'url', 'ai'));

ALTER TABLE learning_progress
  ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'card';

ALTER TABLE learning_progress DROP CONSTRAINT IF EXISTS learning_progress_mode_check;
ALTER TABLE learning_progress ADD CONSTRAINT learning_progress_mode_check
  CHECK (mode IN ('card', 'dialogue', 'galgame'));

ALTER TABLE learning_progress DROP CONSTRAINT IF EXISTS learning_progress_article_id_key;
ALTER TABLE learning_progress DROP CONSTRAINT IF EXISTS learning_progress_user_article_unique;
ALTER TABLE learning_progress DROP CONSTRAINT IF EXISTS learning_progress_user_article_mode_unique;
ALTER TABLE learning_progress ADD CONSTRAINT learning_progress_user_article_mode_unique
  UNIQUE (user_id, article_id, mode);

CREATE INDEX IF NOT EXISTS idx_articles_subject_id ON articles(subject_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_article_mode ON learning_progress(article_id, mode);
