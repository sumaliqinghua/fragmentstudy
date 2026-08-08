# FragmentStudy Product Redesign — Continue-First Micro Reader

**Date:** 2026-08-08  
**Status:** Approved (product idea & UX direction; not visual/Figma/implementation spec)  
**Related:** `Docs/需求.md` (original PRD), `Docs/想法.md` (idea bank), `Docs/superpowers/plans/2026-08-08-continue-first-spine.md`  
**Approach:** Continue-first Micro Reader (Approach 1), with light guided explain + optional quiz

---

## 1. Product idea

### 1.1 One-liner

Turn any long text into short **stops (关卡)**. Open the app → finish today’s stop → feel a small win → come back tomorrow.

### 1.2 North star

People who **struggle to start** long reading or learning texts. The product lowers the cost of *starting* and makes *continuing* feel light and rewarding—not like homework or a guilt pile.

### 1.3 Core job (wedge)

**Primary:** Micro-learn any material — “I have a few free minutes → complete one stop.”

**Secondary (covered by the same loop):** Finish unread long-form — progress and completion emerge from daily stops, without making “clear my backlog” the product identity.

### 1.4 What this redesign is / is not

| Is | Is not (for this redesign) |
|----|----------------------------|
| Micro-habit for long-form text | Multi-mode entertainment learner as the core |
| Cards-first reading | Chat / visual novel as default |
| Soft Duolingo-shaped streak & rewards | Hard quotas, shame-y streak pressure |
| Optional quiz on demand | Quiz-gated progress or import-time quiz commitment |
| Sample-first for visitors; login for AI | Full AI product usable as anonymous guest |

---

## 2. Core loop

1. **Visitor:** Try a **pre-built sample material** (no AI) → feel Continue + cards + stop completion.
2. **Login:** Unlocks **AI** (import/split, explain, quiz generate).
3. **Import** a long text (paste / link / file — existing sources).
4. AI splits into **cards**, groups into **关卡** (see §4).
5. **Home → Continue** into the current 关卡 of the last-touched material.
6. Read cards one by one; **select text → explain**; micro-feedback (points, motion, haptic).
7. **Finish the 关卡** → streak + stronger celebration.
8. **Quiz** optional (entrance or soft prompt); never blocks Continue.
9. Tomorrow: same Continue path.

---

## 3. Information architecture & pages

### 3.1 Bottom navigation

| Tab | Role |
|-----|------|
| **Home** | Habit status + Continue |
| **+** (center) | Import flow only (not a content tab) |
| **Library** | Materials list + account / light settings entry |

One clear import entry (center `+`). Do **not** also use a floating `+` on Home (avoids competing with Continue).

### 3.2 Home

- Soft streak + today’s status (e.g. “Stop done” / “1 stop to keep streak”).
- **Big Continue** → current 关卡 of last-touched material (or sample, if guest).
- Quiet list: other in-progress materials (title + stop progress); switch when intentional.
- **Empty (logged-in, no materials):** CTA to import a long text.
- **Guest:** Continue into sample; `+` leads to login to import own text.

### 3.3 Import (`+`)

- One job: get text in → processing → land ready to Continue (first 关卡).
- **No** mode picker (cards only).
- **No** “enable quiz” checkbox at import.
- **Logged-out:** tapping `+` prompts login (AI required). Sample remains available without import.

### 3.4 Reader (card session)

- Session scope = **current 关卡** (progress: card *i* / *n* within the stop).
- Actions: next/back; select text → explain; optional original-text jump; keep bookmark/note only if already cheap.
- End of 关卡: celebration + points + streak update; CTAs: next stop / done for today / soft “Quick quiz?”
- Delight: card complete = short motion + haptic; 关卡 clear = short celebration (not a long interstitial).

### 3.5 Library

- Materials: in progress / done.
- Material overview: 关卡 path, Continue this material, **Quiz** entrance.
- Account: login / logout; settings (including any AI/provider config for authenticated users as the product already requires).

### 3.6 Deferred out of primary IA

- Chat / visual novel as separate modes.
- Required subject/taxonomy trees.
- Full reward shop; pets, maps, leaderboards, live rooms.

---

## 4. Content model: cards & 关卡

```text
Material (article)
  └── 关卡 / Stop
        └── Cards (one idea each)
```

### 4.1 How 关卡 are defined (hybrid)

1. AI proposes **semantic sections** (natural chapter/argument boundaries).
2. If a section is too large, **auto-split** into stops of about **3–5 cards** each.
3. Target feel: one stop ≈ a short Duolingo-style lesson (~2–4 minutes), not a single 2-sentence card and not a whole article.

### 4.2 Progress rules

| Event | Effect |
|-------|--------|
| **Card complete** | Micro-win: small points + animation/haptic. Does **not** alone keep the streak. |
| **关卡 complete** | Day counts for streak + larger celebration + more points. |
| **Material complete** | Finish moment (optional badge later). Not required for daily habit. |

Users may browse back; streak credits only when a 关卡 is **fully finished**.

---

## 5. Retention: soft streak, points, feedback

### 5.1 Streak

