BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(17);

INSERT INTO auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
) VALUES
  (
    '00000000-0000-0000-0000-0000000000a1',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'markdown-reader-a@example.com',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-0000000000a2',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'markdown-reader-b@example.com',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  );

SELECT has_table(
  'public',
  'markdown_reader_books',
  'books table exists'
);
SELECT has_table(
  'public',
  'markdown_reader_chapters',
  'chapters table exists'
);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

INSERT INTO public.markdown_reader_books (id, title)
VALUES ('00000000-0000-0000-0000-0000000000b1', 'User A book');

INSERT INTO public.markdown_reader_chapters (
  id,
  book_id,
  title,
  content_markdown,
  source_filename,
  content_checksum,
  position
) VALUES
  (
    '00000000-0000-0000-0000-0000000000c1',
    '00000000-0000-0000-0000-0000000000b1',
    'Chapter one',
    '# One',
    'one.md',
    'checksum-one',
    0
  ),
  (
    '00000000-0000-0000-0000-0000000000c2',
    '00000000-0000-0000-0000-0000000000b1',
    'Chapter two',
    '# Two',
    'two.md',
    'checksum-two',
    1
  );

INSERT INTO public.markdown_reader_progress (
  chapter_id,
  anchor_block_id,
  anchor_offset,
  scroll_ratio
) VALUES (
  '00000000-0000-0000-0000-0000000000c1',
  'block-one',
  0,
  0.5
);

INSERT INTO public.markdown_reader_annotations (
  id,
  chapter_id,
  exact_text,
  prefix_text,
  suffix_text,
  start_offset,
  end_offset,
  color,
  note_text
) VALUES (
  '00000000-0000-0000-0000-0000000000e1',
  '00000000-0000-0000-0000-0000000000c1',
  'One',
  '# ',
  '',
  2,
  5,
  'yellow',
  'Private note A'
);

INSERT INTO public.markdown_reader_chat_threads (
  id,
  chapter_id,
  annotation_id,
  context_mode,
  context_snapshot,
  title
) VALUES (
  '00000000-0000-0000-0000-0000000000d1',
  '00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-0000000000e1',
  'before_selection',
  '# One',
  'Private thread A'
);

INSERT INTO public.markdown_reader_chat_messages (
  id,
  thread_id,
  role,
  content,
  sequence,
  status,
  client_request_id
) VALUES
  (
    '00000000-0000-0000-0000-0000000000f1',
    '00000000-0000-0000-0000-0000000000d1',
    'user',
    'Question A',
    0,
    'complete',
    '00000000-0000-0000-0000-000000000011'
  ),
  (
    '00000000-0000-0000-0000-0000000000f2',
    '00000000-0000-0000-0000-0000000000d1',
    'assistant',
    'Answer A',
    1,
    'complete',
    '00000000-0000-0000-0000-000000000011'
  );

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);

INSERT INTO public.markdown_reader_books (id, title)
VALUES ('00000000-0000-0000-0000-0000000000b2', 'User B book');

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

SELECT is(
  (SELECT count(*) FROM public.markdown_reader_books),
  1::bigint,
  'user A sees only their own book'
);
SELECT is(
  (SELECT count(*) FROM public.markdown_reader_annotations),
  1::bigint,
  'user A sees only their own annotations'
);
SELECT is(
  (SELECT count(*) FROM public.markdown_reader_chat_threads),
  1::bigint,
  'user A sees only their own chat threads'
);

SELECT throws_ok(
  $$ SELECT public.markdown_reader_reorder_chapters(
    '00000000-0000-0000-0000-0000000000b1',
    ARRAY[
      '00000000-0000-0000-0000-0000000000c1'::uuid,
      '00000000-0000-0000-0000-0000000000c1'::uuid
    ]
  ) $$,
  '22023',
  NULL,
  'reorder rejects duplicate chapter ids'
);
SELECT throws_ok(
  $$ SELECT public.markdown_reader_reorder_chapters(
    '00000000-0000-0000-0000-0000000000b1',
    ARRAY['00000000-0000-0000-0000-0000000000c1'::uuid]
  ) $$,
  '22023',
  NULL,
  'reorder rejects an incomplete chapter set'
);
SELECT lives_ok(
  $$ SELECT public.markdown_reader_reorder_chapters(
    '00000000-0000-0000-0000-0000000000b1',
    ARRAY[
      '00000000-0000-0000-0000-0000000000c2'::uuid,
      '00000000-0000-0000-0000-0000000000c1'::uuid
    ]
  ) $$,
  'owner can reorder every chapter atomically'
);
SELECT results_eq(
  $$ SELECT id, position
     FROM public.markdown_reader_chapters
     WHERE book_id = '00000000-0000-0000-0000-0000000000b1'
     ORDER BY position $$,
  $$ VALUES
     ('00000000-0000-0000-0000-0000000000c2'::uuid, 0),
     ('00000000-0000-0000-0000-0000000000c1'::uuid, 1) $$,
  'reorder assigns the complete requested order'
);

SELECT throws_ok(
  $$ INSERT INTO public.markdown_reader_progress (
       chapter_id,
       anchor_block_id,
       anchor_offset,
       scroll_ratio
     ) VALUES (
       '00000000-0000-0000-0000-0000000000c1',
       'duplicate',
       0,
       0.5
     ) $$,
  '23505',
  NULL,
  'one progress row exists per user and chapter'
);
SELECT throws_ok(
  $$ INSERT INTO public.markdown_reader_chapters (
       book_id,
       user_id,
       title,
       content_markdown,
       source_filename,
       content_checksum,
       position
     ) VALUES (
       '00000000-0000-0000-0000-0000000000b2',
       '00000000-0000-0000-0000-0000000000a1',
       'Forbidden chapter',
       '# Forbidden',
       'forbidden.md',
       'forbidden',
       0
     ) $$,
  '42501',
  NULL,
  'user A cannot write a chapter into user B book'
);
SELECT throws_ok(
  $$ INSERT INTO public.markdown_reader_books (user_id, title)
     VALUES ('00000000-0000-0000-0000-0000000000a2', 'Forged owner') $$,
  '42501',
  NULL,
  'user A cannot forge user B ownership'
);
SELECT throws_ok(
  $$ INSERT INTO public.markdown_reader_preferences (last_book_id)
     VALUES ('00000000-0000-0000-0000-0000000000b2') $$,
  '42501',
  NULL,
  'user A cannot point preferences at user B book'
);

SELECT lives_ok(
  $$ DELETE FROM public.markdown_reader_books
     WHERE id = '00000000-0000-0000-0000-0000000000b1' $$,
  'owner can delete their book'
);

RESET ROLE;
SELECT is(
  (
    SELECT count(*)
    FROM public.markdown_reader_chapters
    WHERE book_id = '00000000-0000-0000-0000-0000000000b1'
  ),
  0::bigint,
  'book deletion cascades to its chapters'
);
SELECT is(
  (
    SELECT count(*)
    FROM public.markdown_reader_chat_messages
    WHERE thread_id = '00000000-0000-0000-0000-0000000000d1'
  ),
  0::bigint,
  'book deletion cascades through threads to messages'
);

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT throws_ok(
  $$ SELECT 1 FROM public.markdown_reader_books $$,
  '42501',
  NULL,
  'anonymous users cannot read reader books'
);

SELECT * FROM finish();

ROLLBACK;
