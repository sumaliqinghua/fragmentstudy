# Supabase Private Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the application's authenticated persistence and platform-managed AI proxy to a single-user Supabase stack reachable only through Tailscale.

**Architecture:** Pin the official Supabase self-hosted release, start only the services the application currently uses, bind raw services to loopback, and expose Kong privately through Tailscale. The browser sends an authenticated user token to `openai-proxy`; the Edge Function owns the Qiniu key and upstream allowlist. Authenticated data lives in PostgreSQL, guest data stays in memory, and encrypted backups are pulled to the Mac mini.

**Tech Stack:** React 18, TypeScript, Vite, Node 24 test runner, Supabase CLI 2.72.7, Supabase self-hosted `v0.7.0`, Docker Compose, Tailscale, PostgreSQL, shell scripts, `age`.

---

## Execution Scope

This plan executes only the approved private-development phase. It does not configure a public domain, Caddy, SMTP, a production AI key, or public rate limiting.

Defaults chosen where implementation details were left open:

- official release: `self-hosted/v0.7.0`;
- private gateway: Kong bound to loopback, exposed with Tailscale Serve when available;
- database ports: loopback only;
- private Auth: email auto-confirm enabled, password-reset UI disabled;
- AI: authenticated users only, Qiniu endpoint and model allowlist controlled by the server;
- backup: Mac-initiated encrypted pull, 14 daily / 8 weekly / 6 monthly retention;
- deployment source: tracked Git commits only;
- public hardening: recorded as a release gate, not silently skipped.

## Existing Worktree Constraint

The current `dev/duo2` worktree contains the completed Supabase persistence implementation and tests as uncommitted changes. Preserve and commit those exact changes first. After the baseline is clean, create `codex/supabase-private-deploy` in a sibling worktree for new implementation. Do not revert or rewrite the existing work.

## File Map

- Modify `package.json`: include shared Edge Function tests.
- Create `src/services/aiConfig.ts`: model-only browser preference and platform availability resolution.
- Create `src/services/aiConfig.test.ts`: platform configuration regression tests.
- Modify `src/services/openai.ts`: one authenticated request path with no client secrets.
- Modify `src/components/SettingsModal.tsx`: replace endpoint/key fields with platform model selection.
- Modify `src/pages/Profile.tsx`: rename the API-key entry to AI model settings.
- Modify AI call sites that still show “configure API Key”: use platform/login wording.
- Create `supabase/functions/_shared/openaiProxySecurity.ts`: token and server configuration validation.
- Create `supabase/functions/_shared/openaiProxySecurity.test.ts`: pure Node tests for proxy boundaries.
- Modify `supabase/functions/openai-proxy/index.ts`: validate the user and use server-owned Qiniu configuration.
- Create `supabase/functions/.env.example`: document function secrets without values.
- Create `src/services/authDeliveryConfig.ts`: resolve whether SMTP-backed flows are enabled.
- Create `src/services/authDeliveryConfig.test.ts`: private Auth behavior tests.
- Modify `src/contexts/AuthContext.tsx`: reject password reset while email delivery is disabled.
- Modify `src/components/AuthModal.tsx`: hide password reset during the private phase.
- Create `infra/supabase/VERSION`: pin the official self-hosted release.
- Create `infra/supabase/docker-compose.private.yml`: loopback-only port overrides.
- Create `infra/supabase/.env.private.example`: non-secret private deployment flags.
- Create `scripts/supabase/bootstrap-host.sh`: install and prepare the pinned official stack on Ubuntu.
- Create `scripts/supabase/sync-project.sh`: copy migrations and functions without printing secrets.
- Create `scripts/supabase/start-private.sh`: start only the approved service set.
- Create `scripts/supabase/apply-migrations.sh`: apply tracked migrations through Supabase CLI.
- Create `scripts/supabase/verify-private.sh`: verify service health and public port isolation.
- Create `scripts/supabase/backup-private.sh`: stream an encrypted logical backup to the Mac.
- Create `infra/supabase/com.fragmentarticle.supabase-backup.plist.example`: macOS backup schedule template.
- Modify `Docs/racknerd-connection.md` or create a repo-local operations guide if the external Docs directory should remain separate.

### Task 1: Make the existing persistence work deployable

**Files:**

- Commit existing modifications in `package.json`, `src/components/AuthModal.tsx`, `src/components/WelcomeModal.tsx`, `src/contexts/AuthContext.tsx`, `src/services/dataService.ts`, `src/services/guestStorage.ts`, and `src/services/supabase.ts`.
- Commit existing additions in `src/services/guestStorage.test.ts`, `src/services/supabaseConfig.test.ts`, `src/services/supabaseConfig.ts`, `supabase/migrations/20260715090000_harden_authenticated_persistence.sql`, and `supabase/tests/rls_isolation.sql`.

