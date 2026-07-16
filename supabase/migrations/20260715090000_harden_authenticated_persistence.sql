-- Replace all legacy public policies with authenticated, owner-scoped access.
-- This migration is intentionally non-destructive: existing rows are preserved.

CREATE OR REPLACE FUNCTION public.owns_article(target_article_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.articles AS article
      WHERE article.id = target_article_id
        AND article.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.owns_card(target_card_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.cards AS card
      JOIN public.articles AS article ON article.id = card.article_id
      WHERE card.id = target_card_id
        AND article.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.owns_subject(target_subject_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.subjects AS subject
      WHERE subject.id = target_subject_id
        AND subject.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.owns_tag(target_tag_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.tags AS tag
      WHERE tag.id = target_tag_id
        AND tag.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION public.owns_dialogue_message(
  target_message_id uuid,
  target_article_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.dialogue_messages AS message
      JOIN public.articles AS article ON article.id = message.article_id
      WHERE message.id = target_message_id
        AND message.article_id = target_article_id
        AND article.user_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.owns_article(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owns_card(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owns_subject(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owns_tag(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.owns_dialogue_message(uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.owns_article(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_card(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_subject(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_tag(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owns_dialogue_message(uuid, uuid) TO authenticated;

DO $$
DECLARE
  policy_record record;
  table_name text;
  business_tables text[] := ARRAY[
    'articles',
    'subjects',
    'tags',
    'article_tags',
    'cards',
    'learning_progress',
    'rewards',
    'bookmarks',
    'ai_conversations',
    'highlights',
    'card_notes',
    'dialogue_messages',
    'dialogue_qa',
    'galgame_messages',
    'quiz_questions',
    'article_text_annotations',
    'article_text_qa'
  ];
BEGIN
  FOREACH table_name IN ARRAY business_tables LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;

  FOR policy_record IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ANY (business_tables)
  LOOP
    EXECUTE format(
      'DROP POLICY %I ON %I.%I',
      policy_record.policyname,
      policy_record.schemaname,
      policy_record.tablename
    );
  END LOOP;
END;
$$;

-- Only future writes receive the active user automatically. Historical null rows stay unowned.
ALTER TABLE public.articles ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.subjects ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.tags ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.article_tags ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.learning_progress ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.rewards ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.bookmarks ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.ai_conversations ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.highlights ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.card_notes ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.dialogue_qa ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.article_text_annotations ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE public.article_text_qa ALTER COLUMN user_id SET DEFAULT auth.uid();

-- Root records.
CREATE POLICY authenticated_select ON public.articles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY authenticated_insert ON public.articles
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (subject_id IS NULL OR public.owns_subject(subject_id))
  );
CREATE POLICY authenticated_update ON public.articles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (subject_id IS NULL OR public.owns_subject(subject_id))
  );
CREATE POLICY authenticated_delete ON public.articles
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY authenticated_select ON public.subjects
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY authenticated_insert ON public.subjects
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY authenticated_update ON public.subjects
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY authenticated_delete ON public.subjects
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Tags may only reference another tag owned by the active user.
CREATE POLICY authenticated_select ON public.tags
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY authenticated_insert ON public.tags
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (parent_id IS NULL OR public.owns_tag(parent_id))
  );
CREATE POLICY authenticated_update ON public.tags
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (parent_id IS NULL OR public.owns_tag(parent_id))
  );
CREATE POLICY authenticated_delete ON public.tags
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY authenticated_select ON public.article_tags
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    AND public.owns_article(article_id)
    AND public.owns_tag(tag_id)
  );
CREATE POLICY authenticated_insert ON public.article_tags
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.owns_article(article_id)
    AND public.owns_tag(tag_id)
  );
CREATE POLICY authenticated_update ON public.article_tags
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND public.owns_article(article_id)
    AND public.owns_tag(tag_id)
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.owns_article(article_id)
    AND public.owns_tag(tag_id)
  );
CREATE POLICY authenticated_delete ON public.article_tags
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    AND public.owns_article(article_id)
    AND public.owns_tag(tag_id)
  );

-- Article-owned generated content.
CREATE POLICY authenticated_select ON public.cards
  FOR SELECT TO authenticated USING (public.owns_article(article_id));
CREATE POLICY authenticated_insert ON public.cards
  FOR INSERT TO authenticated WITH CHECK (public.owns_article(article_id));
CREATE POLICY authenticated_update ON public.cards
  FOR UPDATE TO authenticated
  USING (public.owns_article(article_id))
  WITH CHECK (public.owns_article(article_id));
CREATE POLICY authenticated_delete ON public.cards
  FOR DELETE TO authenticated USING (public.owns_article(article_id));

CREATE POLICY authenticated_select ON public.dialogue_messages
  FOR SELECT TO authenticated USING (public.owns_article(article_id));
CREATE POLICY authenticated_insert ON public.dialogue_messages
  FOR INSERT TO authenticated WITH CHECK (public.owns_article(article_id));
CREATE POLICY authenticated_update ON public.dialogue_messages
  FOR UPDATE TO authenticated
  USING (public.owns_article(article_id))
  WITH CHECK (public.owns_article(article_id));
CREATE POLICY authenticated_delete ON public.dialogue_messages
  FOR DELETE TO authenticated USING (public.owns_article(article_id));

CREATE POLICY authenticated_select ON public.galgame_messages
  FOR SELECT TO authenticated USING (public.owns_article(article_id));
CREATE POLICY authenticated_insert ON public.galgame_messages
  FOR INSERT TO authenticated WITH CHECK (public.owns_article(article_id));
CREATE POLICY authenticated_update ON public.galgame_messages
  FOR UPDATE TO authenticated
  USING (public.owns_article(article_id))
  WITH CHECK (public.owns_article(article_id));
CREATE POLICY authenticated_delete ON public.galgame_messages
  FOR DELETE TO authenticated USING (public.owns_article(article_id));

CREATE POLICY authenticated_select ON public.quiz_questions
  FOR SELECT TO authenticated USING (public.owns_article(article_id));
CREATE POLICY authenticated_insert ON public.quiz_questions
  FOR INSERT TO authenticated WITH CHECK (public.owns_article(article_id));
CREATE POLICY authenticated_update ON public.quiz_questions
  FOR UPDATE TO authenticated
  USING (public.owns_article(article_id))
  WITH CHECK (public.owns_article(article_id));
CREATE POLICY authenticated_delete ON public.quiz_questions
  FOR DELETE TO authenticated USING (public.owns_article(article_id));

-- User-authored records attached directly to an article.
CREATE POLICY authenticated_select ON public.learning_progress
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.owns_article(article_id));
CREATE POLICY authenticated_insert ON public.learning_progress
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.owns_article(article_id));
CREATE POLICY authenticated_update ON public.learning_progress
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.owns_article(article_id))
  WITH CHECK (auth.uid() = user_id AND public.owns_article(article_id));
CREATE POLICY authenticated_delete ON public.learning_progress
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.owns_article(article_id));

CREATE POLICY authenticated_select ON public.rewards
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.owns_article(article_id));
CREATE POLICY authenticated_insert ON public.rewards
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.owns_article(article_id));
CREATE POLICY authenticated_update ON public.rewards
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.owns_article(article_id))
  WITH CHECK (auth.uid() = user_id AND public.owns_article(article_id));
