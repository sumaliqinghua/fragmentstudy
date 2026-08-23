# Mobile iOS / Android — environment setup

Checklist to run `apps/mobile` on a Mac simulator. Prefer **local Xcode builds** (`expo run:ios`) over Expo Go — Expo Go CDN and App Store builds often fail for SDK 57 on restricted networks.

## One-time prerequisites

### 1. Xcode + iOS Simulator

1. Install **Xcode** from the Mac App Store.
2. Open Xcode once and accept the license / install components.
3. Install an iOS Simulator runtime: **Xcode → Settings → Platforms**.
4. In a terminal:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
sudo xcodebuild -license accept
xcodebuild -runFirstLaunch
open -a Simulator
```

### 2. CocoaPods (required for `expo run:ios`)

Expo will try `gem install cocoapods` if `pod` is missing — that often **hangs** on system Ruby. Install with Homebrew instead:

```bash
HOMEBREW_NO_AUTO_UPDATE=1 brew install cocoapods
pod --version   # expect 1.x
```

If Homebrew fails downloading from `ghcr.io` (`Connection reset by peer`), use a VPN or a Homebrew bottle mirror, then retry.

### 3. Node dependencies

```bash
cd apps/mobile
npm install
```

### 4. Backend env (`apps/mobile/.env`)

**Option A — interactive (recommended)** from repo root:

```bash
npm run mobile:dev
# pick 「本地 Supabase + iOS」 (or Android)
```

This starts Docker Supabase, writes `apps/mobile/.env`, then launches the native build.

**Option B — local Supabase manually:**

```bash
# repo root — needs Docker Desktop + Supabase CLI
npm run supabase:start
npm run supabase:status   # copy API URL + anon key

cd apps/mobile
cp .env.example .env
# set:
# EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321   # iOS Simulator
# EXPO_PUBLIC_SUPABASE_ANON_KEY=<from status>
# EXPO_PUBLIC_PLATFORM_AI_ENABLED=false
# EXPO_PUBLIC_AUTH_EMAIL_DELIVERY_ENABLED=false
```

**Option C — remote Supabase:** same keys as web `VITE_SUPABASE_*`, but use `EXPO_PUBLIC_*` names in `apps/mobile/.env`.

| Where you run the app | `EXPO_PUBLIC_SUPABASE_URL` |
|-----------------------|----------------------------|
| iOS Simulator | `http://127.0.0.1:54321` |
| Android Emulator | `http://10.0.2.2:54321` |
| Physical phone | `http://<your-Mac-LAN-IP>:54321` |

Guest mode works without Supabase (sample material only). Login + import need a configured URL/key.

## First launch (iOS)

```bash
cd apps/mobile
open -a Simulator
npm run ios
```

What happens:

1. **Prebuild** — generates `apps/mobile/ios/`
2. **CocoaPods** — `pod install` (needs step 2 above)
3. **Hermes download** — large Maven tarballs (see mirror below)
4. **Xcode compile** — first time ~5–15 minutes
5. App opens on Simulator

Day-to-day after the first success:

```bash
cd apps/mobile
npm run ios          # or: npm start  then reopen the app
```

From repo root with local Supabase:

```bash
npm run mobile:ios
```

## Network / China mirrors

### Hermes / Maven (very common bottleneck)

Default host `repo1.maven.org` is often extremely slow.  
`npm run ios` sets Aliyun via `ENTERPRISE_REPOSITORY`. If a download is stuck:

```bash
# Ctrl+C, clear incomplete cache, retry
rm -f ~/Library/Caches/ReactNative/hermes-ios-*.tar.gz
cd apps/mobile
npm run ios
```

Manual override:

```bash
export ENTERPRISE_REPOSITORY=https://maven.aliyun.com/repository/central
# Huawei:  https://repo.huaweicloud.com/repository/maven
# Tencent: https://mirrors.cloud.tencent.com/nexus/repository/maven-public
```

Confirm logs show `maven.aliyun.com/.../hermes-ios/...`, not `repo1.maven.org`.

### Do **not** rely on Expo Go for this project

| Approach | Status |
|----------|--------|
| `expo start --ios` / Expo Go auto-download | Often `ETIMEDOUT` / `fetch failed` |
| App Store Expo Go | Stuck on older SDK; not SDK 57 |
| `npm run ios:go` | Same CDN; optional only if CDN works |
| **`npm run ios` (`expo run:ios`)** | **Recommended** — local Xcode, no Expo Go |

## Android (optional)

1. Install Android Studio + an emulator (API 34+).
2. CocoaPods is not required; Gradle still uses Maven — prefer Aliyun in `~/.gradle/init.gradle` if Central is slow.
3. Local Supabase URL must be `http://10.0.2.2:54321`.
4. Run: `cd apps/mobile && npm run android` or repo root `npm run mobile:android`.

## Quick verification

| Check | Command / expectation |
|-------|------------------------|
| Simulator | `open -a Simulator` |
| CocoaPods | `pod --version` |
| Mobile deps | `cd apps/mobile && npm install` |
| Env | `apps/mobile/.env` has `EXPO_PUBLIC_SUPABASE_*` (or guest-only) |
| Launch | `npm run ios` → app on simulator |
| Guest flow | Home → Continue → cards → celebration |
| Auth flow | Login → `+` → paste import → path updates |

## Common failures

| Symptom | Fix |
|---------|-----|
| Stuck on “Installing CocoaPods CLI with Gem” | Ctrl+C → `brew install cocoapods` → `npm run ios` |
| Hermes curl ~KB/s on `repo1.maven.org` | Use Aliyun `ENTERPRISE_REPOSITORY` (already in `npm run ios`) |
| `brew install cocoapods` fails on `ghcr.io` | VPN / Homebrew mirror, then retry |
| Expo Go `ETIMEDOUT` / `fetch failed` | Stop using Expo Go; use `npm run ios` |
| `window is not defined` (old web static SSR) | Already fixed (`web.output: single` + SSR-safe storage) |
| Login / import fails as guest | Expected — import and AI require login |

## Related commands (repo root)

| Command | Purpose |
|---------|---------|
| `npm run mobile:dev` | Interactive menu: local Supabase + platform |
| `npm run mobile:ios` | Local Supabase + `expo run:ios` |
| `npm run mobile:android` | Local Supabase + `expo run:android` |
| `npm run mobile:guest` | Guest mode + iOS |
| `npm run supabase:start` / `status` / `stop` | Local Supabase only |

App details and screen map: [`apps/mobile/README.md`](../../../apps/mobile/README.md).
