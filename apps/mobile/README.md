# FragmentStudy Mobile (Expo)

Production-oriented React Native app for the Continue-First redesign. Reuses the same Supabase project as the legacy web app for auth, articles, cards, and progress.

**Full environment checklist:**  
[`Docs/superpowers/specs/2026-08-24-mobile-dev-environment.md`](../../Docs/superpowers/specs/2026-08-24-mobile-dev-environment.md)

## Stack

- Expo Router (file-based navigation)
- Supabase Auth + PostgREST (`articles`, `cards`, `learning_progress`, `rewards`)
- Guest mode: in-memory sample material (no AI / no import)
- Logged-in: import paste → AI or local split → path of 关卡 → reader → celebration

## Environment setup (summary)

Do these **once** on a Mac before the first iOS run:

| # | Step | Command / note |
|---|------|----------------|
| 1 | Xcode + Simulator | App Store → open Xcode once → install iOS platform → `open -a Simulator` |
| 2 | CocoaPods via Homebrew | `HOMEBREW_NO_AUTO_UPDATE=1 brew install cocoapods` (do **not** wait on Expo’s gem installer) |
| 3 | Install JS deps | `cd apps/mobile && npm install` |
| 4 | Configure backend | `npm run mobile:dev` from repo root, **or** copy `.env.example` → `.env` with local/remote Supabase |
| 5 | First native build | `cd apps/mobile && npm run ios` (`expo run:ios`, **not** Expo Go) |

**Expect on first `npm run ios`:** prebuild → `pod install` → Hermes Maven download (Aliyun mirror) → Xcode compile (5–15 min).

### Quick start after prerequisites

```bash
# A) All-in-one from repo root (local Supabase + iOS)
npm run mobile:ios

# B) Manual
cd apps/mobile
open -a Simulator
npm run ios
```

### Env vars (`apps/mobile/.env`)

| Variable | Purpose |
|----------|---------|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase API URL (`http://127.0.0.1:54321` on iOS Simulator) |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Anon key |
| `EXPO_PUBLIC_PLATFORM_AI_ENABLED` | Call `openai-proxy` for split/title/explain |
| `EXPO_PUBLIC_AUTH_EMAIL_DELIVERY_ENABLED` | Password-reset emails |

If AI is disabled, import still works via local paragraph splitting.

### Network notes (China)

- **Hermes / Maven:** `npm run ios` sets `ENTERPRISE_REPOSITORY` to Aliyun. If stuck on `repo1.maven.org`, Ctrl+C, clear `~/Library/Caches/ReactNative/hermes-ios-*.tar.gz`, retry.
- **Expo Go:** skip — CDN timeouts are common; use local Xcode builds.
- **Homebrew `ghcr.io` failures:** VPN or bottle mirror, then `brew install cocoapods`.

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
- `Docs/superpowers/specs/2026-08-24-mobile-dev-environment.md` — detailed setup + troubleshooting