CREATE POLICY authenticated_delete ON public.rewards
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.owns_article(article_id));

CREATE POLICY authenticated_select ON public.dialogue_qa
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    AND public.owns_article(article_id)
    AND public.owns_dialogue_message(message_id, article_id)
  );
CREATE POLICY authenticated_insert ON public.dialogue_qa
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.owns_article(article_id)
    AND public.owns_dialogue_message(message_id, article_id)
  );
CREATE POLICY authenticated_update ON public.dialogue_qa
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    AND public.owns_article(article_id)
    AND public.owns_dialogue_message(message_id, article_id)
  )
  WITH CHECK (
    auth.uid() = user_id
    AND public.owns_article(article_id)
    AND public.owns_dialogue_message(message_id, article_id)
  );
CREATE POLICY authenticated_delete ON public.dialogue_qa
  FOR DELETE TO authenticated
  USING (
    auth.uid() = user_id
    AND public.owns_article(article_id)
    AND public.owns_dialogue_message(message_id, article_id)
  );

CREATE POLICY authenticated_select ON public.article_text_annotations
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.owns_article(article_id));
CREATE POLICY authenticated_insert ON public.article_text_annotations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.owns_article(article_id));
CREATE POLICY authenticated_update ON public.article_text_annotations
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.owns_article(article_id))
  WITH CHECK (auth.uid() = user_id AND public.owns_article(article_id));
