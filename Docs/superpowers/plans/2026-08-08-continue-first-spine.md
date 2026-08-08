# Continue-First Spine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Continue-first habit spine: Home / + / Library tabs, derived 关卡 (stops), stop-scoped card reading, streak credited only on stop complete, and a dominant Home Continue CTA.

**Architecture:** Keep view-state navigation in `App.tsx` (no React Router). Introduce a pure `stops` utility that groups cards into 关卡 (semantic `section_id` when present, else ~3–5 card chunks). Home resolves “last touched” material and opens the current stop in `CardReader`. Streak recording moves from per-card advance to stop completion, with a soft free-freeze counter in localStorage. Dialogue/galgame stay in code but leave the primary ArticleHub path.

**Tech Stack:** React 18, TypeScript, Vite, existing `dataService` / `guestStorage` / Supabase, Node test runner (`node --test`).

**Spec:** `Docs/superpowers/specs/2026-08-08-continue-first-product-redesign-design.md`

## Global Constraints

- Cards-only as the primary learning surface; do not add import mode pickers.
- Quiz must never block Continue or stop completion (quiz nodes may remain on the path but are optional).
- Streak day credit requires finishing ≥1 关卡, not a single card.
- Guests still cannot call AI (`openai.ts` session gate stays); sample material and import login UX are **Plan 2**, not this plan.
- Prefer derived stops in v1 of this plan (no required DB migration). Optional `section_id` on cards is additive for later AI sectioning.
- Follow existing patterns in `dataService`, `Home.tsx`, `CardReader.tsx`, `streak.ts`.
- YAGNI: no reward shop, no chat/VN redesign, no haptic library unless already available via simple `navigator.vibrate`.

## Roadmap (this plan is Slice 1 of 3)

| Plan | File | Scope |
|------|------|--------|
| **1 (this)** | `Docs/superpowers/plans/2026-08-08-continue-first-spine.md` | Tabs, stops, Continue, streak-on-stop, de-emphasize extra modes |
| **2 (next)** | `Docs/superpowers/plans/2026-08-08-sample-first-auth-gate.md` (create when starting) | Bundled sample material; `+` → login; soft post-sample login |
| **3 (later)** | `Docs/superpowers/plans/2026-08-08-import-quiz-delight.md` (create when starting) | Logged-in import → first stop; on-demand quiz prompt; motion/haptic polish |

## File Map

- Create: `src/utils/stops.ts` — build/query stops from cards + progress
- Create: `src/utils/stops.test.ts` — stop grouping and “current stop” rules
- Create: `src/utils/streakFreeze.ts` — free freeze / restore counters (local)
- Create: `src/utils/streakFreeze.test.ts`
- Modify: `src/utils/streak.ts` — keep `recordStreak`; callers change; add `hasStreakCreditToday` helper if missing
- Modify: `src/types/index.ts` — `Stop`, optional `section_id` on `Card`
- Modify: `src/utils/pathGenerator.ts` — path nodes driven by stops (not raw chunk-5 only)
- Create: `src/utils/pathGenerator.test.ts` — path uses stop boundaries
- Modify: `src/components/BottomTabBar.tsx` — Home / + / Library (3 tabs)
- Modify: `src/App.tsx` — tab keys, Continue → reader with stop range, remove competing Home FAB path if duplicated
- Modify: `src/pages/Home.tsx` — Continue hero, in-progress list, soft streak copy; path secondary
- Modify: `src/pages/CardReader.tsx` — session scoped to stop; streak on stop complete; micro points hook unchanged or light
- Modify: `src/pages/ArticleHub.tsx` — primary CTA Continue cards; dialogue/galgame behind secondary “更多形式”
- Modify: `package.json` — ensure `node --test` picks up new `src/utils/*.test.ts`

---

### Task 1: Stop model utility

**Files:**
- Create: `src/utils/stops.ts`
- Create: `src/utils/stops.test.ts`
- Modify: `src/types/index.ts`
- Modify: `package.json` (test glob if needed)

**Interfaces:**
- Produces:
  - `export interface Stop { id: string; index: number; label: string; cardIds: string[]; cardRange: [number, number]; sectionId?: string }`
  - `export function buildStops(cards: Card[], options?: { maxCardsPerStop?: number }): Stop[]`
  - `export function getCurrentStop(stops: Stop[], progress: LearningProgress | null): Stop | null`
  - `export function isStopComplete(stop: Stop, progress: LearningProgress | null): boolean`
