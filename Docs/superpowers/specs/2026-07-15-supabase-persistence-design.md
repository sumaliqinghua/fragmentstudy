# Supabase Persistence Design

## Goal

Complete the application's Supabase persistence path without changing its primary learning experience. Authenticated users persist structured learning data and extracted source text in Supabase PostgreSQL. Guests retain the complete product experience, but their data exists only in memory and disappears on refresh, login, or tab closure.

Supabase Storage and domestic object storage are explicitly deferred. Extracted text remains in `articles.original_content` until a later object-storage migration. Original PDF files are not uploaded in this phase.

## Architecture

Pages and components continue to call `dataService`; they do not select a backend directly.

```text
Pages and components
        |
        v
    dataService
      /     \
guest       authenticated
  |              |
  v              v
memory store   Supabase PostgreSQL
```

- Guest operations use an in-process memory store.
- Guest data is never written to localStorage or IndexedDB.
- Authenticated operations use Supabase Auth and PostgreSQL.
- Authentication changes clear all data-service caches.
- Login discards guest data instead of migrating it.
- Logout creates a new, empty guest session.
- An authenticated cloud failure is surfaced to the user and must not silently fall back to guest storage.

## Persisted Data

Authenticated users persist the following data in Supabase:

- subjects and tags;
- article metadata and extracted source text;
- cards and quiz questions;
- dialogue and Galgame messages;
- annotations, highlights, bookmarks, notes, and AI question history;
- mode-specific learning progress and rewards.

The later object-storage phase may move source text and files out of PostgreSQL. Database records should eventually reference provider-neutral fields such as `storage_provider` and `object_key`, but those fields are not required for this phase.

## Authentication Lifecycle

On application startup, the auth provider restores the Supabase session before cloud-backed data is loaded.

On successful login:

1. Clear guest memory.
2. Clear all data-service caches.
3. Switch reads and writes to Supabase.
4. Reload the authenticated user's data.

On logout or session expiry:

1. Clear authenticated caches.
2. Clear any guest memory.
3. Start an empty guest session.

Registration must distinguish between an active session and a sign-up that still requires email confirmation.

## Database Ownership

`articles`, `subjects`, and `tags` are user-owned root records and contain `user_id`. Child records either contain `user_id` or prove ownership through their parent article or card.

Important uniqueness rules include:

- subject names are unique per user;
- tag paths are unique per user and parent;
- progress is unique per user, article, and learning mode;
- bookmarks and notes are unique per user and card;
- rewards are unique per user, article, and milestone.

Article deletion cascades to dependent learning records. Subject deletion leaves articles unclassified rather than deleting them.

## Row-Level Security

All business tables enable RLS.

- Anonymous clients receive no table access.
- Root-record policies compare `auth.uid()` with `user_id`.
- Child-record policies verify ownership through the parent article or card.
- Insert policies use `WITH CHECK` to reject forged ownership.
- Update policies use both `USING` and `WITH CHECK`.
- Delete policies only allow the owner.
- The browser receives only the anonymous client key.
- Service-role keys, database passwords, and future object-storage secrets never use `VITE_*` variables.

A new additive hardening migration will repair policies, constraints, and indexes without rerunning the destructive historical authentication migration. Historical rows with no owner remain inaccessible and are not automatically assigned to a user.

## Failure Behavior

- Missing Supabase URL or anonymous key leaves guest mode available and disables cloud authentication with a clear configuration error.
- Email-confirmation sign-up displays a confirmation state instead of reporting an active login.
- Network failures display a retryable cloud error.
- Expired sessions clear cloud caches and return to an empty guest session.
- RLS failures are reported as authorization failures.
- Missing tables or unapplied migrations are reported explicitly instead of being converted to empty results.
- Failed authenticated writes remain visibly unsaved and are never redirected to guest memory.

## Verification

Verification covers:

- guest data is available during the current session but disappears after a store reset or page reload;
- login and logout clear guest and authenticated caches;
- all migrations apply to an empty local Supabase database;
- database lint passes;
- two authenticated users cannot read, modify, or delete each other's records;
- registration, email-confirmation messaging, login, session restore, and logout work;
- an authenticated user can persist subjects, articles, cards, dialogue, Galgame, quizzes, and progress;
- TypeScript type checking, ESLint, and the production build pass;
- the existing local application completes a browser smoke test.

No new test dependency is required. Guest-memory behavior will use Node's built-in test runner where the installed Node version supports direct TypeScript execution; otherwise it will be verified through a small JavaScript-facing storage core plus the existing type checker.

## Deferred Work

- Supabase Storage buckets;
- Qiniu Kodo or another domestic object-storage provider;
- original PDF cloud backup;
- moving extracted text out of PostgreSQL;
- embedding generation and production RAG;
- migration of historical guest data.
