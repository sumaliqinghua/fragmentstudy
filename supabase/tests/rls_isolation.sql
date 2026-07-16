BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(6);

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
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rls-a@example.com',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'rls-b@example.com',
    '',
    now(),
    '{}',
    '{}',
    now(),
    now()
  );

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

INSERT INTO public.articles (id, user_id, title, original_content)
VALUES (
  '30000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  'User A article',
  'Private source text'
);

INSERT INTO public.galgame_messages (
  id,
  article_id,
  character_name,
  avatar_seed,
  content,
  sequence_order
) VALUES (
  '40000000-0000-0000-0000-000000000004',
  '30000000-0000-0000-0000-000000000003',
  'A',
  'a',
  'Private message',
  0
);

SELECT set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000002', true);

SELECT is_empty(
  $$ SELECT 1 FROM public.articles WHERE id = '30000000-0000-0000-0000-000000000003' $$,
  'user B cannot read user A article'
);

UPDATE public.articles
SET title = 'Changed by B'
WHERE id = '30000000-0000-0000-0000-000000000003';

DELETE FROM public.articles
WHERE id = '30000000-0000-0000-0000-000000000003';

SELECT throws_ok(
  $$
    INSERT INTO public.articles (user_id, title, original_content)
    VALUES (
      '10000000-0000-0000-0000-000000000001',
      'Forged owner',
      'Should fail'
    )
  $$,
  '42501',
  NULL,
  'user B cannot forge user A ownership'
);

SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

SELECT is(
  (SELECT title FROM public.articles WHERE id = '30000000-0000-0000-0000-000000000003'),
  'User A article',
  'user B cannot update user A article'
);

SELECT is(
  (SELECT count(*)::integer FROM public.articles WHERE id = '30000000-0000-0000-0000-000000000003'),
  1,
  'user B cannot delete user A article'
);

SELECT is(
  (SELECT count(*)::integer FROM public.galgame_messages WHERE article_id = '30000000-0000-0000-0000-000000000003'),
  1,
  'user A can read own Galgame messages'
);

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);

SELECT is_empty(
  $$ SELECT 1 FROM public.galgame_messages WHERE id = '40000000-0000-0000-0000-000000000004' $$,
  'anonymous users cannot read Galgame messages'
);

SELECT * FROM finish();

ROLLBACK;
