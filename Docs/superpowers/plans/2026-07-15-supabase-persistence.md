# Supabase Persistence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete authenticated Supabase persistence with strict RLS while making guest data memory-only and disposable.

**Architecture:** Existing pages keep calling `dataService`. That service routes guests to a module-scoped memory store and authenticated users to Supabase PostgreSQL; authentication transitions reset both guest state and all cached cloud state. A non-destructive migration removes permissive legacy policies and rebuilds ownership checks around articles and cards.

**Tech Stack:** React 18, TypeScript, Vite, `@supabase/supabase-js`, PostgreSQL RLS, Supabase CLI, Node 24 built-in test runner.

---

## Execution Constraint

The current worktree contains user-owned uncommitted changes in the same services and components this plan must modify. Execute in place and preserve those changes. Do not create an isolated worktree, revert files, or commit implementation files that would accidentally include unrelated user work.

## File Map

- Modify `src/services/guestStorage.ts`: replace browser persistence with a clone-safe in-memory store and expose an explicit reset.
- Create `src/services/guestStorage.test.ts`: regression tests for memory-only guest behavior.
- Modify `package.json`: add the dependency-free guest storage test command.
- Modify `src/services/supabase.ts`: validate public configuration while keeping guest mode bootable.
- Modify `src/services/dataService.ts`: add session reset, remove silent schema fallbacks, and repair guest/cloud routing.
- Modify `src/contexts/AuthContext.tsx`: apply session transitions and distinguish email-confirmation registration.
- Modify `src/components/AuthModal.tsx`: show the email-confirmation state and actionable cloud errors.
- Create `supabase/migrations/20260715090000_harden_authenticated_persistence.sql`: replace legacy permissive policies with strict ownership policies.
- Create `supabase/tests/rls_isolation.sql`: executable two-user RLS isolation checks for local Supabase.

### Task 1: Make guest storage memory-only

**Files:**
- Create: `src/services/guestStorage.test.ts`
- Modify: `src/services/guestStorage.ts:27-44`
- Modify: `package.json:7-13`

- [ ] **Step 1: Add the failing guest persistence test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { clearGuestData, createArticle, getArticles } from './guestStorage.ts';

test('guest records live in memory and can be discarded as one session', async () => {
  clearGuestData();
  await createArticle('Temporary', 'Session-only text');
  assert.equal((await getArticles()).length, 1);

  clearGuestData();
  assert.deepEqual(await getArticles(), []);
});

test('guest storage runs without browser localStorage', async () => {
  clearGuestData();
  await createArticle('Node test', 'No browser globals');
  assert.equal((await getArticles())[0]?.title, 'Node test');
});
```

- [ ] **Step 2: Add and run the test command to prove the old implementation fails**

Add to `package.json`:

```json
"test:guest": "node --test src/services/guestStorage.test.ts"
```

Run: `npm run test:guest`

Expected: FAIL with `ReferenceError: localStorage is not defined` or missing `clearGuestData` export.

- [ ] **Step 3: Replace localStorage access with clone-safe module memory**

Replace the persistence helpers in `guestStorage.ts` with:

```ts
const STORAGE_PREFIX = 'guest_';
const memoryStore = new Map<string, unknown>();

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function getItem<T>(key: string): T | null {
  const item = memoryStore.get(key);
  return item === undefined ? null : cloneValue(item as T);
}

function setItem<T>(key: string, value: T): void {
  memoryStore.set(key, cloneValue(value));
}

export function clearGuestData(): void {
  memoryStore.clear();
  if (typeof localStorage === 'undefined') return;
  for (let index = localStorage.length - 1; index >= 0; index -= 1) {
    const key = localStorage.key(index);
    if (key?.startsWith(STORAGE_PREFIX)) localStorage.removeItem(key);
  }
}
```

- [ ] **Step 4: Verify guest tests pass**

Run: `npm run test:guest`

Expected: 2 tests pass and no browser global is required.

### Task 2: Make Supabase configuration and auth transitions explicit

**Files:**
- Modify: `src/services/supabase.ts:1-9`
- Modify: `src/services/dataService.ts:25-170`
- Modify: `src/contexts/AuthContext.tsx:1-76`
- Modify: `src/components/AuthModal.tsx:1-120`

- [ ] **Step 1: Add safe public configuration state**

In `supabase.ts`, export configuration state and keep `createClient` constructible when env values are absent:

```ts
const configuredUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const configuredAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const supabaseConfigError = !configuredUrl || !configuredAnonKey
  ? 'Supabase 未配置，请设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY。'
  : null;
