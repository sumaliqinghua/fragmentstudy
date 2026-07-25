# Public Supabase App API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose the existing private Supabase stack at `https://api.iamchatgpt.top` for a React Native client without exposing Studio or database ports, while preserving Tailscale rollback and encrypted backups.

**Architecture:** Caddy terminates public TLS on `80/443`, permits only `/auth/v1/*`, `/rest/v1/*`, and `/functions/v1/*`, and proxies those paths to loopback Kong on `127.0.0.1:8000`. Public operations use a new non-root `fragmentops` account on SSH `2222`; Tailscale remains the private rollback and backup path.

**Tech Stack:** Ubuntu 24.04, OpenSSH, UFW, Caddy, Docker Compose, self-hosted Supabase `self-hosted/v0.7.0`, Supabase Edge Functions, TypeScript, React/Vite, React Native deep links.

## Global Constraints

- Keep the existing development AI Key unchanged and server-only.
- Never write passwords, AI keys, JWT secrets, service-role keys, database passwords, or age identities to Git or command output.
- Never remove SSH port `443` until a fresh `fragmentops@107.175.95.166:2222` key-only session and sudo command both succeed.
- Keep Tailscale `:8443` as an optional rollback entry; migrate the existing backup alias to `fragmentops:2222` before releasing SSH `443`.
- Publicly expose only `80`, `443`, and `2222`; keep `8000`, `5432`, and `6543` loopback-only.
- Keep Storage, Realtime, RAG, pgvector, Cloudflare proxying, and public registration out of scope.
- Use `fragmentarticle://auth/callback` for React Native Auth redirects.
- Deploy only committed repository revisions.

---

### Task 1: Require Authentication for Public Content Extraction

**Files:**
- Create: `supabase/functions/_shared/functionAuthSecurity.ts`
- Create: `supabase/functions/_shared/functionAuthSecurity.test.ts`
- Modify: `supabase/functions/content-extractor/index.ts`
- Modify: `src/services/contentImport.ts`
- Modify: `src/services/contentImport.test.ts`
- Modify: `src/components/ArticleInput.tsx`
- Test: `supabase/functions/_shared/functionAuthSecurity.test.ts`
- Test: `src/services/contentImport.test.ts`

**Interfaces:**
- Produces: `extractUserBearerToken(header: string | null): string`
- Produces: `FunctionAuthError` with a numeric `status`
- Produces: `extractUrlContent(value, onProgress?, accessToken?)`
- Consumes: `SUPABASE_URL` and `SUPABASE_ANON_KEY` from the Functions environment

- [x] **Step 1: Write the failing token parsing test**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  extractUserBearerToken,
  FunctionAuthError,
} from './functionAuthSecurity.ts';

test('content extraction requires a bearer user token', () => {
  for (const value of [null, '', 'Basic abc', 'Bearer   ']) {
    assert.throws(
      () => extractUserBearerToken(value),
      (error: unknown) =>
        error instanceof FunctionAuthError
        && error.status === 401
        && /登录/.test(error.message),
    );
  }
  assert.equal(extractUserBearerToken('Bearer user-token'), 'user-token');
});
```

- [x] **Step 2: Run the test and confirm it fails**

Run:

```bash
node --test supabase/functions/_shared/functionAuthSecurity.test.ts
```

Expected: FAIL because the module does not exist.

- [x] **Step 3: Implement the pure authentication parser**

```ts
export class FunctionAuthError extends Error {
  readonly status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = 'FunctionAuthError';
    this.status = status;
  }
}

export function extractUserBearerToken(header: string | null): string {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  if (!match) throw new FunctionAuthError('请先登录后导入网页');
  return match[1];
}
```

- [x] **Step 4: Add live Supabase user validation to `content-extractor`**

Import `createClient` from `npm:@supabase/supabase-js@2.57.4` and the pure parser. Add:

```ts
function requireEnvironment(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new FunctionAuthError(`服务端缺少 ${name} 配置`, 500);
  return value;
}