CREATE POLICY authenticated_delete ON public.article_text_annotations
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.owns_article(article_id));

CREATE POLICY authenticated_select ON public.article_text_qa
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.owns_article(article_id));
CREATE POLICY authenticated_insert ON public.article_text_qa
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.owns_article(article_id));
CREATE POLICY authenticated_update ON public.article_text_qa
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.owns_article(article_id))
  WITH CHECK (auth.uid() = user_id AND public.owns_article(article_id));
CREATE POLICY authenticated_delete ON public.article_text_qa
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.owns_article(article_id));

-- User-authored records attached to a card.
CREATE POLICY authenticated_select ON public.bookmarks
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.owns_card(card_id));
CREATE POLICY authenticated_insert ON public.bookmarks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.owns_card(card_id));
CREATE POLICY authenticated_update ON public.bookmarks
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.owns_card(card_id))
  WITH CHECK (auth.uid() = user_id AND public.owns_card(card_id));
CREATE POLICY authenticated_delete ON public.bookmarks
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.owns_card(card_id));

CREATE POLICY authenticated_select ON public.ai_conversations
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.owns_card(card_id));
CREATE POLICY authenticated_insert ON public.ai_conversations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.owns_card(card_id));
CREATE POLICY authenticated_update ON public.ai_conversations
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.owns_card(card_id))
  WITH CHECK (auth.uid() = user_id AND public.owns_card(card_id));
CREATE POLICY authenticated_delete ON public.ai_conversations
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.owns_card(card_id));

CREATE POLICY authenticated_select ON public.highlights
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.owns_card(card_id));
CREATE POLICY authenticated_insert ON public.highlights
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.owns_card(card_id));
CREATE POLICY authenticated_update ON public.highlights
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.owns_card(card_id))
  WITH CHECK (auth.uid() = user_id AND public.owns_card(card_id));
CREATE POLICY authenticated_delete ON public.highlights
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.owns_card(card_id));

CREATE POLICY authenticated_select ON public.card_notes
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND public.owns_card(card_id));
CREATE POLICY authenticated_insert ON public.card_notes
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.owns_card(card_id));
CREATE POLICY authenticated_update ON public.card_notes
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND public.owns_card(card_id))
  WITH CHECK (auth.uid() = user_id AND public.owns_card(card_id));
CREATE POLICY authenticated_delete ON public.card_notes
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND public.owns_card(card_id));

-- Policy predicates and common application filters should use indexed foreign keys.
CREATE INDEX IF NOT EXISTS idx_tags_parent_id ON public.tags(parent_id);
CREATE INDEX IF NOT EXISTS idx_article_tags_article_id ON public.article_tags(article_id);
CREATE INDEX IF NOT EXISTS idx_article_tags_tag_id ON public.article_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_rewards_article_id ON public.rewards(article_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_card_id ON public.bookmarks(card_id);
CREATE INDEX IF NOT EXISTS idx_card_notes_card_id ON public.card_notes(card_id);