export const isSupabaseConfigured = supabaseConfigError === null;

export const supabase = createClient(
  configuredUrl || 'http://127.0.0.1:54321',
  configuredAnonKey || 'supabase-not-configured',
  { auth: { persistSession: isSupabaseConfigured } }
);
```

- [ ] **Step 2: Add one data-session reset entry point**

After `missingTables` is declared in `dataService.ts`, add:

```ts
export function resetDataServiceState(): void {
  cache.articles = null;
  cache.articlesById.clear();
  cache.tags = null;
  cache.subjects = null;
  cache.articleTagsByArticleId.clear();
  cache.cardsByArticleId.clear();
  cache.progressByArticleId.clear();
  cache.rewardsByArticleId.clear();
  cache.dialogueByArticleId.clear();
  cache.galgameByArticleId.clear();
  cache.quizByArticleId.clear();
  missingTables.clear();
}
```

Guard `getUserId()` with `isSupabaseConfigured` so an unconfigured app remains a guest instead of making a network request.

- [ ] **Step 3: Reset data when the authenticated identity changes**

In `AuthContext.tsx`, import `clearGuestData`, `resetDataServiceState`, and the config exports. Track the active user ID with `useRef<string | null | undefined>` and apply sessions through one callback:

```ts
const activeUserId = useRef<string | null | undefined>(undefined);

const applySession = useCallback((nextSession: Session | null) => {
  const nextUserId = nextSession?.user.id ?? null;
  if (activeUserId.current !== nextUserId) {
    clearGuestData();
    resetDataServiceState();
    activeUserId.current = nextUserId;
  }
  setSession(nextSession);
  setUser(nextSession?.user ?? null);
  setIsLoading(false);
}, []);
```

If Supabase is not configured, initialize an empty guest session without registering an auth listener. Route `getSession()` and `onAuthStateChange()` through `applySession` otherwise.

- [ ] **Step 4: Return email confirmation state from sign-up**

Change the auth contract to:

```ts
signUp: (email: string, password: string) => Promise<{
  error: Error | null;
  requiresEmailConfirmation: boolean;
}>;
```

Return `requiresEmailConfirmation: !error && !data.session`. All auth operations return `supabaseConfigError` without attempting a request when configuration is missing.

- [ ] **Step 5: Render registration confirmation instead of closing the modal**

Add `registrationSent` state in `AuthModal.tsx`. After successful registration, close only when a session exists; otherwise render the existing success treatment with:

```tsx
<h3 className="text-lg font-semibold text-gray-900 mb-2">确认邮件已发送</h3>
<p className="text-gray-600 text-sm">请查收邮箱并完成确认，然后返回登录。</p>
```

- [ ] **Step 6: Run static verification**

Run: `npm run typecheck`

Expected: exit 0 with no TypeScript errors.

### Task 3: Repair guest/cloud routing and schema error behavior

**Files:**
- Modify: `src/services/dataService.ts:160-1308`

- [ ] **Step 1: Add a normalized missing-migration error**

Add:

```ts
function migrationRequired(table: string, cause: unknown): Error {
  return new Error(`Supabase 数据表 ${table} 不存在，请先执行数据库迁移。`, { cause });
}
```

Replace every missing-table branch that returns `[]`, an empty map, or silently returns with `throw migrationRequired(table, error)`. A logged-in client must never interpret an incomplete schema as valid empty data.

- [ ] **Step 2: Restore the guest branch in rewards reads**

At the start of `getRewards` add:

```ts
if (!(await isAuthenticated())) {
  return guestStorage.getRewards(articleId);
}
```

- [ ] **Step 3: Require a user ID for authenticated writes**

Add:

```ts
async function requireUserId(): Promise<string> {
  const userId = await getUserId();
  if (!userId) throw new Error('登录状态已失效，请重新登录。');
  return userId;
}
```

Use it for article, subject, tag, article-tag, progress, reward, bookmark, conversation, highlight, note, dialogue QA, article annotation, and article QA writes so `user_id: null` can never reach Supabase.

- [ ] **Step 4: Verify guest and static checks**

Run:

```bash
npm run test:guest
npm run typecheck
```

Expected: both commands exit 0.

### Task 4: Replace permissive legacy policies with strict RLS

**Files:**
- Create: `supabase/migrations/20260715090000_harden_authenticated_persistence.sql`
- Create: `supabase/tests/rls_isolation.sql`

- [ ] **Step 1: Create ownership helper functions**

The migration creates `public.owns_article(uuid)` and `public.owns_card(uuid)` as `STABLE SECURITY DEFINER` SQL functions with `search_path = public, pg_temp`. Each function returns `false` for anonymous requests and explicitly compares the parent article's `user_id` with `auth.uid()`. Revoke public execution and grant it only to `authenticated`.

```sql
CREATE OR REPLACE FUNCTION public.owns_article(target_article_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.articles article
    WHERE article.id = target_article_id
      AND article.user_id = auth.uid()
  );