async function authenticateUser(token: string): Promise<void> {
  const client = createClient(
    requireEnvironment('SUPABASE_URL'),
    requireEnvironment('SUPABASE_ANON_KEY'),
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    throw new FunctionAuthError('登录已失效，请重新登录');
  }
}
```

Keep `OPTIONS` unauthenticated. After validating the method and before reading the URL body:

```ts
const token = extractUserBearerToken(request.headers.get('authorization'));
await authenticateUser(token);
```

Catch `FunctionAuthError` before the generic error and return its status without logging the token.

- [x] **Step 5: Send the restored user access token from the client**

Change `extractUrlContent` to accept an optional access token:

```ts
export async function extractUrlContent(
  value: string,
  onProgress?: ProgressHandler,
  accessToken?: string,
): Promise<ImportedContent>
```

Change extractor headers so `apikey` remains the anon key while `Authorization` uses the user token when present:

```ts
Authorization: `Bearer ${accessToken || anonKey}`,
```

In `ArticleInput`, obtain the current session immediately before URL import:

```ts
const { data: { session } } = await supabase.auth.getSession();
const result = await extractUrlContent(
  urlInput,
  setImportProgress,
  session?.access_token,
);
```

Update the configured import test to pass `user-token` and assert:

```ts
assert.equal(headers.apikey, 'anon-key');
assert.equal(headers.Authorization, 'Bearer user-token');
```

Keep the existing Jina fallback for guests: an anon-key Function `401` may fall back without making the public Function anonymous.

- [x] **Step 6: Run focused and complete tests**

Run:

```bash
node --test supabase/functions/_shared/functionAuthSecurity.test.ts
npm test
npm run typecheck
```

Expected: focused test PASS, complete tests PASS, typecheck exit `0`.

- [x] **Step 7: Commit**

Use a Lore commit that records the public-proxy abuse constraint and confirms anonymous extraction now returns `401`.

---

### Task 2: Add Reproducible Public URL Configuration

**Files:**
- Create: `scripts/supabase/configure-public-url.sh`
- Create: `scripts/supabase/configure-public-url.test.sh`
- Modify: `infra/supabase/.env.private.example`

**Interfaces:**
- Consumes: `<public-base-url> <site-url> <redirect-list> [install-root]`
- Produces: an atomic, permission-preserving update of the official `docker/.env`
- Produces: a timestamped mode-`0600` backup under `<install-root>/backups/public-rollout`

- [x] **Step 1: Write a failing shell fixture test**

The test creates a temporary install root with a representative `docker/.env`, runs the script, and asserts:

```bash
grep -Fx 'SUPABASE_PUBLIC_URL=https://api.iamchatgpt.top' "$env_file"
grep -Fx 'API_EXTERNAL_URL=https://api.iamchatgpt.top/auth/v1' "$env_file"
grep -Fx 'SITE_URL=fragmentarticle://auth/callback' "$env_file"
grep -Fx "ADDITIONAL_REDIRECT_URLS=$redirects" "$env_file"
grep -Fx 'DISABLE_SIGNUP=false' "$env_file"
test "$(stat -f '%Lp' "$env_file" 2>/dev/null || stat -c '%a' "$env_file")" = 600
test "$(find "$root/backups/public-rollout" -type f -name 'docker.env.*.bak' | wc -l | tr -d ' ')" = 1
```

Run:

```bash
bash scripts/supabase/configure-public-url.test.sh
```

Expected: FAIL because the configuration script does not exist.

- [x] **Step 2: Implement strict argument and URL validation**

The script must:

- use `set -euo pipefail`;
- require an `https://` base URL without a path;
- require `fragmentarticle://auth/callback` as the current site URL;
- reject newline characters in all values;
- require an absolute install root;
- refuse to continue if `docker/.env` is missing;
- never print `.env` contents.

- [x] **Step 3: Implement atomic updates**

Use an internal `set_env_value` function based on `awk`, write through `mktemp` in the same directory, `chmod 0600`, then `mv`. Set:

