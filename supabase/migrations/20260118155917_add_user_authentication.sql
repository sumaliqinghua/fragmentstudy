/*
  # Add User Authentication Support

  ## Summary
  This migration adds user authentication support to the application, allowing data to be 
  associated with specific users. All existing data is cleared to start fresh.

  ## Changes Made

  1. Clear All Existing Data
    - Removes all data from all tables to start fresh with user-scoped data

  2. Add user_id Column to All Tables
    - `articles` - links articles to users
    - `cards` - inherits user association through article
    - `learning_progress` - tracks progress per user
    - `rewards` - tracks rewards per user
    - `bookmarks` - tracks bookmarks per user
    - `ai_conversations` - tracks AI conversations per user
    - `highlights` - tracks highlights per user
    - `card_notes` - tracks notes per user
    - `dialogue_messages` - inherits user association through article
    - `dialogue_qa` - tracks QA per user
    - `galgame_messages` - inherits user association through article

  3. Update RLS Policies
    - All tables now have policies that restrict access to the owning user
    - Users can only see and modify their own data

  ## Security
    - RLS enabled on all tables
    - Policies require authenticated users with matching user_id
*/

-- Step 1: Clear all existing data (order matters due to foreign keys)
TRUNCATE TABLE dialogue_qa CASCADE;
TRUNCATE TABLE dialogue_messages CASCADE;
TRUNCATE TABLE galgame_messages CASCADE;
TRUNCATE TABLE card_notes CASCADE;
TRUNCATE TABLE highlights CASCADE;
TRUNCATE TABLE ai_conversations CASCADE;
TRUNCATE TABLE bookmarks CASCADE;
TRUNCATE TABLE rewards CASCADE;
TRUNCATE TABLE learning_progress CASCADE;
TRUNCATE TABLE cards CASCADE;
TRUNCATE TABLE articles CASCADE;

-- Step 2: Add user_id column to articles table
ALTER TABLE articles ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 3: Add user_id to learning_progress
ALTER TABLE learning_progress ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 4: Add user_id to rewards
ALTER TABLE rewards ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 5: Add user_id to bookmarks
ALTER TABLE bookmarks ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 6: Add user_id to ai_conversations
ALTER TABLE ai_conversations ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 7: Add user_id to highlights
ALTER TABLE highlights ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 8: Add user_id to card_notes
ALTER TABLE card_notes ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 9: Add user_id to dialogue_qa
ALTER TABLE dialogue_qa ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 10: Drop existing RLS policies and create new ones

-- Articles policies
DROP POLICY IF EXISTS "Allow all operations on articles" ON articles;
DROP POLICY IF EXISTS "Users can view own articles" ON articles;
DROP POLICY IF EXISTS "Users can insert own articles" ON articles;
DROP POLICY IF EXISTS "Users can update own articles" ON articles;
DROP POLICY IF EXISTS "Users can delete own articles" ON articles;

CREATE POLICY "Users can view own articles"
  ON articles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own articles"
  ON articles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own articles"
  ON articles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own articles"
  ON articles FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Cards policies (access through article ownership)
DROP POLICY IF EXISTS "Allow all operations on cards" ON cards;
DROP POLICY IF EXISTS "Users can view cards of own articles" ON cards;
DROP POLICY IF EXISTS "Users can insert cards to own articles" ON cards;
DROP POLICY IF EXISTS "Users can update cards of own articles" ON cards;
DROP POLICY IF EXISTS "Users can delete cards of own articles" ON cards;

CREATE POLICY "Users can view cards of own articles"
  ON cards FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM articles WHERE articles.id = cards.article_id AND articles.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert cards to own articles"
  ON cards FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM articles WHERE articles.id = cards.article_id AND articles.user_id = auth.uid()
  ));

CREATE POLICY "Users can update cards of own articles"
  ON cards FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM articles WHERE articles.id = cards.article_id AND articles.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM articles WHERE articles.id = cards.article_id AND articles.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete cards of own articles"
  ON cards FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM articles WHERE articles.id = cards.article_id AND articles.user_id = auth.uid()
  ));