- Consumes: `Card`, `LearningProgress` from `src/types/index.ts`

- [ ] **Step 1: Add types and failing tests**

Add to `src/types/index.ts` on `Card`:

```ts
  /** Optional AI semantic section; cards sharing section_id form one 关卡 until split by max size */
  section_id?: string | null;
```

Add:

```ts
export interface Stop {
  id: string;
  index: number;
  label: string;
  cardIds: string[];
  cardRange: [number, number];
  sectionId?: string;
}
```

Create `src/utils/stops.test.ts`:

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Card, LearningProgress } from '../types';
import { buildStops, getCurrentStop, isStopComplete } from './stops.ts';

function card(partial: Partial<Card> & Pick<Card, 'id' | 'sequence_order'>): Card {
  return {
    article_id: 'a1',
    content: 'x',
    semantic_label: 'concept',
    context_summary: '',
    created_at: '2026-01-01T00:00:00.000Z',
    section_id: null,
    ...partial,
  };
}

test('buildStops chunks by maxCardsPerStop when no section_id', () => {
  const cards = [0, 1, 2, 3, 4, 5, 6].map((i) => card({ id: `c${i}`, sequence_order: i }));
  const stops = buildStops(cards, { maxCardsPerStop: 3 });
  assert.equal(stops.length, 3);
  assert.deepEqual(stops[0].cardIds, ['c0', 'c1', 'c2']);
  assert.deepEqual(stops[0].cardRange, [0, 2]);
  assert.deepEqual(stops[2].cardIds, ['c6']);
});

test('buildStops keeps semantic sections then splits oversized ones', () => {
  const cards = [
    card({ id: 'a0', sequence_order: 0, section_id: 's1' }),
    card({ id: 'a1', sequence_order: 1, section_id: 's1' }),
    card({ id: 'b0', sequence_order: 2, section_id: 's2' }),
    card({ id: 'b1', sequence_order: 3, section_id: 's2' }),
    card({ id: 'b2', sequence_order: 4, section_id: 's2' }),
    card({ id: 'b3', sequence_order: 5, section_id: 's2' }),
    card({ id: 'b4', sequence_order: 6, section_id: 's2' }),
    card({ id: 'b5', sequence_order: 7, section_id: 's2' }),
  ];
  const stops = buildStops(cards, { maxCardsPerStop: 3 });
  assert.equal(stops[0].cardIds.length, 2);
  assert.equal(stops[0].sectionId, 's1');
  assert.equal(stops[1].cardIds.length, 3);
  assert.equal(stops[2].cardIds.length, 3);
  assert.equal(stops.length, 3);
});

test('getCurrentStop uses progress.current_index within card ranges', () => {
  const cards = [0, 1, 2, 3, 4].map((i) => card({ id: `c${i}`, sequence_order: i }));
  const stops = buildStops(cards, { maxCardsPerStop: 3 });
  const progress = {
    id: 'p',
    article_id: 'a1',
    mode: 'card' as const,
    current_index: 3,
    completed_count: 3,
    total_count: 5,
    last_read_at: '2026-01-01T00:00:00.000Z',
  } satisfies LearningProgress;
  const current = getCurrentStop(stops, progress);
  assert.equal(current?.id, stops[1].id);
});

test('isStopComplete is true when current_index is past stop end', () => {
  const cards = [0, 1, 2, 3].map((i) => card({ id: `c${i}`, sequence_order: i }));
  const stops = buildStops(cards, { maxCardsPerStop: 2 });
  const progress = {
    id: 'p',
    article_id: 'a1',
    mode: 'card' as const,
    current_index: 2,
    completed_count: 2,
    total_count: 4,
    last_read_at: '2026-01-01T00:00:00.000Z',
  } satisfies LearningProgress;
  assert.equal(isStopComplete(stops[0], progress), true);
  assert.equal(isStopComplete(stops[1], progress), false);
});
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `node --test src/utils/stops.test.ts`

Expected: FAIL (module not found or exports missing).