```text
SUPABASE_PUBLIC_URL
API_EXTERNAL_URL=<base>/auth/v1
SITE_URL
ADDITIONAL_REDIRECT_URLS
DISABLE_SIGNUP=false
```

The script intentionally leaves signup enabled until the owner account is confirmed.

- [x] **Step 4: Update the non-secret environment example**

Document the public values as comments without replacing the private defaults or adding secrets.

- [x] **Step 5: Run tests**

Run:

```bash
bash scripts/supabase/configure-public-url.test.sh
bash -n scripts/supabase/*.sh
git diff --check
```

Expected: all exit `0`.

- [x] **Step 6: Commit**

Use a Lore commit that records why owner bootstrap and signup closure are separate operations.

---

### Task 3: Add Caddy Policy and Public Verification

**Files:**
- Create: `infra/supabase/Caddyfile.public`
- Create: `scripts/supabase/verify-public.sh`
- Modify: `infra/supabase/README.md`

**Interfaces:**
- Caddy listens for `api.iamchatgpt.top`
- Caddy proxies only approved path prefixes to `127.0.0.1:8000`
- `verify-public.sh <domain> <public-ip> [ssh-port]` returns nonzero on any exposure or health failure

- [x] **Step 1: Add the Caddy policy**

The Caddyfile must:

```caddyfile
api.iamchatgpt.top {
	encode zstd gzip

	header {
		-Server
		X-Content-Type-Options "nosniff"
		Referrer-Policy "no-referrer"
		Cache-Control "no-store"
	}

	@approved path /auth/v1/* /rest/v1/* /functions/v1/*
	handle @approved {
		request_body {
			max_size 16MB
		}
		reverse_proxy 127.0.0.1:8000 {
			flush_interval -1
		}
	}

	handle {
		respond "Not Found" 404
	}

}
```

Do not enable Caddy site access logging. Default access logs include the full URI, and Auth query parameters may contain one-time codes. Use systemd error logs only.

- [x] **Step 2: Implement public verification**

`verify-public.sh` must verify:

- DNS A answer contains the expected public IP;
- `https://<domain>/` returns `404`;
- Auth health through `/auth/v1/health` succeeds when supplied the anon key read locally on the VPS;
- anonymous `POST /functions/v1/openai-proxy` returns `401`;
- anonymous `POST /functions/v1/content-extractor` returns `401`;
- public IP ports `8000`, `5432`, and `6543` are closed;
- public SSH port `2222` is open;
- certificate hostname verification succeeds through normal `curl`.

The script must not echo the anon key.

- [x] **Step 3: Document install and rollback commands**

Add exact Caddy install, validate, reload, log, and rollback commands to `infra/supabase/README.md`.

- [x] **Step 4: Validate locally**

Run:

```bash
bash -n scripts/supabase/*.sh
git diff --check
```

Run `caddy validate --config /etc/caddy/Caddyfile` later on the VPS before reloading.

- [x] **Step 5: Commit**

Use a Lore commit that records why the Kong root route and Studio are deliberately unavailable.

---

### Task 4: Update the Learning and Operations Documentation

**Files:**
- Modify: `Docs/Supabase自托管搭建与Unity接入实战.md`
- Modify: `Docs/superpowers/specs/2026-07-25-public-supabase-api-design.md` only if execution discoveries change the approved design

**Interfaces:**
- Documents the exact public endpoint, React Native scheme, SSH role split, Caddy route allowlist, owner bootstrap, rollback, and deferred items

- [x] **Step 1: Add the public architecture and migration order**

Explain why SSH must move before Caddy, why Tailscale remains, and why Cloudflare is deferred.

- [x] **Step 2: Add React Native examples**

Include:

```text
Supabase URL: https://api.iamchatgpt.top
Auth callback: fragmentarticle://auth/callback
```

Document that the React Native repository must register the same scheme in iOS and Android configuration before OAuth or password-reset deep links can be accepted.

- [x] **Step 3: Add operational security guidance**

Document:

