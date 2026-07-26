# Neutral Supabase Domain Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the public Supabase App API from `api.iamchatgpt.top` to
`https://api.theaimoment.com` without reopening registration, exposing new
routes, changing keys, or losing the Tailscale rollback path.

**Architecture:** DNS continues to point directly to the RackNerd VPS. Caddy
terminates TLS and exposes only Auth, REST, and Functions before proxying to
loopback Kong. The existing URL configuration script atomically changes the
Supabase public URL while preserving `DISABLE_SIGNUP=true`.

**Tech Stack:** RackNerd Ubuntu 24.04, Caddy 2.11.4, self-hosted Supabase
`self-hosted/v0.7.0`, Docker Compose, Tailscale Serve, Vite.

## Global Constraints

- Public API host: `api.theaimoment.com`.
- Public IPv4: `107.175.95.166`.
- Keep SSH on key-only port `2222`.
- Keep Tailscale HTTPS `:8443` available for rollback.
- Do not rotate or expose the existing development AI key.
- Keep public signup disabled.
- Do not enable Studio, Storage, Realtime, Meta, database, or pooler routes.
- Do not start currently disabled Supabase services.

---

### Task 1: Prepare Deployable Domain Artifacts

**Files:**
- Modify: `infra/supabase/Caddyfile.public`
- Modify: `scripts/supabase/configure-public-url.test.sh`
- Modify: `infra/supabase/.env.private.example`
- Modify: `infra/supabase/README.md`
- Modify: `Docs/Supabase自托管搭建与Unity接入实战.md`

**Interfaces:**
- Consumes: `api.theaimoment.com -> 107.175.95.166`
- Produces: committed Caddy policy and operator commands for the neutral domain

- [x] **Step 1: Replace the active API hostname**

Set the Caddy site label and active examples to `api.theaimoment.com`. Use
`https://theaimoment.com/**` and `https://www.theaimoment.com/**` only as
future Web Auth redirect allowlist entries.

- [x] **Step 2: Keep the URL fixture representative**

Run:

```bash
bash scripts/supabase/configure-public-url.test.sh
```

Expected: the four URL keys change to the neutral domain, `DISABLE_SIGNUP=true`
survives, file mode remains `0600`, one rollback backup exists, and exactly one
final `mv` occurs.

- [x] **Step 3: Validate the repository**

Run:

```bash
npm test
npm run typecheck
npm run lint
npm run build
bash -n scripts/supabase/*.sh
git diff --check
```

Expected: all commands exit `0`; the existing ESLint warnings remain non-errors.

- [x] **Step 4: Commit deployable artifacts**

Create a Lore commit that records the domestic SNI/Host reset and the neutral
domain decision.

---

### Task 2: Switch Caddy and Obtain TLS

**Files:**
- Deploy: `infra/supabase/Caddyfile.public` to `/etc/caddy/Caddyfile`
- Backup: `/etc/caddy/Caddyfile.pre-theaimoment-20260726`

**Interfaces:**
- Consumes: committed Caddy policy
- Produces: valid public TLS and the unchanged three-prefix allowlist

- [x] **Step 1: Confirm DNS and current recovery paths**

Run:

```bash
dig +short A api.theaimoment.com
ssh fragmentarticle-backup "sudo -n systemctl is-active caddy"
ssh fragmentarticle-backup "tailscale serve status"
```

Expected: DNS returns `107.175.95.166`, Caddy is active, and Tailscale `:8443`
still proxies loopback Kong.

- [x] **Step 2: Backup, install, validate, and reload**

Install the committed file through a root-owned temporary path, run
`caddy validate`, then `systemctl reload caddy`. If validation or reload fails,
restore `/etc/caddy/Caddyfile.pre-theaimoment-20260726` and reload the old
configuration.

- [x] **Step 3: Verify certificate and route boundary**

Run from both the VPS and Mac:

```bash
curl -fsS https://api.theaimoment.com/auth/v1/health
curl -o /dev/null -w '%{http_code}\n' https://api.theaimoment.com/
curl -o /dev/null -w '%{http_code}\n' https://api.theaimoment.com/project/default
```

Expected: Auth health succeeds; root and Studio return `404`.

---

### Task 3: Switch Supabase Public URLs

**Files:**
- Modify on VPS: `/opt/fragment-article/supabase/docker/.env`
- Backup on VPS: `/opt/fragment-article/supabase/backups/public-rollout/`

**Interfaces:**
- Consumes: `https://api.theaimoment.com`
- Produces: new Auth/API external URLs while preserving owner-only signup

- [x] **Step 1: Run the committed atomic configuration script**

Use:

```text
public base: https://api.theaimoment.com
site URL: fragmentarticle://auth/callback
redirects: fragmentarticle://auth/callback,http://localhost:5174/**,http://localhost:5183/**,https://theaimoment.com/**,https://www.theaimoment.com/**
install root: /opt/fragment-article/supabase
```

- [x] **Step 2: Verify non-secret settings**

Check only `SUPABASE_PUBLIC_URL`, `API_EXTERNAL_URL`, `SITE_URL`,
`ADDITIONAL_REDIRECT_URLS`, and `DISABLE_SIGNUP`. Expected:
`DISABLE_SIGNUP=true`; do not print any key, secret, password, or token.

- [x] **Step 3: Recreate only affected services**

Recreate `auth`, `studio`, and `functions` with the existing private Compose
override. Wait for health and confirm all eight approved services are healthy;
disabled services must remain absent.

- [x] **Step 4: Run public verification**

Execute `verify-public.sh api.theaimoment.com 107.175.95.166 2222` on the VPS.
Expected: TLS, approved routes, anonymous Function rejection, and private port
boundaries all pass.

---

### Task 4: Switch the Development Client and Record Evidence

**Files:**
- Modify ignored local file: `.env.local`
- Modify: `infra/supabase/README.md`
- Modify: `Docs/Supabase自托管搭建与Unity接入实战.md`

**Interfaces:**
- Consumes: verified public API
- Produces: local Web/React Native development configuration and durable record

- [x] **Step 1: Change the local public URL**

Set:

```dotenv
VITE_SUPABASE_URL=https://api.theaimoment.com
VITE_SUPABASE_BROWSER_URL=/supabase-proxy
```

Keep `VITE_SUPABASE_ANON_KEY` unchanged. Restart Vite so its proxy loads the new
target.

- [x] **Step 2: Run client smoke checks**

Confirm the App loads, Auth health is reachable through `/supabase-proxy`, and
anonymous AI/content extraction still returns `401`. Existing owner login is
not changed by the domain migration.

- [x] **Step 3: Record rollout evidence**

Record the exact Git revision, certificate/route verification, eight healthy
containers, preserved `DISABLE_SIGNUP=true`, domestic reachability, and the
continuing Tailscale rollback URL.

- [x] **Step 4: Commit evidence**

Create a Lore commit for the completed neutral-domain rollout. Do not push
unless explicitly requested.