- Daily goal: finish **≥1 关卡** today.
- Tone: encouraging, not shame-heavy if missed.
- **v1:** Visible streak plus **at least one** free protection path (e.g. N free restores per period, or streak freeze days)—so missing a day early does not feel like failure.
- **Later:** Points can buy extra restore/freeze; keep early free protection so habit formation isn’t punitive.

**Borrow Duolingo’s shape (streak + micro-rewards + motion), not its guilt.** This audience already struggles to start.

### 5.2 Points

- Per card: small; per 关卡: larger; quiz correct (if used): small bonus.
- v1: points are visible fuel for future restores — **no shop**, no paywall tied to points.

### 5.3 Motion & haptic

- Intentional feedback on card complete, 关卡 clear, and streak up — enough to make “one more card” feel good inside a stop.
- Avoid noisy always-on effects.

---

## 6. In-session guidance & quiz

### 6.1 Guided explain (default session depth)

- Select a sentence/phrase → AI explain (light presets: e.g. simpler / analogy / tie to earlier).
- Optional; does not affect streak.
- Requires login (AI). On sample material, either omit explain or use pre-authored helper content only—no live AI for guests.

### 6.2 Quiz (optional)

- **Not** selected at import.
- Entrances: material overview + soft prompt after a 关卡 (“Quick check? ~30s” / Skip).
- Generate **on demand** when the user opens quiz.
- Never blocks next 关卡 or Continue.
- Not every material needs quiz; absorb/finish intents can skip forever.
- Later preference (optional): Off / Ask after stops — not required in v1.

---

## 7. Guest, login & AI gate

### 7.1 Rule

**AI features require login** (import/split, live explain, quiz generate). Guests cannot run the import pipeline.

### 7.2 Sample-first (chosen approach)

| Role | Can do | Cannot do |
|------|--------|-----------|
| **Guest** | Experience sample material: Continue, cards, stop UI, local throwaway streak/points on sample | Import own text; live AI explain/quiz |
| **Logged in** | Full core loop + AI import/explain/quiz; sync progress | — |

- Soft prompts: after a sample win, or when tapping `+` — “Log in to import your own articles / save your streak.”
- Login is for **unlocking AI + keeping progress**, not a brick wall before feeling the product.
- Account entry lives under Library / Me (email auth as today unless product later expands providers).

---

## 8. Presentation modes

- **v1 core:** **Cards only.**
- **Later:** Chat-style as an **optional presentation** on the same 关卡/cards (not a separate product).
- **Deferred:** Visual novel / Galgame mode — only revisit if the Continue-first habit is proven sticky.

---

## 9. Cut list & extension ladder

### 9.1 Out of this redesign

- Chat / VN as core modes and import mode picker.
- Import-time quiz checkbox.
- Heavy gamification (pets, maps, leaderboards, rarities, live rooms).
- Hard daily quotas; paid streak restores in v1.
- Complex subjects as required structure.
- Quiz gating progress.
- Anonymous guest use of platform AI.

### 9.2 Keep / reframe from current product

- Long-text import → AI cards (authenticated).
- Card reader, original text, select → explain.
- Material progress (expressed as 关卡 path).
- Optional on-demand quiz.
- Auth (email) + cloud sync for logged-in users.

### 9.3 Extension ladder (later, in order)

1. Streak shields / points → restore economy (after free-protection period).
2. Chat-style optional skin on the same stops.
3. Stronger recall (spaced quiz, weak cards).
4. Light share (finish moment / a single stop).
5. Richer play (e.g. visual novel) only if core habit holds.

**Feature filter:** If it doesn’t help *start a long text* or *finish today’s stop*, it waits.

---

## 10. Success signals

| Signal | Direction |
|--------|-----------|
| Guest → completes ≥1 sample 关卡 | High (feel value before account) |
| Guest → login when intending to import | Healthy conversion, low rage-quit |
| Time-to-first-card after import (logged in) | Short; low drop-off during processing |
| First session: finish ≥1 关卡 on own material | High |
| D1 / D7 return via Continue / streak | Improve vs current multi-mode complexity |
| Quiz start rate | Low–medium is acceptable (optional by design) |
| Setup drop-off from mode pickers | Should fall (removed) |

---

## 11. Design principles (carry forward)

1. **One primary action** — Continue (or sample Continue) dominates Home.
2. **Do subtraction** — one card at a time; one stop for the day; no mode maze.
3. **Micro-win ≠ daily win** — cards delight; 关卡 keeps the streak.
4. **Soft habit** — Duolingo-shaped rewards without Duolingo-grade punishment.
5. **AI behind login; value before login** — sample first.
6. **Quiz serves memory, not the spine** — optional, on demand, never a gate.

---

## 12. Open points for later (implementation / visual design)

These do not block the product idea; resolve in Figma / tech plan:

- Exact sample material content and localization.
- Precise card count bounds for auto-split (3–5 as guideline).
- Whether guest sample streak is discarded at login or merged.
- Visual language, motion specs, haptic patterns.
- Provider/quota details for authenticated AI.

---

## Document history

- 2026-08-08: Initial product redesign settled via brainstorming (Continue-first Micro Reader + sample-first auth gate).
