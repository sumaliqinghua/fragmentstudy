# Rebuild layout (web prototype → React Native)

## Folders

| Path | Role |
|------|------|
| `apps/web-prototype/` | **Current** — React + Vite + Tailwind UI prototype from Figma. Iterate and share here. |
| `apps/mobile/` | **Current** — Expo React Native app (usable): Supabase auth + articles/cards/progress, continue-first UI. |
| Repo root `src/` | Legacy web app — leave alone until RN cutover. |

## Figma source

https://www.figma.com/design/d3foPDSpYiOHRmytpy0b6A/Fragment-Study?node-id=68-2

## Specs

- `Docs/superpowers/specs/2026-08-08-continue-first-product-redesign-design.md`
- `Docs/superpowers/specs/2026-08-10-figma-design-brief.md`

## Run prototype

```bash
cd apps/web-prototype
pnpm install   # or npm install
pnpm dev
```

## Run mobile

```bash
# repo root — interactive (local Supabase + iOS/Android)
npm run mobile:dev
npm run mobile:ios
npm run mobile:android
```

Guest: sample path works offline. Login required for import + AI (same `openai-proxy` as web).

Phone frame web prototype:

```bash
cd apps/web-prototype
pnpm install
pnpm dev
```