- [ ] **Step 3: Implement `src/utils/stops.ts`**

```ts
import type { Card, LearningProgress } from '../types';
import type { Stop } from '../types';

const DEFAULT_MAX = 5;

function sortedCards(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => a.sequence_order - b.sequence_order);
}

function chunkCards(cards: Card[], maxCardsPerStop: number): Card[][] {
  const groups: Card[][] = [];
  for (let i = 0; i < cards.length; i += maxCardsPerStop) {
    groups.push(cards.slice(i, i + maxCardsPerStop));
  }
  return groups;
}

function groupBySectionThenSplit(cards: Card[], maxCardsPerStop: number): Card[][] {
  const hasAnySection = cards.some((c) => c.section_id);
  if (!hasAnySection) return chunkCards(cards, maxCardsPerStop);

  const sectionGroups: Card[][] = [];
  let bucket: Card[] = [];
  let currentSection: string | null | undefined = cards[0]?.section_id;

  for (const c of cards) {
    const sid = c.section_id ?? null;
    if (bucket.length === 0) {
      bucket = [c];
      currentSection = sid;
      continue;
    }
    if (sid === currentSection) {
      bucket.push(c);
    } else {
      sectionGroups.push(bucket);
      bucket = [c];
      currentSection = sid;
    }
  }
  if (bucket.length) sectionGroups.push(bucket);

  const result: Card[][] = [];
  for (const group of sectionGroups) {
    if (group.length <= maxCardsPerStop) result.push(group);
    else result.push(...chunkCards(group, maxCardsPerStop));
  }
  return result;
}

export function buildStops(
  cards: Card[],
  options?: { maxCardsPerStop?: number }
): Stop[] {
  const maxCardsPerStop = options?.maxCardsPerStop ?? DEFAULT_MAX;
  const ordered = sortedCards(cards);
  const groups = groupBySectionThenSplit(ordered, maxCardsPerStop);
  let offset = 0;
  return groups.map((group, index) => {
    const start = offset;
    const end = offset + group.length - 1;
    offset += group.length;
    const sectionId = group[0]?.section_id ?? undefined;
    return {
      id: `stop-${index}`,
      index,
      label: `第 ${index + 1} 关 · ${group.length <= 3 ? '约 2 分钟' : '约 3 分钟'}`,
      cardIds: group.map((c) => c.id),
      cardRange: [start, end],
      sectionId: sectionId || undefined,
    };
  });
}

export function getCurrentStop(
  stops: Stop[],
  progress: LearningProgress | null
): Stop | null {
  if (!stops.length) return null;
  const idx = progress?.current_index ?? 0;
  const found = stops.find((s) => idx >= s.cardRange[0] && idx <= s.cardRange[1]);
  if (found) return found;
  if (idx > stops[stops.length - 1].cardRange[1]) return null;
  return stops[0];
}

export function isStopComplete(
  stop: Stop,
  progress: LearningProgress | null
): boolean {
  if (!progress) return false;
  return progress.current_index > stop.cardRange[1];
}
```

Re-export `Stop` from types only (remove duplicate import if you inlined the interface solely in types).

- [ ] **Step 4: Run tests — expect PASS**

Run: `node --test src/utils/stops.test.ts`

Expected: PASS (4 tests).

- [ ] **Step 5: Wire package test script**

If `package.json` `"test"` does not include `src/utils/*.test.ts`, change to:

```json
"test": "node --test src/services/*.test.ts src/utils/*.test.ts supabase/functions/_shared/*.test.ts"
```

Run: `npm test` (or `pnpm test`) — existing + new utils tests should pass.

- [ ] **Step 6: Commit**

```bash
git add src/types/index.ts src/utils/stops.ts src/utils/stops.test.ts package.json
git commit -m "$(cat <<'EOF'
Add derived 关卡 stops utility for continue-first reading.

Group cards by optional section_id and split oversized sections so streak can key off stop completion.
EOF
)"
```

---

### Task 2: Soft streak freeze helper

**Files:**
- Create: `src/utils/streakFreeze.ts`
- Create: `src/utils/streakFreeze.test.ts`
- Modify: `src/utils/streak.ts` — add `hasRecordedStreakOn(date?: Date): boolean`

