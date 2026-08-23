-- Supabase no longer auto-grants table privileges to API roles (see config.toml
-- auto_expose_new_tables). RLS policies alone are not enough; authenticated must
-- receive explicit GRANTs or PostgREST returns 42501 permission denied.

REVOKE ALL ON TABLE
  public.articles,
  public.subjects,
  public.tags,
  public.article_tags,
  public.cards,
  public.learning_progress,
  public.rewards,
  public.bookmarks,
  public.ai_conversations,
  public.highlights,
  public.card_notes,
  public.dialogue_messages,
  public.dialogue_qa,
  public.galgame_messages,
  public.quiz_questions,
  public.article_text_annotations,
  public.article_text_qa
FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.articles,
  public.subjects,
  public.tags,
  public.article_tags,
  public.cards,
  public.learning_progress,
  public.rewards,
  public.bookmarks,
  public.ai_conversations,
  public.highlights,
  public.card_notes,
  public.dialogue_messages,
  public.dialogue_qa,
  public.galgame_messages,
  public.quiz_questions,
  public.article_text_annotations,
  public.article_text_qa
TO authenticated;