- [ ] **Step 1: Re-run the persistence baseline**

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: 5 tests pass; typecheck and build exit 0; lint reports 0 errors and the existing warning count is recorded.

- [ ] **Step 2: Review the exact persistence diff**

Run:

```bash
git diff --check
git diff --stat
git status --short
```

Expected: no whitespace errors and no files outside the persistence scope.

- [ ] **Step 3: Commit the persistence boundary**

Stage only the listed files and create a Lore commit whose intent is to prevent guest/cloud state mixing and cross-user access.

- [ ] **Step 4: Create the isolated implementation worktree**

Run from the repository root:

```bash
git worktree add ../fragmentArticle-supabase-private -b codex/supabase-private-deploy
```

Copy `.env` and `.env.local` into the worktree without adding them to Git, then run `npm install`.

### Task 2: Replace browser API keys with platform AI configuration

**Files:**

- Create: `src/services/aiConfig.test.ts`
- Create: `src/services/aiConfig.ts`
- Modify: `src/services/openai.ts:3-53`
- Modify: `src/components/SettingsModal.tsx:1-132`
- Modify: `src/pages/Profile.tsx:111-124`
- Modify: AI availability messages in `src/components/AIChat.tsx`, `src/components/ArticleInput.tsx`, `src/pages/ArticleHub.tsx`, `src/pages/ReaderPage.tsx`, and `src/components/OriginalTextView.tsx`

- [ ] **Step 1: Add failing platform configuration tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_AI_MODEL,
  loadAIModel,
  resolveAIAvailability,
  saveAIModel,
} from './aiConfig.ts';

test('platform AI availability does not depend on a browser API key', () => {
  assert.equal(resolveAIAvailability('true', false), true);
  assert.equal(resolveAIAvailability(undefined, true), true);
  assert.equal(resolveAIAvailability(undefined, false), false);
});