**Interfaces:**
- Produces:
  - `getFreeRestoresRemaining(): number`
  - `consumeFreeRestore(): boolean`
  - `DEFAULT_FREE_RESTORES = 2` (v1 period allotment stored in localStorage)
- Consumes: localStorage pattern from `streak.ts`

- [ ] **Step 1: Failing tests for freeze inventory**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_FREE_RESTORES,
  consumeFreeRestore,
  getFreeRestoresRemaining,
  resetFreezeStoreForTests,
} from './streakFreeze.ts';

test('starts with default free restores', () => {
  resetFreezeStoreForTests();
  assert.equal(getFreeRestoresRemaining(), DEFAULT_FREE_RESTORES);
});

test('consumeFreeRestore decrements until empty', () => {
  resetFreezeStoreForTests();
  assert.equal(consumeFreeRestore(), true);
  assert.equal(getFreeRestoresRemaining(), DEFAULT_FREE_RESTORES - 1);
  resetFreezeStoreForTests();
  for (let i = 0; i < DEFAULT_FREE_RESTORES; i++) assert.equal(consumeFreeRestore(), true);
  assert.equal(consumeFreeRestore(), false);
  assert.equal(getFreeRestoresRemaining(), 0);
});
```

Add to `streak.ts`:

```ts
export function hasRecordedStreakOn(date: Date = new Date()): boolean {
  const store = readStore();
  return store.lastDate === toDateKey(date);
}
```

(Export `toDateKey` only if tests need it; otherwise keep private.)

- [ ] **Step 2: Run freeze tests — expect FAIL**

Run: `node --test src/utils/streakFreeze.test.ts`

- [ ] **Step 3: Implement `streakFreeze.ts`**

```ts
const FREEZE_KEY = 'fragmentArticle.streakFreeze';
export const DEFAULT_FREE_RESTORES = 2;

type FreezeStore = { remaining: number };

function read(): FreezeStore {
  if (typeof window === 'undefined') return { remaining: DEFAULT_FREE_RESTORES };
  try {
    const raw = window.localStorage.getItem(FREEZE_KEY);
    if (!raw) return { remaining: DEFAULT_FREE_RESTORES };
    const parsed = JSON.parse(raw) as FreezeStore;
    return { remaining: typeof parsed.remaining === 'number' ? parsed.remaining : DEFAULT_FREE_RESTORES };
  } catch {
    return { remaining: DEFAULT_FREE_RESTORES };
  }
}

function write(store: FreezeStore): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(FREEZE_KEY, JSON.stringify(store));
}

export function getFreeRestoresRemaining(): number {
  return read().remaining;
}

export function consumeFreeRestore(): boolean {
  const store = read();
  if (store.remaining <= 0) return false;
  write({ remaining: store.remaining - 1 });
  return true;
}

/** Test-only reset; also usable from Profile debug later */
export function resetFreezeStoreForTests(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(FREEZE_KEY);
}
```

For Node tests without `window`, use a module-level fallback memory when `window` is undefined (mirror `streak.ts` SSR guards, but allow tests to inject):

```ts
let memory: FreezeStore | null = null;

function read(): FreezeStore {
  if (typeof window === 'undefined') {
    if (!memory) memory = { remaining: DEFAULT_FREE_RESTORES };
    return memory;
  }
  // ... localStorage path
}

