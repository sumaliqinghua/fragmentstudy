# FragmentStudy — Web Prototype

Interactive **React** prototype of the continue-first redesign, built from the [Figma file](https://www.figma.com/design/d3foPDSpYiOHRmytpy0b6A/Fragment-Study?node-id=68-2).

## Role in the rebuild

| Folder | Purpose |
|--------|---------|
| `apps/web-prototype` (this) | Fast UI iteration & sharing; design validation before native |
| `apps/mobile` (later) | React Native app for App Store / Play |
| repo root `src/` | Legacy FragmentStudy web app (unchanged for now) |

Product specs:

- `Docs/superpowers/specs/2026-08-08-continue-first-product-redesign-design.md`
- `Docs/superpowers/specs/2026-08-10-figma-design-brief.md`

## Run

```bash
cd apps/web-prototype
pnpm install
pnpm dev
```

Open the local URL (usually `http://localhost:5173`). The viewport is phone-sized (390×844) centered on desktop.

## Scope (v1 prototype)

- Home trail (guest sample path + gifts)
- Card reader (distilled card + 原文)
- Import (source picker → paste, content-first)
- Stop celebration
- Library list (basic)
- Bottom tabs: 首页 / + / 书库

Demo data only — no AI / Supabase yet.