-- Learning progress policies
DROP POLICY IF EXISTS "Allow all operations on learning_progress" ON learning_progress;
DROP POLICY IF EXISTS "Users can view own progress" ON learning_progress;
DROP POLICY IF EXISTS "Users can insert own progress" ON learning_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON learning_progress;
DROP POLICY IF EXISTS "Users can delete own progress" ON learning_progress;

CREATE POLICY "Users can view own progress"
  ON learning_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own progress"
  ON learning_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON learning_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own progress"
  ON learning_progress FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Rewards policies
DROP POLICY IF EXISTS "Allow all operations on rewards" ON rewards;
DROP POLICY IF EXISTS "Users can view own rewards" ON rewards;
DROP POLICY IF EXISTS "Users can insert own rewards" ON rewards;
DROP POLICY IF EXISTS "Users can update own rewards" ON rewards;
DROP POLICY IF EXISTS "Users can delete own rewards" ON rewards;

CREATE POLICY "Users can view own rewards"
  ON rewards FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own rewards"
  ON rewards FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rewards"
  ON rewards FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own rewards"
  ON rewards FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Bookmarks policies
DROP POLICY IF EXISTS "Allow all operations on bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can view own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can insert own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can update own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can delete own bookmarks" ON bookmarks;

CREATE POLICY "Users can view own bookmarks"
  ON bookmarks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own bookmarks"
  ON bookmarks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own bookmarks"
  ON bookmarks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own bookmarks"
  ON bookmarks FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- AI conversations policies
DROP POLICY IF EXISTS "Allow all operations on ai_conversations" ON ai_conversations;
DROP POLICY IF EXISTS "Users can view own conversations" ON ai_conversations;
DROP POLICY IF EXISTS "Users can insert own conversations" ON ai_conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON ai_conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON ai_conversations;

CREATE POLICY "Users can view own conversations"
  ON ai_conversations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversations"
  ON ai_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own conversations"
  ON ai_conversations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversations"
  ON ai_conversations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Highlights policies
DROP POLICY IF EXISTS "Allow all operations on highlights" ON highlights;
DROP POLICY IF EXISTS "Users can view own highlights" ON highlights;
DROP POLICY IF EXISTS "Users can insert own highlights" ON highlights;
DROP POLICY IF EXISTS "Users can update own highlights" ON highlights;
DROP POLICY IF EXISTS "Users can delete own highlights" ON highlights;

CREATE POLICY "Users can view own highlights"
  ON highlights FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own highlights"
  ON highlights FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own highlights"
  ON highlights FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own highlights"
  ON highlights FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Card notes policies
DROP POLICY IF EXISTS "Allow all operations on card_notes" ON card_notes;
DROP POLICY IF EXISTS "Users can view own notes" ON card_notes;
DROP POLICY IF EXISTS "Users can insert own notes" ON card_notes;
DROP POLICY IF EXISTS "Users can update own notes" ON card_notes;
DROP POLICY IF EXISTS "Users can delete own notes" ON card_notes;

CREATE POLICY "Users can view own notes"
  ON card_notes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notes"
  ON card_notes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own notes"
  ON card_notes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own notes"
  ON card_notes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Dialogue messages policies (access through article ownership)
DROP POLICY IF EXISTS "Allow all operations on dialogue_messages" ON dialogue_messages;
DROP POLICY IF EXISTS "Users can view dialogue of own articles" ON dialogue_messages;
DROP POLICY IF EXISTS "Users can insert dialogue to own articles" ON dialogue_messages;
DROP POLICY IF EXISTS "Users can update dialogue of own articles" ON dialogue_messages;
DROP POLICY IF EXISTS "Users can delete dialogue of own articles" ON dialogue_messages;

CREATE POLICY "Users can view dialogue of own articles"
  ON dialogue_messages FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM articles WHERE articles.id = dialogue_messages.article_id AND articles.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert dialogue to own articles"
  ON dialogue_messages FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM articles WHERE articles.id = dialogue_messages.article_id AND articles.user_id = auth.uid()
  ));