export function resetFreezeStoreForTests(): void {
  memory = { remaining: DEFAULT_FREE_RESTORES };
  if (typeof window !== 'undefined') window.localStorage.removeItem(FREEZE_KEY);
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `node --test src/utils/streakFreeze.test.ts src/utils/stops.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/utils/streak.ts src/utils/streakFreeze.ts src/utils/streakFreeze.test.ts
git commit -m "$(cat <<'EOF'
Add free streak restore inventory for soft habit protection.

Keep restores local and limited so early misses do not feel punitive.
EOF
)"
```

---

### Task 3: Path generator uses stops

**Files:**
- Modify: `src/utils/pathGenerator.ts`
- Create: `src/utils/pathGenerator.test.ts`

**Interfaces:**
- Consumes: `buildStops` from `./stops.ts`
- Produces: same `PathNode` shape; card nodes correspond 1:1 to stops (`id: stop.id`, `cardRange` from stop)

- [ ] **Step 1: Failing test — card nodes match stop boundaries**

```ts
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Card } from '../types';
import { generateLearningPath } from './pathGenerator.ts';
import { buildStops } from './stops.ts';

function card(i: number, section_id?: string): Card {
  return {
    id: `c${i}`,
    article_id: 'a',
    content: 't',
    sequence_order: i,
    semantic_label: 'x',
    context_summary: '',
    created_at: '2026-01-01T00:00:00.000Z',
    section_id: section_id ?? null,
  };
}

test('generateLearningPath card nodes align with buildStops', () => {
  const cards = [0, 1, 2, 3, 4, 5].map((i) => card(i));
  const stops = buildStops(cards, { maxCardsPerStop: 3 });
  const nodes = generateLearningPath({
    cards,
    quizzes: [],
    progress: null,
    claimedMilestones: [],
    cardsPerNode: 3,
  });
  const cardNodes = nodes.filter((n) => n.type === 'card');
  assert.equal(cardNodes.length, stops.length);
  assert.deepEqual(cardNodes[0].cardRange, stops[0].cardRange);
  assert.equal(cardNodes[0].id, stops[0].id);
});
```

- [ ] **Step 2: Run — expect FAIL** (ids still `card-0`)

- [ ] **Step 3: Update `generateLearningPath` to use `buildStops`**

Replace the `chunkArray(cards, cardsPerNode)` card node construction with:

```ts
import { buildStops } from './stops';

// inside generateLearningPath:
const stops = buildStops(cards, { maxCardsPerStop: cardsPerNode ?? 5 });
const cardNodes: PathNode[] = stops.map((stop) => ({
  id: stop.id,
  type: 'card',
  status: 'available',
  label: stop.label,
  cardIds: stop.cardIds,
  cardRange: stop.cardRange,
}));
```

Keep quiz/chest interleaving logic; update `currentNodeIndex` resolution to use stop `cardRange` the same way as today with groups.

- [ ] **Step 4: Run — expect PASS**

Run: `node --test src/utils/pathGenerator.test.ts src/utils/stops.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/utils/pathGenerator.ts src/utils/pathGenerator.test.ts
git commit -m "$(cat <<'EOF'
Drive learning path card nodes from 关卡 stops.

Keep quiz and chest nodes optional so the path matches stop-scoped Continue.
EOF
)"
```

---

### Task 4: Bottom tabs → Home / + / Library

**Files:**
- Modify: `src/components/BottomTabBar.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- `TabKey` becomes `'home' | 'create' | 'profile'` (Library maps to existing `profile` page content for materials+account; drop dedicated `reader` tab from the bar).
- Reader remains a full-screen view without a selected tab highlight fighting Home — when `view.tab === 'reader'`, highlight `home` (or last non-reader tab).

- [ ] **Step 1: Change `BottomTabBar` to three tabs**

```tsx
export type TabKey = 'home' | 'create' | 'profile';

const tabs: Array<{ key: TabKey; label: string; icon: ReactNode }> = [
  { key: 'home', label: '首页', icon: <Home className="w-5 h-5" /> },
  { key: 'create', label: '', icon: <PlusCircle className="w-7 h-7" /> }, // center +
  { key: 'profile', label: '书库', icon: <BookOpen className="w-5 h-5" /> },
];
```

Use `grid-cols-3`. Center tab: visually emphasize `+` (larger icon, aria-label `导入`). Label for profile/Library: `书库` (materials + account entry stays on Profile page for this slice).

- [ ] **Step 2: Update `App.tsx` `handleTabChange` / `activeTab`**

- Remove `reader` from `TabKey` usage in the bar.
- When opening reader, do not require a reader tab; set `resolvedActiveTab` to `'home'` while reading (or keep previous `readerEntryTab` but only among `home | create | profile`).
- Delete dead branches that set `tab: 'reader'` via tab bar.

Manual check: tap Home / + / 书库; open a card reader; tab bar still shows and does not show a fourth Reading tab.

- [ ] **Step 3: Commit**

```bash
git add src/components/BottomTabBar.tsx src/App.tsx
git commit -m "$(cat <<'EOF'
Simplify tab bar to Home, import, and Library.

Match continue-first IA and drop the dedicated reading tab.
EOF
)"
```

---

### Task 5: Home Continue hero

**Files:**
- Modify: `src/pages/Home.tsx`
- Modify: `src/App.tsx` — pass `onContinue` that opens card reader at current stop

**Interfaces:**
- Extend `HomeProps`:

```ts
onContinue?: (payload: { articleId: string; startIndex: number; stopId: string }) => void;
```

- Home computes `continueTarget` via `buildStops` + `getCurrentStop` + last-touched article (`getDefaultArticleId` already uses activity time).

- [ ] **Step 1: Add Continue CTA above the path**

UI requirements (structure, keep existing Tailwind vocabulary):

1. Soft streak line: `今日还差 1 关` / `今日已打卡` using `hasRecordedStreakOn()` + whether any stop completed today (for this slice, `hasRecordedStreakOn` is enough once Task 6 wires streak on stop complete).
2. Primary button: `继续 · {article.title}` → `onContinue`.
3. Secondary list: other in-progress articles (progress.completed_count < total); tap switches selection or continues that article.
4. Remove or demote the floating `Plus` FAB if center tab already covers import (prefer remove FAB to avoid duplicate `+`).
5. Keep LearningPath below as secondary overview; wire `onOpenNode` from App to open card mode at `node.cardRange[0]` when `onOpenNode` provided.

- [ ] **Step 2: Wire App Continue → CardReader**

In `App.tsx`, when Continue fires:

```ts
setView({
  tab: 'reader',
  articleId,
  mode: 'card',
  // If View type has no startIndex, set a React state `readerStartIndex` / `readerStopId` and pass to CardReader
});
```

Extend local view state as needed:

```ts
type View =
  | { tab: 'home'; articleId?: string }
  | { tab: 'create' }
  | { tab: 'profile' }
  | { tab: 'reader'; articleId: string; mode: LearningMode | 'original' | 'quiz'; startIndex?: number; stopId?: string };
