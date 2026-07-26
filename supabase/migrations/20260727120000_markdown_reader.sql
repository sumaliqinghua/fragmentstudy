CREATE TABLE public.markdown_reader_books (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  cover_color text NOT NULL DEFAULT 'ink',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, user_id)
);

CREATE TABLE public.markdown_reader_chapters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 240),
  content_markdown text NOT NULL,
  source_filename text NOT NULL CHECK (char_length(btrim(source_filename)) BETWEEN 1 AND 255),
  content_checksum text NOT NULL CHECK (char_length(btrim(content_checksum)) BETWEEN 1 AND 128),
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (book_id, user_id)
    REFERENCES public.markdown_reader_books(id, user_id)
    ON DELETE CASCADE,
  UNIQUE (book_id, position),
  UNIQUE (id, user_id)
);

CREATE TABLE public.markdown_reader_progress (
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  chapter_id uuid NOT NULL,
  anchor_block_id text NOT NULL CHECK (char_length(btrim(anchor_block_id)) > 0),
  anchor_offset integer NOT NULL CHECK (anchor_offset >= 0),
  scroll_ratio double precision NOT NULL CHECK (scroll_ratio BETWEEN 0 AND 1),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, chapter_id),
  FOREIGN KEY (chapter_id, user_id)
    REFERENCES public.markdown_reader_chapters(id, user_id)
    ON DELETE CASCADE
);

CREATE TABLE public.markdown_reader_preferences (
  user_id uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  theme text NOT NULL DEFAULT 'system' CHECK (theme IN ('light', 'dark', 'system')),
  font_scale numeric(4, 2) NOT NULL DEFAULT 1 CHECK (font_scale BETWEEN 0.75 AND 1.5),
  line_height numeric(4, 2) NOT NULL DEFAULT 1.8 CHECK (line_height BETWEEN 1.2 AND 2.4),
  content_width integer NOT NULL DEFAULT 720 CHECK (content_width BETWEEN 480 AND 1000),
  last_book_id uuid REFERENCES public.markdown_reader_books(id) ON DELETE SET NULL,
  last_chapter_id uuid REFERENCES public.markdown_reader_chapters(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.markdown_reader_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  chapter_id uuid NOT NULL,
  exact_text text NOT NULL CHECK (char_length(exact_text) > 0),
  prefix_text text NOT NULL DEFAULT '',
  suffix_text text NOT NULL DEFAULT '',
  start_offset integer NOT NULL CHECK (start_offset >= 0),
  end_offset integer NOT NULL CHECK (end_offset > start_offset),
  color text NOT NULL DEFAULT 'yellow' CHECK (color IN ('yellow', 'red', 'green')),
  note_text text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (chapter_id, user_id)
    REFERENCES public.markdown_reader_chapters(id, user_id)
    ON DELETE CASCADE,
  UNIQUE (id, user_id)
);

CREATE TABLE public.markdown_reader_chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  chapter_id uuid NOT NULL,
  annotation_id uuid REFERENCES public.markdown_reader_annotations(id) ON DELETE SET NULL,
  context_mode text NOT NULL CHECK (context_mode IN ('full_chapter', 'before_selection', 'none')),
  context_snapshot text NOT NULL DEFAULT '',
  title text NOT NULL CHECK (char_length(btrim(title)) BETWEEN 1 AND 160),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (chapter_id, user_id)
    REFERENCES public.markdown_reader_chapters(id, user_id)
    ON DELETE CASCADE,
  UNIQUE (id, user_id)
);

CREATE TABLE public.markdown_reader_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL,
  user_id uuid NOT NULL DEFAULT auth.uid(),
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  sequence integer NOT NULL CHECK (sequence >= 0),
  status text NOT NULL DEFAULT 'complete' CHECK (status IN ('complete', 'interrupted')),
  client_request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (thread_id, user_id)
    REFERENCES public.markdown_reader_chat_threads(id, user_id)
    ON DELETE CASCADE,
  UNIQUE (thread_id, sequence),
  UNIQUE (thread_id, role, client_request_id)
);

CREATE INDEX markdown_reader_books_owner_updated_idx
  ON public.markdown_reader_books (user_id, updated_at DESC);
CREATE INDEX markdown_reader_chapters_book_position_idx
  ON public.markdown_reader_chapters (book_id, position);
CREATE INDEX markdown_reader_chapters_owner_updated_idx
  ON public.markdown_reader_chapters (user_id, updated_at DESC);
CREATE INDEX markdown_reader_progress_chapter_updated_idx
  ON public.markdown_reader_progress (chapter_id, updated_at DESC);
CREATE INDEX markdown_reader_annotations_chapter_updated_idx
  ON public.markdown_reader_annotations (chapter_id, updated_at DESC);
CREATE INDEX markdown_reader_chat_threads_chapter_updated_idx
  ON public.markdown_reader_chat_threads (chapter_id, updated_at DESC);
CREATE INDEX markdown_reader_chat_messages_thread_sequence_idx
  ON public.markdown_reader_chat_messages (thread_id, sequence);

CREATE OR REPLACE FUNCTION public.markdown_reader_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER markdown_reader_books_set_updated_at
  BEFORE UPDATE ON public.markdown_reader_books
  FOR EACH ROW EXECUTE FUNCTION public.markdown_reader_set_updated_at();