$$;

REVOKE ALL ON FUNCTION public.owns_article(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owns_article(uuid) TO authenticated;
```

`owns_card` joins `cards` to `articles` and performs the same owner comparison.

- [ ] **Step 2: Remove every pre-existing policy on business tables**

Use a `DO` block over `pg_policies` for this exact table set:

```sql
articles, subjects, tags, article_tags, cards, learning_progress,
rewards, bookmarks, ai_conversations, highlights, card_notes,
dialogue_messages, dialogue_qa, galgame_messages, quiz_questions,
article_text_annotations, article_text_qa
```

Quote policy and table identifiers with `format('%I', ...)`, then enable RLS on every table. This removes the legacy `USING (true)` Galgame policies as well as older public policies.

- [ ] **Step 3: Add authenticated ownership policies**

Create four-operation policies according to this matrix:

```text
articles, subjects:
  auth.uid() = user_id

tags:
  auth.uid() = user_id
  parent_id is null OR parent tag belongs to auth.uid()

article_tags:
  auth.uid() = user_id
  owns_article(article_id)
  referenced tag belongs to auth.uid()

cards, dialogue_messages, galgame_messages, quiz_questions:
  owns_article(article_id)

learning_progress, rewards, dialogue_qa,
article_text_annotations, article_text_qa:
  auth.uid() = user_id AND owns_article(article_id)

bookmarks, ai_conversations, highlights, card_notes:
  auth.uid() = user_id AND owns_card(card_id)
```

Use `TO authenticated`, `USING` for reads/deletes, `WITH CHECK` for inserts, and both clauses for updates.

- [ ] **Step 4: Add safe ownership defaults and supporting indexes**

Set `DEFAULT auth.uid()` on direct `user_id` columns without forcing historical null rows to become owned. Add indexes for policy joins on all `article_id`, `card_id`, `user_id`, and `tag_id` columns that do not already have one.

- [ ] **Step 5: Add a two-user SQL isolation test**

`supabase/tests/rls_isolation.sql` must run in a transaction, create two temporary `auth.users`, switch to role `authenticated` with each user's `request.jwt.claim.sub`, and verify with pgTAP that user B sees zero rows and cannot update/delete user A's article. Roll back the transaction at the end.

- [ ] **Step 6: Validate locally**

Run:

```bash
supabase start
supabase db reset
supabase db lint
supabase test db supabase/tests/rls_isolation.sql
```

Expected: all migrations apply, lint reports no schema errors, and every pgTAP assertion passes. If Docker is unavailable, record that limitation and continue with SQL review plus remote migration validation.

### Task 5: Apply and exercise the completed persistence path

**Files:**
- Modify only if verification exposes a defect in files listed above.

- [ ] **Step 1: Check remote migration state**

Run: `supabase migration list`

Expected: local and remote history align. If the linked project's temporary database role times out, retry once and then use `SUPABASE_DB_PASSWORD` only if it is already available; never print the password.

- [ ] **Step 2: Push the additive migration**

Run: `supabase db push`

Expected: only unapplied migrations run, including `20260715090000_harden_authenticated_persistence.sql`; no historical data is truncated.

- [ ] **Step 3: Run repository verification**

Run:

```bash
npm run test:guest
npm run typecheck
npm run lint
npm run build
```

Expected: tests, type checking, and build exit 0. ESLint may retain existing hook warnings but must report zero errors.

- [ ] **Step 4: Run browser smoke checks**

Verify at desktop and mobile widths:

1. Guest creates a material and can generate/read it during the current session.
2. Refresh removes that material.
3. Registration requiring confirmation shows the confirmation message.
4. Login loads only cloud data and does not restore guest data.
5. Authenticated creation survives refresh.
6. Logout returns to an empty guest session.
7. A cloud write failure is shown and is not presented as saved.

- [ ] **Step 5: Review the final diff and report remaining risks**

Run `git diff --check` and inspect only files touched by this plan. Do not revert unrelated user changes. Report whether remote RLS isolation and email delivery could be tested with available credentials.