test('model preferences contain no API endpoint or key', () => {
  const store = new Map<string, string>();
  saveAIModel('qwen/qwen3.7-plus', {
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  });

  assert.equal(loadAIModel({
    getItem: key => store.get(key) ?? null,
    setItem: (key, value) => store.set(key, value),
  }), 'qwen/qwen3.7-plus');
  assert.equal([...store.values()].some(value => /apiKey|apiEndpoint/i.test(value)), false);
  assert.equal(loadAIModel(undefined), DEFAULT_AI_MODEL);
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test src/services/aiConfig.test.ts`

Expected: FAIL because `aiConfig.ts` does not exist.

- [ ] **Step 3: Implement model-only configuration**

Create a focused module with this public API:

```ts
export const DEFAULT_AI_MODEL = 'qwen/qwen3.7-plus';

export interface StringStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function resolveAIAvailability(
  platformFlag: string | undefined,
  localProxyConfigured: boolean
): boolean;
export function loadAIModel(store?: StringStore): string;
export function saveAIModel(model: string, store?: StringStore): void;
```

The implementation stores only `{ "model": "..." }` under a new key and reads the old `openai_config` key only to migrate its model value. It must never persist the old endpoint or key.

- [ ] **Step 4: Verify GREEN**

Run: `node --test src/services/aiConfig.test.ts`

Expected: 2 tests pass.

- [ ] **Step 5: Update the settings UI and availability messages**

`SettingsModal` shows only the approved model menu and a save command. `Profile` labels the entry “AI 模型”. Replace “请先配置 API Key” with either “AI 服务暂未配置” or the authenticated-call error returned by the service.

- [ ] **Step 6: Verify static behavior**

Run:

```bash
npm test
npm run typecheck
npm run lint
```

Expected: tests pass, typecheck exits 0, lint has 0 errors.

### Task 3: Route every AI request through one authenticated client

**Files:**

- Create: `src/services/aiRequest.test.ts`
- Create: `src/services/aiRequest.ts`
- Modify: `src/services/openai.ts`
- Modify: `vite.config.ts:24-50`

- [ ] **Step 1: Add failing request-shape tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPlatformAIRequest } from './aiRequest.ts';

test('platform requests carry the user token and no browser secret', () => {
  const request = buildPlatformAIRequest({
    accessToken: 'user-token',
    model: 'qwen/qwen3.7-plus',
    messages: [{ role: 'user', content: 'hello' }],
    stream: false,
    temperature: 0.7,
  });

  assert.equal(request.headers.Authorization, 'Bearer user-token');
  assert.equal('apiKey' in request.body, false);
  assert.equal('apiEndpoint' in request.body, false);
});
```

- [ ] **Step 2: Verify RED**

Run: `node --test src/services/aiRequest.test.ts`

Expected: FAIL because `aiRequest.ts` does not exist.

- [ ] **Step 3: Implement the pure request builder**

```ts
export function buildPlatformAIRequest(input: PlatformAIRequestInput) {
  return {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.accessToken}`,
    },
    body: {
      model: input.model,
      messages: input.messages,
      stream: input.stream,
      temperature: input.temperature,
      ...(input.responseFormat ? { response_format: input.responseFormat } : {}),
    },
  };
}
```

- [ ] **Step 4: Verify GREEN**

Run: `node --test src/services/aiRequest.test.ts`

Expected: PASS.

- [ ] **Step 5: Centralize authenticated fetches**

`callOpenAI` must:

1. require configured Supabase and platform AI;
2. call `supabase.auth.getSession()`;
3. reject missing sessions with `请先登录后使用 AI 生成功能`;
4. build the request through `buildPlatformAIRequest`;
5. parse consistent JSON errors;
6. serve both streaming and non-streaming callers.

Replace the three duplicated streaming `fetch` blocks with `callOpenAI(..., true)`. Update the local Vite proxy to read `QINIU_API_KEY`, `QINIU_API_ENDPOINT`, and `QINIU_MODEL` exclusively from server-side Vite environment values.

- [ ] **Step 6: Run all client checks**

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: all commands exit 0 except documented lint warnings; the production bundle contains no configured Qiniu key.

### Task 4: Enforce platform ownership in `openai-proxy`

**Files:**

- Create: `supabase/functions/_shared/openaiProxySecurity.test.ts`
- Create: `supabase/functions/_shared/openaiProxySecurity.ts`
- Modify: `supabase/functions/openai-proxy/index.ts`
- Create: `supabase/functions/.env.example`
- Modify: `package.json`

- [ ] **Step 1: Add failing proxy boundary tests**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractBearerToken,
  resolvePlatformAIConfig,
} from './openaiProxySecurity.ts';

test('extractBearerToken rejects anonymous requests', () => {
  assert.throws(() => extractBearerToken(null), /登录/);
  assert.equal(extractBearerToken('Bearer user-token'), 'user-token');
});

test('server configuration rejects unknown models and missing secrets', () => {
  assert.throws(() => resolvePlatformAIConfig({}, 'qwen/qwen3.7-plus'), /未配置/);
  assert.throws(() => resolvePlatformAIConfig({ QINIU_API_KEY: 'secret' }, 'unknown/model'), /不支持/);
  assert.equal(
    resolvePlatformAIConfig({ QINIU_API_KEY: 'secret' }, 'qwen/qwen3.7-plus').apiKey,
    'secret'
  );
});
```

- [ ] **Step 2: Extend the test command and verify RED**

Set:

```json
"test": "node --test src/services/*.test.ts supabase/functions/_shared/*.test.ts"
```

Run: `npm test`

Expected: FAIL because the shared security module does not exist.

- [ ] **Step 3: Implement pure token/config validation**

The module must:

- accept exactly `Bearer <non-empty-token>`;
- require `QINIU_API_KEY`;
- default the endpoint to `https://api.qnaigc.com/v1`;
- allow only the model list displayed by `SettingsModal`;
- normalize the endpoint and prevent client overrides.

- [ ] **Step 4: Verify GREEN**

Run: `npm test`

Expected: all Node tests pass.

- [ ] **Step 5: Update the Edge Function**

The handler must:

1. validate request method and body size;
2. extract the bearer token;
3. call Supabase Auth `getUser(token)` using server environment values;
4. return `401` if the token is invalid;
5. load Qiniu configuration from `Deno.env`;
6. forward only model, messages, stream, temperature, and response format;
7. never read `apiKey` or `apiEndpoint` from the request body;
8. preserve streaming response bodies;
9. return structured `401`, `400`, `502`, and `500` errors without secrets.

Document only variable names in `.env.example`:

```dotenv
QINIU_API_KEY=
QINIU_API_ENDPOINT=https://api.qnaigc.com/v1
QINIU_MODEL=qwen/qwen3.7-plus
SUPABASE_URL=http://kong:8000
SUPABASE_ANON_KEY=
```

- [ ] **Step 6: Verify repository checks**

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: no test, type, lint-error, or build failures.

### Task 5: Make private Auth email behavior truthful

**Files:**

