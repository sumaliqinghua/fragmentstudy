# FragmentStudy Product Redesign — Continue-First Micro Reader

**Date:** 2026-08-08  
**Status:** Approved (product idea & UX direction; not visual/Figma/implementation spec)  
**Related:** `Docs/需求.md` (original PRD), `Docs/想法.md` (idea bank), `Docs/superpowers/specs/2026-08-10-figma-design-brief.md` (Figma brief), `Docs/superpowers/plans/2026-08-08-continue-first-spine.md` (optional eng plan — defer until after Figma)  
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
| Soft Duolingo-shaped path, gifts, streak & celebrations | Hard quotas, shame-y streak pressure, pets/shop/leaderboards |
| Optional quiz on demand | Quiz-gated progress or import-time quiz commitment |
| Sample-first for visitors; login for AI | Full AI product usable as anonymous guest |

---

## 2. Core loop

1. **Visitor:** Try a **pre-built sample material** (no AI) → feel Continue + cards + stop completion.
2. **Login:** Unlocks **AI** (import/split, explain, quiz generate).
3. **Import** a long text (paste / link / file). **Content is the job**; title is optional — if empty, AI names the material.
4. AI **distills** the long text into **cards** (core ideas, not raw chunking), groups them into **关卡** (see §4). Each card keeps a **link back to its original passage**.
5. **Home** shows the current material’s **关卡 path** (steps + gift chests) with **Continue** on the current node.
6. Read cards one by one; jump to **原文** to verify or read around the idea; **select text → AI explain** (primary), plus **highlight / note**; micro-feedback (points, motion, haptic).
7. **Finish the 关卡** → celebration animation + gift if the node has one + streak.
8. **Quiz** optional (entrance or soft prompt); never blocks Continue.
9. Tomorrow: same Continue path.

---

## 3. Information architecture & pages

### 3.1 Bottom navigation

| Tab | Role |
|-----|------|
| **Home** | Streak + current material **path (steps + gifts)** + Continue |
| **+** (center) | Import flow only (not a content tab) |
| **Library** | Materials list + account / light settings entry |

One clear import entry (center `+`). Do **not** also use a floating `+` on Home (avoids competing with Continue).

### 3.2 Home

- Soft streak + today’s status (e.g. “Stop done” / “1 stop to keep streak”).
- **Current material’s 关卡 path** (Duolingo-style): visible steps ahead/behind, gift/chest nodes on the path, current node highlighted.
- **Continue** is the action on the **current node** (tap the node or a Continue button anchored to it) — not a dashboard that hides the path.
- Quiet switcher: other in-progress materials (title + stop progress); switching changes which path is shown.
- **Empty (logged-in, no materials):** CTA to import a long text.
- **Guest:** Sample material path + Continue; `+` leads to login to import own text.

Home should feel like *one trail you are walking*, not a file manager. Path + gifts are how progress becomes fun; Continue is still the one tap to start.

### 3.3 Import (`+`)

- One job: get **content** in → processing → land ready to Continue (first 关卡).
- **Title is optional and visually secondary.** The paste/body (or link/file) is the focus. Placeholder: title can be filled later; if the user leaves it blank, **AI generates a title** from the content during split.
- **No** mode picker (cards only).
- **No** “enable quiz” checkbox at import.
- **Logged-out:** tapping `+` prompts login (AI required). Sample remains available without import.

### 3.4 Reader (card session)

- Session scope = **current 关卡** (progress: card *i* / *n* within the stop).
- Card body = **distilled core content** (easier to learn in a bite); not a dump of the raw paragraph.
- Actions: next/back; **原文** — jump to the linked original span (highlighted in context) to verify or read more, then return to the card.
- **Select text** (on the card) → compact toolbar:
  - **讲解** (primary) — AI explain; login required (sample: pre-authored or login prompt).
  - **高亮** — mark the span on the card.
  - **笔记** — short note attached to the span.
  - No extra annotation types in v1 (no underline/bold/bookmark as separate tools).
- End of 关卡: **celebration animation** (see §5.3) + points + streak; if the path node was a gift, **open the chest**; CTAs: next stop / done for today / soft “Quick quiz?”
- Delight: card complete = short motion + haptic; 关卡 clear = a real (but short) celebration beat, then CTAs.

### 3.5 Library

- Materials: in progress / done.
- Material overview: same 关卡 path + gifts as Home (full trail), Continue this material, **Quiz** entrance.
- Account: login / logout; settings (including any AI/provider config for authenticated users as the product already requires).

### 3.6 Deferred out of primary IA

- Chat / visual novel as separate modes.
- Required subject/taxonomy trees.
- Full reward shop; pets, world maps, leaderboards, live rooms (path + chests on the *current material* are in scope).

---

## 4. Content model: cards & 关卡