- public signup closes after owner bootstrap;
- root password is never stored in the repository;
- external users remain blocked until quotas, audit, and SMTP exist;
- Storage, Realtime, RAG, and Cloudflare remain deferred.

- [x] **Step 4: Run documentation checks and commit**

Run:

```bash
rg -n 'TBD|TODO|待定|待确认' \
  infra/supabase/README.md \
  Docs/Supabase自托管搭建与Unity接入实战.md \
  Docs/superpowers/specs/2026-07-25-public-supabase-api-design.md
git diff --check
```

Expected: no unresolved placeholders and no whitespace errors.

Commit using the Lore protocol.

---

### Task 5: Perform Read-Only Remote Preflight

**Files:**
- No repository changes
- Read only: VPS SSH, DNS, Docker, firewall, Tailscale, Supabase config metadata

**Interfaces:**
- Produces: a preflight record containing no secrets
- Blocks all mutation if DNS, backup, service health, or SSH prerequisites fail

- [x] **Step 1: Verify DNS and current endpoints**

Run from the Mac:

```bash
dig +short A api.iamchatgpt.top
ssh -i ~/.ssh/id_ed25519 -p 443 -o BatchMode=yes root@107.175.95.166 true
anon="$(awk 'index($0, "VITE_SUPABASE_ANON_KEY=") == 1 {print substr($0, index($0, "=") + 1); exit}' .env.local)"
curl -fsS \
  -H "apikey: $anon" \
  https://racknerd-b4acd93.tail635b33.ts.net:8443/auth/v1/health
unset anon
```

Expected: DNS includes `107.175.95.166`, private health succeeds with the required anon header during the actual check, and SSH exits `0`.

- [x] **Step 2: Inspect SSH and firewall activation**

Read without changing:

```bash
sshd -T
systemctl is-active ssh
systemctl is-active ssh.socket
systemctl cat ssh
systemctl cat ssh.socket
ss -lntp
ufw status verbose
```

Choose the service/socket configuration path from observed state; do not assume `Port` directives alone control the listener.

- [x] **Step 3: Verify Supabase and backups**

Verify:

- 8 approved containers are healthy;
- 5 disabled containers are absent;
- `8000/5432/6543` are loopback-only;
- migration count is 19;
- database lint has no errors;
- RLS 6/6 passes and rolls back;
- latest encrypted dump produces a valid `pg_restore --list`;
- if the current LaunchAgent fails only because Mac Tailscale is stopped, Task 6 must migrate and verify the backup alias before releasing `443`.

- [x] **Step 4: Record the go/no-go result**

Proceed only if all preflight checks pass. Any discrepancy becomes a documented blocker with no remote mutation.

Preflight result (2026-07-25): GO. DNS resolves to the VPS, private Auth
health and root key SSH on the temporary public `443` listener succeed, the
approved eight containers are healthy, disabled services are absent,
database ports remain loopback-only, all 19 migrations are present, database
lint and the six RLS rollback checks pass, and the latest encrypted database
dump has a readable PostgreSQL restore list. The existing LaunchAgent route
was the only unavailable check while Mac Tailscale was stopped; Task 6 owns
its migration to `fragmentops:2222` and must produce a fresh verified backup
before releasing SSH `443`. Tailscale has since been restarted and remains
the rollback path during that migration.

---

### Task 6: Migrate SSH Safely to Non-Root Port 2222

**Files:**
- Remote create: `/etc/ssh/sshd_config.d/00-fragmentarticle-public.conf`
- Remote create: `/etc/sudoers.d/fragmentops`
- Remote modify only if required by observed state: systemd SSH socket override
- Remote backup: existing SSH configuration under `/root/fragmentarticle-rollout/<UTC timestamp>/`
- Local modify: `~/.ssh/config` backup alias target
- Local install: `~/.local/bin/fragmentarticle-supabase-backup`

**Interfaces:**
- Produces: `fragmentops@107.175.95.166:2222` key-only sudo access
- Produces: launchd backup through the same non-root public SSH route
- Preserves: Tailscale Serve `:8443` as an optional API rollback