- Create: `src/services/authDeliveryConfig.test.ts`
- Create: `src/services/authDeliveryConfig.ts`
- Modify: `src/contexts/AuthContext.tsx`
- Modify: `src/components/AuthModal.tsx`

- [ ] **Step 1: Add a failing feature-flag test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveEmailDeliveryEnabled } from './authDeliveryConfig.ts';

test('email delivery is disabled unless explicitly enabled', () => {
  assert.equal(resolveEmailDeliveryEnabled(undefined), false);
  assert.equal(resolveEmailDeliveryEnabled('false'), false);
  assert.equal(resolveEmailDeliveryEnabled('true'), true);
});
```

- [ ] **Step 2: Verify RED, implement, and verify GREEN**

Run the test before and after creating:

```ts
export function resolveEmailDeliveryEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === 'true';
}
```

- [ ] **Step 3: Apply private Auth behavior**

Export `emailDeliveryEnabled` from `AuthContext`. When false, `resetPassword` returns `开发阶段暂未开放邮件找回密码`. Hide the “忘记密码？” command and reset mode in `AuthModal`. Registration auto-confirm remains server-controlled; the existing “confirmation sent” state remains available for the later SMTP phase.

- [ ] **Step 4: Verify Auth changes**

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Expected: all tests and static checks pass with only existing lint warnings.

### Task 6: Add reproducible private deployment artifacts

**Files:**

- Create all files under `infra/supabase/` and `scripts/supabase/` listed in the file map.

- [ ] **Step 1: Pin the upstream release**

`infra/supabase/VERSION` contains exactly:

```text
self-hosted/v0.7.0
```

- [ ] **Step 2: Add loopback-only Compose overrides**

Use Compose's `!override` tag so the base public bindings are replaced, not merged:

```yaml
services:
  kong:
    ports: !override
      - "127.0.0.1:${KONG_HTTP_PORT:-8000}:8000/tcp"
  supavisor:
    ports: !override
      - "127.0.0.1:${POSTGRES_PORT:-5432}:5432/tcp"
      - "127.0.0.1:${POOLER_PROXY_PORT_TRANSACTION:-6543}:6543/tcp"