```

Pass `initialIndex={view.startIndex}` and `stopId={view.stopId}` into `CardReader`.

- [ ] **Step 3: Manual verify**

With an article that has cards and progress mid-way: Home shows Continue; tap opens CardReader near current stop, not ArticleHub.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Home.tsx src/App.tsx
git commit -m "$(cat <<'EOF'
Put Continue at the center of Home.

Open the current 关卡 directly and demote the path to secondary navigation.
EOF
)"
```

---

### Task 6: CardReader stop session + streak on stop complete

**Files:**
- Modify: `src/pages/CardReader.tsx`
- Modify: callers that invoke `recordStreak` on every card (move to stop boundary)

**Interfaces:**
- New optional props:

```ts
initialIndex?: number;
stopId?: string; // if set, clamp navigation to that stop's cardRange until stop cleared
```

- On advancing past the last card of the stop: call `recordStreak({ forceShow: true })`, show stop-complete UI (reuse celebration patterns if any), then allow “下一关” / “回首页”.

- [ ] **Step 1: Locate existing `recordStreak` calls in CardReader**

Remove or gate streak so **card flip does not** call `recordStreak`. Keep milestone/points logic as-is unless it conflicts.

- [ ] **Step 2: Resolve stop bounds**

When `CardReader` loads cards:

```ts
const stops = buildStops(cards);
const activeStop =
  (stopId && stops.find((s) => s.id === stopId)) ||
  getCurrentStop(stops, progress);
const [rangeStart, rangeEnd] = activeStop?.cardRange ?? [0, cards.length - 1];
```

Clamp `currentIndex` into `[rangeStart, rangeEnd]` while in stop session. When user finishes the last card of the stop (index moves past `rangeEnd` or explicit “完成本关”):

```ts
const result = recordStreak({ forceShow: true });
// show streak modal if result.shouldShow
```

- [ ] **Step 3: Soft copy**

End-of-stop sheet: `本关完成！连续学习 N 天` + buttons `下一关` (next stop startIndex) and `先这样` (back home).

- [ ] **Step 4: Manual verify**

Completing cards inside a stop does not change streak until the last card of the stop is done; then streak increments once per day.

- [ ] **Step 5: Commit**