- [ ] **Step 1: Back up SSH and firewall configuration**

Create a mode-`0700` timestamped directory and archive `/etc/ssh`, relevant systemd overrides, and `ufw status numbered`. Do not copy private host keys off the VPS.

- [ ] **Step 2: Create `fragmentops`**

Create the user with `/bin/bash`, install the existing Mac ed25519 public key as mode `0600`, and create a mode-`0440` sudoers rule:

```text
fragmentops ALL=(ALL:ALL) NOPASSWD:ALL
```

Validate with `visudo -cf /etc/sudoers.d/fragmentops`.

- [ ] **Step 3: Enable dual SSH listeners**

Configure the observed current ports plus `2222`, disable password and keyboard-interactive authentication, set `PermitRootLogin no`, and restrict allowed users to `fragmentops`.

Validate using:

```bash
sshd -t
systemctl reload ssh
ss -lntp | grep -E ':(443|2222)\b'
```

- [ ] **Step 4: Open and test port 2222**

Allow TCP `2222` in UFW if UFW is active. From a separate Mac process:

```bash
ssh -i ~/.ssh/id_ed25519 \
  -p 2222 \
  -o BatchMode=yes \
  -o StrictHostKeyChecking=accept-new \
  fragmentops@107.175.95.166 \
  'sudo -n true'
```

Expected: exit `0`.

- [ ] **Step 5: Migrate and verify automated backup**

Install the committed `backup-private.sh` as `~/.local/bin/fragmentarticle-supabase-backup`. Update the existing `fragmentarticle-backup` SSH alias to:

```text
HostName 107.175.95.166
User fragmentops
Port 2222
IdentityFile ~/.ssh/id_ed25519
BatchMode yes
```

The backup script uses `sudo -n` for Docker and root-owned configuration reads. Trigger the LaunchAgent, require exit code `0`, confirm a new three-file snapshot, and run `pg_restore --list`.

- [ ] **Step 6: Verify negative cases**

Confirm password authentication is unavailable and public root login on `2222` is rejected. Keep the original root `443` session open until these checks pass.

- [ ] **Step 7: Remove SSH from 22 and 443**

Only after Steps 4-6 pass, remove `22` and `443` from the effective SSH listener, validate with `sshd -t`, reload, and confirm:

- `2222` still accepts `fragmentops`;
- `22` and `443` no longer belong to sshd;
- the public non-root backup route remains usable.

---

### Task 7: Install Caddy and Publish the Approved API Paths

**Files:**
- Remote install: Caddy package
- Remote create: `/etc/caddy/Caddyfile`
- Remote backup: previous Caddy configuration if present

**Interfaces:**
- Produces: valid TLS for `api.iamchatgpt.top`
- Proxies: approved Supabase API paths to `127.0.0.1:8000`
- Rejects: root, Studio, Meta, Storage, Realtime, and unknown paths

- [ ] **Step 1: Install Caddy and stage configuration**

Install Caddy from its official Ubuntu repository:

```bash
sudo apt-get update
sudo apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
  | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
  | sudo tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
sudo chmod o+r /etc/apt/sources.list.d/caddy-stable.list
sudo apt-get update
sudo apt-get install -y caddy
```

Copy the committed `infra/supabase/Caddyfile.public` to `/etc/caddy/Caddyfile` as root.

- [ ] **Step 2: Validate before starting**

Run:

```bash
caddy fmt --overwrite /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
```

Expected: valid configuration.

- [ ] **Step 3: Open HTTP/HTTPS and start Caddy**

Allow `80/tcp` and `443/tcp` in UFW if active, enable Caddy, and wait for certificate issuance.

- [ ] **Step 4: Verify routing before Supabase URL mutation**

Confirm:

- TLS hostname validation succeeds;
- `/` returns `404`;
- `/auth/v1/health` reaches Kong with an anon header;
- Studio is not reachable;
- Caddy logs do not contain Authorization or request bodies.

- [ ] **Step 5: Roll back on failure**