```

Validate with `docker compose config` on the VPS before startup.

- [ ] **Step 3: Add the private service allowlist**

`start-private.sh` starts exactly:

```text
db auth rest meta studio kong functions supavisor
```

It must use both the official base Compose file and `docker-compose.private.yml`, then wait for health. It must never call the official unrestricted `run.sh start`.

- [ ] **Step 4: Add safe bootstrap and sync scripts**

The scripts must use `set -euo pipefail`, accept the remote install directory as an argument, avoid `set -x`, never print `.env`, and refuse a release other than the contents of `VERSION`. The host bootstrap installs Docker from Docker's official Ubuntu repository and checks Compose support for `!override`.

- [ ] **Step 5: Add verification scripts**

`verify-private.sh` must fail unless:

- every approved container is healthy;
- `realtime`, `storage`, `imgproxy`, `analytics`, and `vector` are absent;
- host ports `8000`, `5432`, and `6543` listen only on `127.0.0.1`;
- public-IP requests to those ports fail;
- the Auth health endpoint works through the private gateway.

- [ ] **Step 6: Shell static checks**

Run:

```bash
bash -n scripts/supabase/*.sh
git diff --check
```

Expected: no syntax or whitespace errors.

### Task 7: Commit and verify the local implementation

**Files:** all files changed in Tasks 2-6.

- [ ] **Step 1: Run the full local gate**

```bash
npm test
npm run typecheck
npm run lint
npm run build
bash -n scripts/supabase/*.sh
git diff --check
```

- [ ] **Step 2: Scan the bundle for secrets**

Extract only a short hash of the configured development Qiniu key, then verify neither the key nor its distinctive prefix appears in `dist`. Do not print the key itself.

- [ ] **Step 3: Create focused Lore commits**

Create separate commits for:

1. platform AI client behavior;
2. authenticated Edge proxy behavior;
3. private Auth email behavior;
4. reproducible deployment artifacts.

Each commit records constraints, rejected alternatives, tests, and known gaps.

### Task 8: Bootstrap the RackNerd private stack

**Remote path:** `/opt/fragment-article/supabase`

- [ ] **Step 1: Establish an authenticated SSH session**

Try existing key/agent authentication first. If password authentication is the only available method, pause only for the user to authenticate interactively; never embed or log the password.

- [ ] **Step 2: Record the remote baseline**

Read and save non-secret evidence:

```bash
nproc
free -h
df -h /
timedatectl status
ss -lntp
ufw status
```

- [ ] **Step 3: Install and authenticate Tailscale**

Install from Tailscale's official Ubuntu repository, run `tailscale up`, and give the user the generated browser URL if login is required. Record the assigned Tailscale hostname and IP without storing auth keys.

- [ ] **Step 4: Install Docker and prepare the pinned stack**

Run `bootstrap-host.sh`, confirm Docker and Compose versions, clone the exact release into `/opt/fragment-article/supabase`, and generate secrets with the official scripts. Do not display generated secrets.

- [ ] **Step 5: Configure private URLs and Auth**

Set private values without printing the file:

```dotenv
SUPABASE_PUBLIC_URL=http://127.0.0.1:8000
API_EXTERNAL_URL=http://127.0.0.1:8000/auth/v1
SITE_URL=http://localhost:5174
ADDITIONAL_REDIRECT_URLS=http://localhost:5174/**
ENABLE_EMAIL_AUTOCONFIRM=true
ENABLE_EMAIL_SIGNUP=true
FUNCTIONS_VERIFY_JWT=false
```

Use Tailscale Serve to publish the loopback gateway privately, then update the three URL variables to the resulting tailnet URL if Serve provides HTTPS.

- [ ] **Step 6: Start only approved services**

Run `start-private.sh`, wait for health, and run `verify-private.sh` before applying application migrations.

### Task 9: Apply schema, functions, and private app configuration

- [ ] **Step 1: Sync tracked project artifacts**

Copy `supabase/migrations`, `supabase/tests`, and the two function directories to the VPS. Do not copy local `.env` files.

- [ ] **Step 2: Apply migrations with Supabase CLI**

Install the matching Supabase CLI on the VPS or run it through a loopback SSH tunnel. Use `supabase db push --include-all` so the migration history is recorded. Do not run raw migration files without recording history.

- [ ] **Step 3: Run database verification**

Run database lint and `supabase/tests/rls_isolation.sql`. Confirm all assertions pass before exposing the gateway through Tailscale Serve.

- [ ] **Step 4: Deploy functions and a temporary AI key**

Copy functions into `volumes/functions`, create `.env.functions` with a low-quota temporary key without printing it, recreate the `functions` container, and verify:

- anonymous `openai-proxy` requests return `401`;
- authenticated requests reach the configured Qiniu endpoint;
- `content-extractor` still accepts a public article URL.

- [ ] **Step 5: Configure the local frontend**

Update ignored local environment files with the private Supabase URL, publishable key, `VITE_PLATFORM_AI_ENABLED=true`, and `VITE_AUTH_EMAIL_DELIVERY_ENABLED=false`. Never add these values to Git.

### Task 10: Configure backup and complete private acceptance

- [ ] **Step 1: Install `age` on the Mac and create a backup recipient**

Store the private identity under the user's protected home directory and place only the public recipient on the VPS or in the local backup script. Do not commit either key.

- [ ] **Step 2: Prove a database backup and restore**

Stream `pg_dump -Fc` over the authenticated Tailscale SSH path, encrypt it with `age`, restore it to a temporary database, and verify Auth rows, business tables, migration history, and RLS helpers.

- [ ] **Step 3: Install the macOS schedule**

Render the plist template with absolute paths, load it with `launchctl`, and verify one successful run plus retention pruning.

- [ ] **Step 4: Run browser acceptance**

Verify through the real private Supabase endpoint:

1. registration auto-confirms;
2. login, reload, and logout work;
3. guest data disappears on reload/login;
4. authenticated article, subject, tag, card, dialogue, Galgame, quiz, and progress data persist;
5. guest AI calls fail with a login message;
6. authenticated card generation and one streaming AI flow work;
7. URL extraction uses the VPS function path;
8. original PDFs are not uploaded.

- [ ] **Step 5: Record deferred public gates**

Update the operations guide with the items deliberately skipped in this private phase:

- non-root SSH and password rotation;
- removal of SSH from public `443`;
- DNS and Caddy;
- SMTP and password recovery;
- database-backed AI quotas and audit;
- public IP rate limiting and complete SSRF hardening;
- production AI key;
- Supabase Storage.

- [ ] **Step 6: Final verification**

Run all local gates again, collect container health, port-binding, RLS, backup-restore, and browser evidence, then create the final deployment documentation commit.

## Completion Evidence

The private phase is complete only when all of the following exist:

- a clean deployable Git revision;
- healthy approved containers and no disabled containers;
- no public raw Supabase ports;
- successful schema and RLS verification;
- authenticated platform AI proxy with no browser secret;
- a successful encrypted backup restore;
- a browser-tested private learning flow;
- a written list of deliberately deferred public-release gates.
