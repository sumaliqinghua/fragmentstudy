# FragmentStudy Mobile (Expo)

Production-oriented React Native app for the Continue-First redesign. Reuses the same Supabase project as the legacy web app for auth, articles, cards, and progress.

## Stack

- Expo Router (file-based navigation)
- Supabase Auth + PostgREST (`articles`, `cards`, `learning_progress`, `rewards`)
- Guest mode: in-memory sample material (no AI / no import)
- Logged-in: import paste → AI or local split → path of 关卡 → reader → celebration

## Setup

**Recommended — same flow as web `dev:menu`:**

```bash
# repo root — interactive menu
npm run mobile:dev

# shortcuts
npm run mobile:ios        # local Supabase + iOS Simulator
npm run mobile:android    # local Supabase + Android Emulator
npm run mobile:guest      # guest mode + iOS
```

The menu starts local Supabase (Docker), writes `apps/mobile/.env` from the same credentials as web, then launches Expo.

**Manual:**

```bash
cd apps/mobile
cp .env.example .env
# fill EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY
npm install
npm start
```

Then press `i` (iOS simulator), `a` (Android), or scan the QR with Expo Go.

## Env

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase API URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Anon key |
| `EXPO_PUBLIC_PLATFORM_AI_ENABLED` | Call `openai-proxy` for split/title/explain |
| `EXPO_PUBLIC_AUTH_EMAIL_DELIVERY_ENABLED` | Enable password-reset emails |

If AI is disabled, import still works via local paragraph splitting.

## Screens

| Route | Role |
|-------|------|
| `(tabs)/` | Home — streak, path, Continue |
| `(tabs)/library` | Book list |
| `import` | Paste long text (login required) |
| `reader` | Cards within current 关卡 |
| `original` | Full source text |
| `celebration` | Stop complete |
| `auth` | Sign in / sign up / sign out |

## Relation to other folders

- `apps/web-prototype/` — UI playground from Figma (keep iterating visuals there)
- Repo root `src/` — legacy web; mobile copies the data/auth patterns rather than importing DOM code
