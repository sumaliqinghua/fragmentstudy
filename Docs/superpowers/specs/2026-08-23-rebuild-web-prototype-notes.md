# Rebuild layout (web prototype → React Native)

## Folders

| Path | Role |
|------|------|
| `apps/web-prototype/` | React + Vite + Tailwind UI prototype from Figma. Iterate and share here. |
| `apps/mobile/` | Expo React Native app (usable): Supabase auth + articles/cards/progress, continue-first UI. |
| Repo root `src/` | Legacy web app — leave alone until RN cutover. |

## Figma source

https://www.figma.com/design/d3foPDSpYiOHRmytpy0b6A/Fragment-Study?node-id=68-2

## Specs

- `Docs/superpowers/specs/2026-08-08-continue-first-product-redesign-design.md`
- `Docs/superpowers/specs/2026-08-10-figma-design-brief.md`
- **`Docs/superpowers/specs/2026-08-24-mobile-dev-environment.md`** — Mac/iOS environment checklist (Xcode, CocoaPods, Supabase, Maven mirror)

## Run prototype

```bash
cd apps/web-prototype
pnpm install   # or npm install
pnpm dev
```

## Run mobile

**First time — follow the environment doc**, then:

```bash
# repo root
npm run mobile:dev    # interactive: local Supabase + iOS/Android
npm run mobile:ios    # shortcut
```

Or after one-time setup (Xcode, CocoaPods, `apps/mobile` deps + `.env`):

```bash
cd apps/mobile
npm run ios           # expo run:ios (local build; Hermes uses Aliyun mirror)
```

Guest: sample path works offline. Login required for import + AI (same `openai-proxy` as web).