CREATE TRIGGER markdown_reader_chapters_set_updated_at
  BEFORE UPDATE ON public.markdown_reader_chapters
  FOR EACH ROW EXECUTE FUNCTION public.markdown_reader_set_updated_at();
CREATE TRIGGER markdown_reader_progress_set_updated_at
  BEFORE UPDATE ON public.markdown_reader_progress
  FOR EACH ROW EXECUTE FUNCTION public.markdown_reader_set_updated_at();
CREATE TRIGGER markdown_reader_preferences_set_updated_at
  BEFORE UPDATE ON public.markdown_reader_preferences
  FOR EACH ROW EXECUTE FUNCTION public.markdown_reader_set_updated_at();
CREATE TRIGGER markdown_reader_annotations_set_updated_at
  BEFORE UPDATE ON public.markdown_reader_annotations
  FOR EACH ROW EXECUTE FUNCTION public.markdown_reader_set_updated_at();
CREATE TRIGGER markdown_reader_chat_threads_set_updated_at
  BEFORE UPDATE ON public.markdown_reader_chat_threads
  FOR EACH ROW EXECUTE FUNCTION public.markdown_reader_set_updated_at();

ALTER TABLE public.markdown_reader_books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.markdown_reader_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.markdown_reader_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.markdown_reader_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.markdown_reader_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.markdown_reader_chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.markdown_reader_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reader book owner access"
  ON public.markdown_reader_books
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "reader chapter owner access"
  ON public.markdown_reader_chapters
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

CREATE POLICY "reader progress owner access"
  ON public.markdown_reader_progress
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
  );

CREATE POLICY "reader preferences owner access"
  ON public.markdown_reader_preferences
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND (
      last_book_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.markdown_reader_books AS book
        WHERE book.id = last_book_id
          AND book.user_id = auth.uid()
      )
    )
    AND (
      last_chapter_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.markdown_reader_chapters AS chapter
        WHERE chapter.id = last_chapter_id
          AND chapter.user_id = auth.uid()
          AND (last_book_id IS NULL OR chapter.book_id = last_book_id)
      )
    )
  );

CREATE POLICY "reader annotation owner access"
  ON public.markdown_reader_annotations
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
  );

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
  );

CREATE POLICY "reader chat message owner access"
  ON public.markdown_reader_chat_messages
  FOR ALL TO authenticated
  USING (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.markdown_reader_chat_threads AS thread
      WHERE thread.id = thread_id
        AND thread.user_id = auth.uid()
    )
  )
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.markdown_reader_chat_threads AS thread
      WHERE thread.id = thread_id
        AND thread.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.markdown_reader_reorder_chapters(
  p_book_id uuid,
  p_ordered_chapter_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  expected_count integer;
  ordered_count integer;
  distinct_count integer;
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

  SELECT count(*)
  INTO expected_count
  FROM public.markdown_reader_chapters
  WHERE book_id = p_book_id;

  ordered_count := COALESCE(cardinality(p_ordered_chapter_ids), 0);

  SELECT count(DISTINCT chapter_id)
  INTO distinct_count
  FROM unnest(COALESCE(p_ordered_chapter_ids, ARRAY[]::uuid[])) AS chapter_id;

  IF ordered_count <> distinct_count THEN
    RAISE EXCEPTION 'Chapter order contains duplicate ids'
      USING ERRCODE = '22023';
  END IF;

  IF ordered_count <> expected_count
     OR EXISTS (
       SELECT 1
       FROM unnest(COALESCE(p_ordered_chapter_ids, ARRAY[]::uuid[])) AS requested(id)
       LEFT JOIN public.markdown_reader_chapters AS chapter
         ON chapter.id = requested.id
        AND chapter.book_id = p_book_id
       WHERE chapter.id IS NULL
     ) THEN
    RAISE EXCEPTION 'Chapter order must contain every chapter in the book exactly once'
      USING ERRCODE = '22023';
  END IF;

  UPDATE public.markdown_reader_chapters AS chapter
  SET position = -requested.ordinality::integer
  FROM unnest(p_ordered_chapter_ids) WITH ORDINALITY AS requested(id, ordinality)
  WHERE chapter.id = requested.id
    AND chapter.book_id = p_book_id;

  UPDATE public.markdown_reader_chapters AS chapter
  SET position = requested.ordinality::integer - 1
  FROM unnest(p_ordered_chapter_ids) WITH ORDINALITY AS requested(id, ordinality)
  WHERE chapter.id = requested.id
    AND chapter.book_id = p_book_id;
END;
$$;

REVOKE ALL ON TABLE
  public.markdown_reader_books,
  public.markdown_reader_chapters,
  public.markdown_reader_progress,
  public.markdown_reader_preferences,
  public.markdown_reader_annotations,
  public.markdown_reader_chat_threads,
  public.markdown_reader_chat_messages
FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  public.markdown_reader_books,
  public.markdown_reader_chapters,
  public.markdown_reader_progress,
  public.markdown_reader_preferences,
  public.markdown_reader_annotations,
  public.markdown_reader_chat_threads,
  public.markdown_reader_chat_messages
TO authenticated;

REVOKE ALL ON FUNCTION public.markdown_reader_set_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.markdown_reader_reorder_chapters(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.markdown_reader_reorder_chapters(uuid, uuid[]) TO authenticated;
