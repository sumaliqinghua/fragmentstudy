ALTER TABLE public.markdown_reader_chapters
  ADD CONSTRAINT markdown_reader_chapters_id_book_user_key
  UNIQUE (id, book_id, user_id);

CREATE TABLE public.markdown_reader_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (
    name = btrim(name)
    AND char_length(name) BETWEEN 1 AND 40
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (book_id, user_id)
    REFERENCES public.markdown_reader_books(id, user_id)
    ON DELETE CASCADE,
  UNIQUE (id, book_id, user_id)
);

CREATE UNIQUE INDEX markdown_reader_tags_book_name_key
  ON public.markdown_reader_tags (book_id, lower(name));
CREATE INDEX markdown_reader_tags_owner_book_idx
  ON public.markdown_reader_tags (user_id, book_id, name);

CREATE TABLE public.markdown_reader_chapter_tags (
  book_id uuid NOT NULL,
  chapter_id uuid NOT NULL,
  tag_id uuid NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (chapter_id, tag_id),
  FOREIGN KEY (book_id, user_id)
    REFERENCES public.markdown_reader_books(id, user_id)
    ON DELETE CASCADE,
  FOREIGN KEY (chapter_id, book_id, user_id)
    REFERENCES public.markdown_reader_chapters(id, book_id, user_id)
    ON DELETE CASCADE,
  FOREIGN KEY (tag_id, book_id, user_id)
    REFERENCES public.markdown_reader_tags(id, book_id, user_id)
    ON DELETE CASCADE
);

CREATE INDEX markdown_reader_chapter_tags_book_tag_idx
  ON public.markdown_reader_chapter_tags (book_id, tag_id, chapter_id);
CREATE INDEX markdown_reader_chapter_tags_owner_idx
  ON public.markdown_reader_chapter_tags (user_id, chapter_id);

CREATE TABLE public.markdown_reader_book_views (
  user_id uuid NOT NULL DEFAULT auth.uid(),
  book_id uuid NOT NULL,
  active_tag_id uuid REFERENCES public.markdown_reader_tags(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, book_id),
  FOREIGN KEY (book_id, user_id)
    REFERENCES public.markdown_reader_books(id, user_id)
    ON DELETE CASCADE
);

ALTER TABLE public.markdown_reader_chat_threads
  ADD COLUMN context_tag_id uuid
    REFERENCES public.markdown_reader_tags(id)
    ON DELETE SET NULL,
  ADD COLUMN context_tag_name text;

ALTER TABLE public.markdown_reader_chat_threads
  DROP CONSTRAINT markdown_reader_chat_threads_context_mode_check;

ALTER TABLE public.markdown_reader_chat_threads
  ADD CONSTRAINT markdown_reader_chat_threads_context_mode_check
  CHECK (
    context_mode IN (
      'full_chapter',
      'before_selection',
      'tag_to_here',
      'tag_all',
      'none'
    )
    AND (
      (
        context_mode IN ('tag_to_here', 'tag_all')
        AND context_tag_name IS NOT NULL
        AND context_tag_name = btrim(context_tag_name)
        AND char_length(context_tag_name) BETWEEN 1 AND 40
      )
      OR (
        context_mode IN ('full_chapter', 'before_selection', 'none')
        AND context_tag_id IS NULL
        AND context_tag_name IS NULL
      )
    )
  );

CREATE INDEX markdown_reader_chat_threads_context_tag_idx
  ON public.markdown_reader_chat_threads (context_tag_id)
  WHERE context_tag_id IS NOT NULL;

CREATE TRIGGER markdown_reader_tags_set_updated_at
  BEFORE UPDATE ON public.markdown_reader_tags
  FOR EACH ROW EXECUTE FUNCTION public.markdown_reader_set_updated_at();

CREATE TRIGGER markdown_reader_book_views_set_updated_at
  BEFORE UPDATE ON public.markdown_reader_book_views
  FOR EACH ROW EXECUTE FUNCTION public.markdown_reader_set_updated_at();

ALTER TABLE public.markdown_reader_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.markdown_reader_chapter_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.markdown_reader_book_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reader tag owner access"
  ON public.markdown_reader_tags
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.markdown_reader_books AS book
      WHERE book.id = book_id
        AND book.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.markdown_reader_books AS book
      WHERE book.id = book_id
        AND book.user_id = auth.uid()
    )
  );

CREATE POLICY "reader chapter tag owner access"
  ON public.markdown_reader_chapter_tags
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.markdown_reader_chapters AS chapter
      WHERE chapter.id = chapter_id
        AND chapter.book_id = book_id
        AND chapter.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.markdown_reader_tags AS tag
      WHERE tag.id = tag_id
        AND tag.book_id = book_id
        AND tag.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.markdown_reader_chapters AS chapter
      WHERE chapter.id = chapter_id
        AND chapter.book_id = book_id
        AND chapter.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1
      FROM public.markdown_reader_tags AS tag
      WHERE tag.id = tag_id
        AND tag.book_id = book_id
        AND tag.user_id = auth.uid()
    )
  );