CREATE POLICY "Users can update dialogue of own articles"
  ON dialogue_messages FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM articles WHERE articles.id = dialogue_messages.article_id AND articles.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM articles WHERE articles.id = dialogue_messages.article_id AND articles.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete dialogue of own articles"
  ON dialogue_messages FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM articles WHERE articles.id = dialogue_messages.article_id AND articles.user_id = auth.uid()
  ));

-- Dialogue QA policies
DROP POLICY IF EXISTS "Allow all operations on dialogue_qa" ON dialogue_qa;
DROP POLICY IF EXISTS "Users can view own dialogue qa" ON dialogue_qa;
DROP POLICY IF EXISTS "Users can insert own dialogue qa" ON dialogue_qa;
DROP POLICY IF EXISTS "Users can update own dialogue qa" ON dialogue_qa;
DROP POLICY IF EXISTS "Users can delete own dialogue qa" ON dialogue_qa;

CREATE POLICY "Users can view own dialogue qa"
  ON dialogue_qa FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own dialogue qa"
  ON dialogue_qa FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own dialogue qa"
  ON dialogue_qa FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own dialogue qa"
  ON dialogue_qa FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Galgame messages policies (access through article ownership)
DROP POLICY IF EXISTS "Allow all operations on galgame_messages" ON galgame_messages;
DROP POLICY IF EXISTS "Users can view galgame of own articles" ON galgame_messages;
DROP POLICY IF EXISTS "Users can insert galgame to own articles" ON galgame_messages;
DROP POLICY IF EXISTS "Users can update galgame of own articles" ON galgame_messages;
DROP POLICY IF EXISTS "Users can delete galgame of own articles" ON galgame_messages;

CREATE POLICY "Users can view galgame of own articles"
  ON galgame_messages FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM articles WHERE articles.id = galgame_messages.article_id AND articles.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert galgame to own articles"
  ON galgame_messages FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM articles WHERE articles.id = galgame_messages.article_id AND articles.user_id = auth.uid()
  ));

CREATE POLICY "Users can update galgame of own articles"
  ON galgame_messages FOR UPDATE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM articles WHERE articles.id = galgame_messages.article_id AND articles.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM articles WHERE articles.id = galgame_messages.article_id AND articles.user_id = auth.uid()
  ));

CREATE POLICY "Users can delete galgame of own articles"
  ON galgame_messages FOR DELETE
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM articles WHERE articles.id = galgame_messages.article_id AND articles.user_id = auth.uid()
  ));

-- Update unique constraint on learning_progress to include user_id
ALTER TABLE learning_progress DROP CONSTRAINT IF EXISTS learning_progress_article_id_key;
ALTER TABLE learning_progress ADD CONSTRAINT learning_progress_user_article_unique UNIQUE (user_id, article_id);

-- Update unique constraint on rewards to include user_id
ALTER TABLE rewards DROP CONSTRAINT IF EXISTS rewards_article_id_milestone_key;
ALTER TABLE rewards ADD CONSTRAINT rewards_user_article_milestone_unique UNIQUE (user_id, article_id, milestone);

-- Update unique constraint on bookmarks to include user_id
ALTER TABLE bookmarks DROP CONSTRAINT IF EXISTS bookmarks_card_id_key;
ALTER TABLE bookmarks ADD CONSTRAINT bookmarks_user_card_unique UNIQUE (user_id, card_id);

-- Update unique constraint on card_notes to include user_id
ALTER TABLE card_notes DROP CONSTRAINT IF EXISTS card_notes_card_id_key;
ALTER TABLE card_notes ADD CONSTRAINT card_notes_user_card_unique UNIQUE (user_id, card_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_articles_user_id ON articles(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_user_id ON learning_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_rewards_user_id ON rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_id ON ai_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_highlights_user_id ON highlights(user_id);
CREATE INDEX IF NOT EXISTS idx_card_notes_user_id ON card_notes(user_id);
CREATE INDEX IF NOT EXISTS idx_dialogue_qa_user_id ON dialogue_qa(user_id);