If certificate issuance or routing fails, stop Caddy, keep SSH on `2222`, and continue using Tailscale `:8443`. Do not return SSH to `443` unless a separate recovery need is proven.

---

### Task 8: Deploy Public Supabase Configuration and Close Owner-Only Acceptance

**Files:**
- Remote modify: `/opt/fragment-article/supabase/docker/.env`
- Remote sync: committed `supabase/functions`, migrations, and deployment artifacts
- Local ignored modify: `.env.local`
- Modify after evidence: `infra/supabase/README.md`
- Modify after evidence: `Docs/Supabase自托管搭建与Unity接入实战.md`

**Interfaces:**
- Public URL: `https://api.iamchatgpt.top`
- App callback: `fragmentarticle://auth/callback`
- Public signup: temporarily enabled for owner bootstrap, then disabled

- [ ] **Step 1: Run the complete local verification before deployment**

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
bash -n scripts/supabase/*.sh
bash scripts/supabase/configure-public-url.test.sh
git diff --check
```

Expected: tests/typecheck/build/shell checks pass; lint has zero errors and any existing warnings are recorded.

- [ ] **Step 2: Commit all deployable artifacts**

Confirm `git status` is clean and note the exact revision. Sync only that revision using `scripts/supabase/sync-project.sh`.

- [ ] **Step 3: Apply public URL configuration**

Run the committed configuration script with:

```text
base URL: https://api.iamchatgpt.top
site URL: fragmentarticle://auth/callback
redirects: fragmentarticle://auth/callback,http://localhost:5174/**,http://localhost:5183/**,https://iamchatgpt.top/**,https://www.iamchatgpt.top/**
install root: /opt/fragment-article/supabase
```

Keep `DISABLE_SIGNUP=false` for owner bootstrap.

- [ ] **Step 4: Recreate only affected services**

Recreate `auth`, `studio`, and `functions` with the private Compose override and wait for health. Do not start Storage, Realtime, imgproxy, Analytics, or Vector.

- [ ] **Step 5: Update local development target**

Set ignored `.env.local` to use `https://api.iamchatgpt.top` as the network URL while preserving `/supabase-proxy` as the browser URL. Never place the AI Key in a `VITE_*` variable.

- [ ] **Step 6: Run public functional acceptance**

Verify:

- anonymous AI `401`;
- anonymous content extraction `401`;
- authenticated REST and content extraction succeed;
- authenticated non-stream AI succeeds;
- authenticated SSE returns data and `[DONE]`;
- invalid model and client-owned credentials return `400`;
- root and Studio routes return `404`;
- no secret/token/body leakage in logs.

- [ ] **Step 7: Bootstrap the owner and close signup**

If no persistent owner exists, pause only for the user to create the owner account with their private credentials. After login and session restoration pass, set:

```text
DISABLE_SIGNUP=true
```

Recreate `auth`, then verify a fresh anonymous signup is rejected while the owner can still log in.

- [ ] **Step 8: Re-run infrastructure, database, and backup acceptance**

Run:

- `verify-private.sh`;
- `verify-public.sh api.iamchatgpt.top 107.175.95.166 2222`;
- migration count and database lint;
- RLS 6/6 rollback test;
- LaunchAgent backup trigger;
- latest encrypted dump `pg_restore --list`.

- [ ] **Step 9: Record evidence and commit**

Update both operations documents with:

- effective public URL and SSH route;
- deployment revision and date;
- TLS, route, Auth, AI, import, database, and backup evidence;
- root password rotation status;
- known deferred items and remaining risks.

Commit using Lore trailers and run the full local verification again from the committed state.

- [ ] **Step 10: Rotate the exposed root recovery password without printing it**

After all public and backup checks pass, generate a new random recovery password locally, store it in macOS Keychain under service `fragmentarticle-racknerd-root-recovery`, pass it to `chpasswd` over the verified `fragmentops` SSH session, then unset the shell variable. Suppress command output and never add the password to a file.

Verify again that SSH password authentication and public root login remain rejected. Record only the rotation date and Keychain service name in documentation.