CREATE POLICY "reader book view owner access"
  ON public.markdown_reader_book_views
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.markdown_reader_books AS book
      WHERE book.id = book_id
        AND book.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.markdown_reader_books AS book
      WHERE book.id = book_id
        AND book.user_id = auth.uid()
    )
    AND (
      active_tag_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.markdown_reader_tags AS tag
        WHERE tag.id = active_tag_id
          AND tag.book_id = book_id
          AND tag.user_id = auth.uid()
      )
    )
  );

DROP POLICY "reader chat thread owner access"
  ON public.markdown_reader_chat_threads;

CREATE POLICY "reader chat thread owner access"
  ON public.markdown_reader_chat_threads
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.markdown_reader_chapters AS chapter
      WHERE chapter.id = chapter_id
        AND chapter.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.markdown_reader_chapters AS chapter
      WHERE chapter.id = chapter_id
        AND chapter.user_id = auth.uid()
    )
    AND (
      annotation_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.markdown_reader_annotations AS annotation
        WHERE annotation.id = annotation_id
          AND annotation.chapter_id = chapter_id
          AND annotation.user_id = auth.uid()
      )
    )
    AND (
      context_tag_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.markdown_reader_tags AS tag
        JOIN public.markdown_reader_chapters AS chapter
          ON chapter.id = chapter_id
         AND chapter.book_id = tag.book_id
         AND chapter.user_id = auth.uid()
        WHERE tag.id = context_tag_id
          AND tag.user_id = auth.uid()
      )
    )
  );

CREATE OR REPLACE FUNCTION public.markdown_reader_update_chapter_tag(
  p_book_id uuid,
  p_chapter_ids uuid[],
  p_tag_id uuid,
  p_assign boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  requested_count integer;
  distinct_count integer;
  matched_count integer;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.markdown_reader_books
    WHERE id = p_book_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Book does not belong to the current user'
      USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.markdown_reader_tags
    WHERE id = p_tag_id
      AND book_id = p_book_id
      AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Tag must belong to the requested book'
      USING ERRCODE = '22023';
  END IF;

  IF p_assign IS NULL THEN
    RAISE EXCEPTION 'Tag assignment action is required'
      USING ERRCODE = '22023';
  END IF;

  requested_count := COALESCE(cardinality(p_chapter_ids), 0);

  IF requested_count = 0 THEN
    RAISE EXCEPTION 'At least one chapter is required'
      USING ERRCODE = '22023';
  END IF;

  SELECT count(DISTINCT chapter_id)
  INTO distinct_count
  FROM unnest(COALESCE(p_chapter_ids, ARRAY[]::uuid[])) AS chapter_id;

  IF distinct_count <> requested_count THEN
    RAISE EXCEPTION 'Chapter selection contains duplicate ids'
      USING ERRCODE = '22023';
  END IF;

  SELECT count(*)
  INTO matched_count
  FROM public.markdown_reader_chapters
  WHERE id = ANY(p_chapter_ids)
    AND book_id = p_book_id
    AND user_id = auth.uid();

  IF matched_count <> requested_count THEN
    RAISE EXCEPTION 'Every chapter must belong to the requested book'
      USING ERRCODE = '22023';
  END IF;

  IF p_assign THEN
    INSERT INTO public.markdown_reader_chapter_tags (
      book_id,
      chapter_id,
      tag_id,
      user_id
    )
    SELECT
      p_book_id,
      requested.chapter_id,
      p_tag_id,
      auth.uid()
    FROM unnest(p_chapter_ids) AS requested(chapter_id)
    ON CONFLICT (chapter_id, tag_id) DO NOTHING;
  ELSE
    DELETE FROM public.markdown_reader_chapter_tags
    WHERE book_id = p_book_id
      AND tag_id = p_tag_id
      AND chapter_id = ANY(p_chapter_ids)
      AND user_id = auth.uid();
  END IF;
END;
$$;

REVOKE ALL ON TABLE
  public.markdown_reader_tags,
  public.markdown_reader_chapter_tags,
  public.markdown_reader_book_views
FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.markdown_reader_tags,
  public.markdown_reader_chapter_tags,
  public.markdown_reader_book_views
TO authenticated;

REVOKE ALL ON FUNCTION
  public.markdown_reader_update_chapter_tag(uuid, uuid[], uuid, boolean)
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION
  public.markdown_reader_update_chapter_tag(uuid, uuid[], uuid, boolean)
TO authenticated;
