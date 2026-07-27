BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(15);

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
    'markdown-tags-a@example.com',
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
    'markdown-tags-b@example.com',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  );

SELECT has_table('public', 'markdown_reader_tags', 'tag table exists');
SELECT has_table('public', 'markdown_reader_chapter_tags', 'chapter tag table exists');
SELECT has_table('public', 'markdown_reader_book_views', 'book view table exists');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

INSERT INTO public.markdown_reader_books (id, title)
VALUES
  ('00000000-0000-0000-0000-0000000000b1', 'User A first book'),
  ('00000000-0000-0000-0000-0000000000b2', 'User A second book');

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
    'First tagged chapter',
    '# First',
    'first.md',
    'first-checksum',
    0
  ),
  (
    '00000000-0000-0000-0000-0000000000c2',
    '00000000-0000-0000-0000-0000000000b2',
    'Other book chapter',
    '# Other',
    'other.md',
    'other-checksum',
    0
  ),
  (
    '00000000-0000-0000-0000-0000000000c3',
    '00000000-0000-0000-0000-0000000000b1',
    'Second tagged chapter',
    '# Second',
    'second.md',
    'second-checksum',
    1
  );

INSERT INTO public.markdown_reader_tags (id, book_id, name)
VALUES (
  '00000000-0000-0000-0000-0000000000d1',
  '00000000-0000-0000-0000-0000000000b1',
  'Tech'
);

SELECT throws_ok(
  $$ INSERT INTO public.markdown_reader_tags (book_id, name)
     VALUES ('00000000-0000-0000-0000-0000000000b1', 'tech') $$,
  '23505',
  NULL,
  'tag names are unique per book after case folding'
);

SELECT lives_ok(
  $$ SELECT public.markdown_reader_update_chapter_tag(
    '00000000-0000-0000-0000-0000000000b1',
    ARRAY[
      '00000000-0000-0000-0000-0000000000c1'::uuid,
      '00000000-0000-0000-0000-0000000000c3'::uuid
    ],
    '00000000-0000-0000-0000-0000000000d1',
    true
  ) $$,
  'owner can assign a same-book tag atomically'
);

SELECT is(
  (SELECT count(*) FROM public.markdown_reader_chapter_tags),
  2::bigint,
  'batch assignment creates one relationship per selected chapter'
);

SELECT throws_ok(
  $$ SELECT public.markdown_reader_update_chapter_tag(
    '00000000-0000-0000-0000-0000000000b1',
    ARRAY['00000000-0000-0000-0000-0000000000c2'::uuid],
    '00000000-0000-0000-0000-0000000000d1',
    true
  ) $$,
  '22023',
  NULL,
  'cross-book chapter assignment is rejected'
);

SELECT throws_ok(
  $$ SELECT public.markdown_reader_update_chapter_tag(
    '00000000-0000-0000-0000-0000000000b1',
    ARRAY[
      '00000000-0000-0000-0000-0000000000c1'::uuid,
      '00000000-0000-0000-0000-0000000000c1'::uuid
    ],
    '00000000-0000-0000-0000-0000000000d1',
    true
  ) $$,
  '22023',
  NULL,
  'duplicate chapter ids are rejected'
);

SELECT throws_ok(
  $$ SELECT public.markdown_reader_update_chapter_tag(
    '00000000-0000-0000-0000-0000000000b1',
    ARRAY[]::uuid[],
    '00000000-0000-0000-0000-0000000000d1',
    true
  ) $$,
  '22023',
  NULL,
  'empty chapter selection is rejected'
);

SELECT lives_ok(
  $$ INSERT INTO public.markdown_reader_chat_threads (
    chapter_id,
    context_mode,
    context_snapshot,
    context_tag_id,
    context_tag_name,
    title
  ) VALUES (
    '00000000-0000-0000-0000-0000000000c1',
    'tag_to_here',
    '{"kind":"chapter_tag_context"}',
    '00000000-0000-0000-0000-0000000000d1',
    'Tech',
    'Tagged context'
  ) $$,
  'tag context can freeze one same-book tag'
);

SELECT throws_ok(
  $$ INSERT INTO public.markdown_reader_chat_threads (
    chapter_id,
    context_mode,
    context_snapshot,
    context_tag_id,
    context_tag_name,
    title
  ) VALUES (
    '00000000-0000-0000-0000-0000000000c1',
    'tag_all',
    '{"kind":"chapter_tag_context"}',
    '00000000-0000-0000-0000-0000000000d1',
    NULL,
    'Missing tag name'
  ) $$,
  '23514',
  NULL,
  'tag context requires a frozen tag name'
);

INSERT INTO public.markdown_reader_book_views (book_id, active_tag_id)
VALUES (
  '00000000-0000-0000-0000-0000000000b1',
  '00000000-0000-0000-0000-0000000000d1'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);

SELECT is(
  (SELECT count(*) FROM public.markdown_reader_tags),
  0::bigint,
  'another user cannot see private tags'
);

SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);

DELETE FROM public.markdown_reader_tags
WHERE id = '00000000-0000-0000-0000-0000000000d1';

SELECT is(
  (SELECT count(*) FROM public.markdown_reader_chapter_tags),
  0::bigint,
  'deleting a tag removes chapter relationships'
);

SELECT is(
  (
    SELECT active_tag_id
    FROM public.markdown_reader_book_views
    WHERE book_id = '00000000-0000-0000-0000-0000000000b1'
  ),
  NULL::uuid,
  'deleting a tag clears the saved reading scope'
);

SELECT is(
  (SELECT count(*) FROM public.markdown_reader_chapters),
  3::bigint,
  'deleting a tag keeps every chapter'
);

SELECT * FROM finish();

ROLLBACK;