```text
Material (article / original text)
  └── 关卡 / Stop
        └── Cards (one distilled core idea each)
              └── link → original passage (for verify / deep-read)
```

### 4.0 What a card is

- **Distill, don’t just chop.** Each card extracts / rephrases the **important core** of a semantic unit so fragmented learning is lighter than reading the full article. Prefer clarity and one idea per card over copying long verbatim blocks.
- **Always stay accountable to the source.** Every card stores a link (span / offset / quote anchor) into `original_content`. From the reader, **原文** opens that passage highlighted in context so the user can 查证 or read around it, then return.
- Cards are the **learning surface**; the original is the **ground truth**. Neither replaces the other.

### 4.1 How 关卡 are defined (hybrid)

1. AI proposes **semantic sections** (natural chapter/argument boundaries) and **distills** cards within them.
2. If a section is too large, **auto-split** into stops of about **3–5 cards** each.
3. Target feel: one stop ≈ a short Duolingo-style lesson (~2–4 minutes), not a single 2-sentence card and not a whole article.

### 4.2 Progress rules

| Event | Effect |
|-------|--------|
| **Card complete** | Micro-win: small points + animation/haptic. Does **not** alone keep the streak. |
| **关卡 complete** | Day counts for streak + **celebration animation** + more points. If this node has a gift, the chest opens here. |
| **Gift / chest** | Placed on the path (e.g. after every few 关卡, plus a finish chest). Opening is the reward moment — points (and later, freeze fuel). Not a shop. |
| **Material complete** | Finish moment (path fully lit + stronger celebration). Not required for daily habit. |

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

### 5.3 Path, gifts, motion & haptic

**Path (fun, still light)**  
Show each 关卡 as a node on a trail (done / current / upcoming). Scatter **gift chests** on the trail so the next reward is visible before you start — Duolingo’s “I can see the next step and a gift,” not a separate game world.

**Celebrations**  
- Card complete: small (check, +points, haptic).  
- 关卡 complete: **designed celebration** — character/mascot optional but not required; confetti/burst, chest-open if gifted, streak flame, then CTAs. Aim ~1.5–2.5s of delight, then user control — not a skippable 8-second interstitial.  
- Material complete: one stronger finish beat.

**Tone**  
Borrow Duolingo’s *visible progress + gifts + celebration*, not guilt, daily quest boards, or a shop. Avoid noisy always-on effects between cards.

---

## 6. In-session guidance & quiz

### 6.1 Select text: explain + light notes

Toolbar after selection (order):

1. **讲解** — primary. AI explain with light presets (simpler / analogy / tie to earlier). Login required; sample uses pre-authored help or a login prompt — no live AI for guests.
2. **高亮** — persist a highlight on that span (visible when revisiting the card).
3. **笔记** — optional short note on that span.

Highlights and notes do not affect streak. They are personal marks, not a second product (no full notebook app, no many markup styles).

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
- Heavy gamification beyond path + chests (pets, world maps, leaderboards, rarities, live rooms, shop).
- Hard daily quotas; paid streak restores in v1.
- Complex subjects as required structure.
- Quiz gating progress.
- Anonymous guest use of platform AI.

### 9.2 Keep / reframe from current product

- Long-text import → AI **distilled** cards with **original anchors** (authenticated); **AI title if the user skips title**.
- Card reader, **原文** jump to linked passage, select → **explain + highlight + note**.
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

1. **One trail, one tap** — Home shows the current material’s path; Continue starts the current 关卡.
2. **Do subtraction** — one distilled card at a time; one stop for the day; no mode maze. Import attention stays on **content**, not title.
3. **Distill + link** — cards teach the core; **原文** always lets users verify and go deeper.
4. **Micro-win ≠ daily win** — cards delight; 关卡 keeps the streak and unlocks the celebration / gift.
5. **Soft habit, visible fun** — Duolingo-shaped path, gifts, and celebrations without Duolingo-grade punishment.
6. **AI behind login; value before login** — sample first.
7. **Quiz serves memory, not the spine** — optional, on demand, never a gate.
8. **Marks stay light** — select text: explain first; highlight and note are enough.

---

## 12. Open points for later (implementation / visual design)

These do not block the product idea; resolve in Figma / tech plan:

- Exact sample material content and localization.
- Precise card count bounds for auto-split (3–5 as guideline).
- Whether guest sample streak is discarded at login or merged.
- Visual language, path illustration style, chest art, celebration motion specs, haptic patterns.
- Provider/quota details for authenticated AI.

---

## Document history

- 2026-08-08: Initial product redesign settled via brainstorming (Continue-first Micro Reader + sample-first auth gate).
- 2026-08-16: Path + gifts + celebrations on Home; import content-first with optional AI title; select-text explain + highlight + note.
- 2026-08-23: Cards are distilled core content (not raw chops) with a mandatory link back to the original passage.