```bash
git add src/pages/CardReader.tsx
git commit -m "$(cat <<'EOF'
Scope card reading to one 关卡 and credit streak on stop clear.

Keep per-card motion light and reserve the daily habit win for finishing a stop.
EOF
)"
```

---

### Task 7: ArticleHub cards-primary

**Files:**
- Modify: `src/pages/ArticleHub.tsx`

- [ ] **Step 1: Primary actions**

- Keep / emphasize `继续看看` (card mode) as the main button.
- Move dialogue / galgame generate-or-open controls into a collapsed `更多形式` disclosure (details/summary or secondary text button).
- Quiz: keep as secondary button “测验” (on-demand remains Plan 3; do not remove entry).

- [ ] **Step 2: Manual verify**

Hub no longer presents three equal mode heroes; cards are obvious.

- [ ] **Step 3: Commit**

```bash
git add src/pages/ArticleHub.tsx
git commit -m "$(cat <<'EOF'
Make ArticleHub cards-primary and tuck other modes away.

Align the hub with continue-first without deleting deferred mode code.
EOF
)"
```

---

### Task 8: Profile as Library shell + freeze visibility

**Files:**
- Modify: `src/pages/Profile.tsx`

- [ ] **Step 1: Surface library + streak protection**

- Ensure Profile/书库 lists materials (or deep-links clearly to home selection if list already lives on Home — prefer a simple article list here matching “Library”).
- Show `剩余免费补签：{getFreeRestoresRemaining()}` and a button `补签昨天` that:
  - calls `consumeFreeRestore()`
  - if true, manually sets streak store continuity for yesterday→today only if broken (minimal: call a new `applyFreezeRestore()` in `streakFreeze.ts` that sets `lastDate` to yesterday and increments days, or documents “restore keeps count without break” — implement the smallest honest behavior: if `lastDate` is before yesterday, set `lastDate` to yesterday and keep `days` unchanged so today’s stop can continue the chain).

Implement `applyFreezeRestore()` in `streakFreeze.ts` with a unit test:

```ts
test('applyFreezeRestore returns false when no restores left', () => {
  resetFreezeStoreForTests();
  for (let i = 0; i < DEFAULT_FREE_RESTORES; i++) consumeFreeRestore();
  assert.equal(applyFreezeRestore(), false);
});
```

Exact streak repair helper:

```ts
// in streak.ts
export function repairStreakGapWithFreeze(): boolean {
  const store = readStore();
  const today = toDateKey(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = toDateKey(yesterday);
  if (store.lastDate === today || store.lastDate === yesterdayKey) return false;
  writeStore({ ...store, lastDate: yesterdayKey });
  return true;
}
```

`applyFreezeRestore` = `consumeFreeRestore() && repairStreakGapWithFreeze()` (if repair returns false, do not consume — order: check gap first, then consume, then repair).

- [ ] **Step 2: Tests + commit**

```bash
git add src/pages/Profile.tsx src/utils/streak.ts src/utils/streakFreeze.ts src/utils/streakFreeze.test.ts
git commit -m "$(cat <<'EOF'
Expose Library tab streak protection with free restores.

Let users repair a soft gap without turning streak loss into punishment.
EOF
)"
```

---

## Plan Self-Review

| Spec area | Task coverage |
|-----------|----------------|
| Home Continue + switch materials + center `+` | Tasks 4–5 |
| 关卡 hybrid semantic + split | Task 1, 3 |
| Streak on 关卡 complete; soft free restores | Tasks 2, 6, 8 |
| Cards primary; chat/VN deferred | Task 7 |
| Sample-first guest / AI login gate | **Plan 2** (explicitly out) |
| On-demand quiz prompt / import landing | **Plan 3** (explicitly out) |
| Motion/haptic polish | **Plan 3** (optional vibrate can be tiny in Task 6 if trivial) |

Placeholder scan: none intentional; sample/auth deferred by roadmap.  
Type consistency: `Stop` in `types`; path node ids = `stop.id`; View `startIndex` / `stopId` threaded App → CardReader.

---

## Execution Handoff

Plan complete and saved to `Docs/superpowers/plans/2026-08-08-continue-first-spine.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks  
2. **Inline Execution** — run tasks in this session with executing-plans checkpoints  

**Which approach?** After Plan 1 ships, we write Plan 2 (sample-first auth gate) the same way.
