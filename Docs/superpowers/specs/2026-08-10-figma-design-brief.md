# FragmentStudy — Figma Design Brief

**Date:** 2026-08-10 · updated 2026-08-23  
**Purpose:** Feed this document to a design AI / designer to produce **mobile-first Figma frames**. Not an engineering plan.  
**Product source of truth:** `Docs/superpowers/specs/2026-08-08-continue-first-product-redesign-design.md`  
**App working name:** FragmentStudy (aka FragmentArticle)  
**Tagline (for marketing surfaces only):** 把长文拆成关卡，一口一口学完

---

## 0. How to use this brief

1. Design **mobile** first (390×844 or similar iPhone frame). Desktop can be a stretched/centered phone shell later.  
2. Deliver **high-fidelity screens** + a small **component set**, not a full design system from scratch.  
3. Prefer **one clear primary action per screen**.  
4. Do **not** invent chat mode, visual novel, pets, world maps, leaderboards, or a shop. **Do** design a Duolingo-style **关卡 path with gift chests** and a **celebration** after each stop.  
5. Output frame names matching the **Screen IDs** below so engineering can map 1:1 later.

---

## 1. Product in one paragraph

FragmentStudy helps people who stall on long texts. Guests try a **sample** material with no AI. After login, they paste/import content (title optional — AI names it if blank); AI **distills** important core ideas into **cards** (not raw chops) grouped into **关卡 (stops)** (~2–4 min each). Every card **links back to its original passage** for 查证 / deep-read. Home shows that material’s **path of steps + gifts**; **Continue** starts the current stop. Finishing a stop plays a **celebration** (and opens a chest if that node is a gift) and keeps a **soft streak**. Selecting text: **AI explain** first, plus **highlight** and **note**. Quiz is optional and never blocks progress.

---

## 2. Visual direction (for Figma AI)

**Feel:** Light, encouraging, a bit game-like — a **readable trail** with gifts and celebrations, not a loud arcade. Duolingo *shape* (path, chests, streak flame, stop-clear party), not Duolingo *guilt* or a shop.

**Do**
- Home = **one material’s path** (steps + chests) with Continue on the current node  
- Readable body text on cards (reading still comes first in the reader)  
- Designed celebration after each 关卡 (chest-open, burst, streak) — annotate motion  
- Warm accent for streak / gifts / success; calmer surfaces for reading  

**Don’t**
- Purple-on-white / purple–indigo gradient defaults  
- Dark “AI glassmorphism” with glow everywhere  
- Cream + terracotta “AI editorial” cliché unless brand later chooses it  
- Pill spam, stat strips, floating badge stickers crowding the path  
- Hide the path behind a single Continue card with no trail  
- Pets, leaderboards, world map of all articles, or a points shop

**Suggested tokens (designer may refine)**
- Background: soft warm-neutral or cool-neutral light (`#FAFAF8`–`#F5F7FA` range)  
- Primary: single confident accent (e.g. teal/ink blue — pick one, stay consistent)  
- Text: near-black body, muted secondary  
- Success / streak: amber or coral for flame only  
- Radius: medium (12–20px), not pill-everything  
- Type: distinctive readable sans for UI; slightly softer face for card body OK — avoid Inter/Roboto/Arial as the *only* voice if alternatives are available in Figma

---

## 3. Information architecture

```text
Bottom tabs (3):
  [ Home ]   [  +  ]   [ Library ]

Home     → streak + **current material 关卡 path (steps + gifts)** + Continue on current node
           (+ quiet switcher for other in-progress materials)
+        → Import flow (or Login gate if guest)
Library  → materials + account / settings entry

Overlay / stack (not tabs):
  Card Reader (关卡 session)
  Selection toolbar (讲解 / 高亮 / 笔记)
  Explain sheet
  Note sheet (short)
  Stop complete celebration (+ chest open)
  Quiz (optional)
  Original text (optional)
  Auth / Login
  Soft “save progress” prompt
```

**No** floating `+` FAB on Home (center tab is enough).  
**No** dedicated “Reading” tab.

---

## 4. Screen inventory (build these frames)

| ID | Screen | Priority | Notes |
|----|--------|----------|-------|
| H-01 | Home — Guest + sample path | P0 | Path + Continue on sample |
| H-02 | Home — Logged in, in progress | P0 | Path + gifts + current node Continue |
| H-03 | Home — Logged in, empty | P0 | CTA to import |
| H-04 | Home — Today’s stop done | P1 | Path node just cleared; soft “今日已打卡” |
| H-05 | Home — Chest on path (unopened upcoming) | P1 | Gift visible before the stop |
| I-01 | Import — source picker | P0 | Paste / link / file |
| I-02 | Import — paste editor | P0 | **Content-first**; title optional/collapsed |
| I-03 | Import — processing | P0 | Waiting for AI split (+ title if blank) |
| I-04 | Import — ready / success | P1 | AI or user title + first 关卡 |
| A-01 | Auth — login / register | P0 | From `+` or soft prompt |
| A-02 | Soft login prompt | P0 | After sample 关卡 win |
| R-01 | Card Reader — mid 关卡 | P0 | Distilled card + clear **原文** entry |
| R-02 | Card Reader — text selected | P0 | Toolbar: 讲解 (primary), 高亮, 笔记 |
| R-03 | Explain sheet | P0 | Logged-in; presets |
| R-03b | Note sheet | P1 | Short note on selection |
| R-04 | Stop complete celebration | P0 | Animation + streak + points |
| R-04b | Chest open (if gift node) | P0 | Can be a beat inside R-04 |
| R-05 | Soft quiz prompt | P1 | Skip always visible |
| L-01 | Library — list | P0 | In progress / done |
| L-02 | Material overview | P0 | Full path + gifts + Continue + Quiz |
| L-03 | Account / settings entry | P1 | Login state, streak restore |
| Q-01 | Quiz — question | P1 | Optional path |
| Q-02 | Quiz — result | P1 | Optional |
| O-01 | Original text — from card | P0 | Linked passage highlighted; back to card |

---

## 5. Screen specs

### Shared: Bottom tab bar

- 3 slots: **首页** | **+** (center, larger) | **书库**  
- Center `+`: icon-only or “导入”; visually primary but must not outshine Home’s Continue when on Home.  
- Active state: clear but calm.  
- Safe-area padding for home indicator.

---

### H-01 Home — Guest

**Goal:** Feel the product in one tap; see the trail; no import yet.

**Layout (top → bottom)**
1. Compact streak row: flame + `连续 N 天` (may be 0) + points chip  
2. Sample title (small): e.g. `示例：如何开始读长文`  
3. **关卡 path (hero visual)** — vertical or snake trail of ~4–6 nodes:
   - Done (filled)
   - **Current** (larger, CTA `开始试学` / `继续` on or under the node)
   - Upcoming 关卡 (locked/dim)
   - At least one **gift chest** on the trail (upcoming, unopened)
4. Quiet hint: `导入自己的文章需要登录` (text link → Auth)  
5. Tab bar

**Empty/error:** N/A if sample always ships.

---

### H-02 Home — Logged in, in progress

**Layout**
1. Streak + points  
2. Status: `今日还差 1 关` **or** `今日已打卡` (see H-04)  
3. Current material title (one line)  
4. **关卡 path (main visual)**  
   - Nodes: 关卡 1…n (done / current / upcoming)  
   - **Gift chests** interleaved (e.g. after 关卡 2, 关卡 5, and a finish chest) — unopened chests look tempting; opened chests look claimed  
   - Current node: `继续` (or tap the node)  
5. Collapsed switcher: `其他进行中` — 2–5 rows; tap swaps which path is shown  
6. Tab bar — **no FAB**

**Do not** use subject filters or tag drawers on Home. The path *is* the home for the current material. Library holds the full list.

**Path design notes**
- Readable at a glance: “I’m here, gift is two stops ahead.”  
- Current node is the only loud control.  
- Chests are on the path, not a separate inventory screen.

---

### H-03 Home — Logged in, empty

- Friendly illustration or simple empty art (optional, not cluttered)  
- Headline: `放进一篇长文`  
- Sub: `我们会拆成小关卡，每天一口`  
- Primary CTA: `导入文章` → Import (`+` flow)  
- No guilt copy about unread piles

---

### H-04 Home — Stop done today

Same as H-02 but:
- Status: `今日已打卡 · 连续 N 天`  
- The node just finished looks celebrated (check / opened chest if it was a gift)  
- Continue still available on the **next** node: `再学一关` — slightly quieter than the first Continue of the day  
- Tone: proud, not “come back tomorrow or else”

### H-05 Chest on path

Show an upcoming **unopened chest** two nodes ahead of current, so the gift is a reason to keep going. Do not require a separate “rewards” tab.

---

### I-01 → I-04 Import

**I-01 Source picker**
- Title: `导入文章`  
- Options as simple list/rows (not mode theater): `粘贴文本` / `网页链接` / `PDF 文件`  
- Link/PDF: still **content-first** — no required title field; AI names the material if needed  
- No “卡片/对话/视觉小说” mode selector  
- No “生成测验” checkbox  

**I-02 Paste (content-first)**
- **Hero:** large body field. Placeholder: `把文章贴在这里`  
- **Title:** optional, visually secondary — collapsed by default or a small “标题（可选）” under the body. Placeholder: `不填将自动生成标题`  
- Do **not** put title above the body as an equal field (splits attention)  
- Primary: `开始拆分` (enabled when body has content; title not required)  
- Secondary: back  

**I-03 Processing**
- Calm progress: `正在提炼成关卡…`  
- Subline optional: `提炼核心要点，并关联原文`  
- If title was blank, also: `正在起一个标题`  
- Do not show fake multi-mode steps  

**I-04 Ready**
- `准备好了`  
- **Title shown here** (user’s, or AI-generated) + `共 N 关`  
- Primary: `开始第 1 关`  
- Secondary: `稍后再说` → Home with path + Continue ready  

**Guest hits `+`:** do not show I-01; show **A-01** or **A-02** styled as “登录后即可导入”.

---

### A-01 Auth

- Email + password (match existing product)  
- Login / Register toggle  
- Copy: `登录后可导入文章，并用 AI 讲解与测验`  
- Skip/back returns to Home sample  

### A-02 Soft login prompt (modal or sheet)

Triggered after guest completes a sample 关卡 (from R-04).  
- Title: `保存进度？`  
- Body: `登录后可导入自己的文章，并同步打卡`  
- Primary: `登录 / 注册`  
- Secondary: `先继续逛逛` (dismiss)

---

### R-01 Card Reader (关卡 session)

**Chrome**
- Top: back · material title (truncated) · **`原文`** (always visible — not buried)  
- Progress: `第 X 关 · 3/5` (within stop, not whole article %)  
- Main: **one distilled card** — core idea in readable language (not a long raw paste of the source)  
  - Optional subtle chip: semantic label (e.g. 概念 / 论点)  
  - Optional quiet line: `来自原文 · 点「原文」查看` if designers want extra clarity once  
- Bottom: back card / next card (or swipe affordance annotation)  
- Points flick on card complete (annotation: small +N)  
- Existing highlights on the card should be visible (tinted spans)

**Content rules for mock copy**
- Card text should look **refined / summarized**, not identical to a full paragraph dump  
- Designers: use short sample cards that feel “核心提炼,” then O-01 shows the longer original span

**Rules for design**
- Session visually scoped to **one 关卡**  
- No persistent dense toolbar; tools appear on **selection**  
- **原文** is a first-class escape hatch — easy to find on every card

### O-01 Original text — from card (P0)

- Full (or scrollable) original article  
- **Linked passage for this card highlighted** and scrolled into view  
- Chrome: back / `返回卡片` (returns to the same card, not Home)  
- Optional: “前后文” is just normal scroll — no extra mode  
- This is **verify / deep-read**, not a second learning path (no streak on original alone)

### R-02 Selection

Floating toolbar on selected sentence/phrase, **left-to-right**:
1. **讲解** — primary (filled / accent)
2. **高亮**
3. **笔记**

- Guest on sample: 讲解 → `登录后可用 AI 讲解` (or pre-authored tip); 高亮 / 笔记 may work locally on sample  
- Do not add underline, bold, or bookmark as extra toolbar items

### R-03 Explain sheet

- Presets as 2–3 chips: `更简单` / `打个比方` / `联系上文`  
- Answer area (streaming placeholder OK)  
- Close does not leave the card  

### R-03b Note sheet

- Small sheet: textarea + `保存` / `取消`  
- After save, span shows a discreet note mark; tap to reopen

### R-04 Stop complete

**Designed celebration — this is a hero moment, not a toast**
- Motion: burst / confetti / character bounce (annotate; 1.5–2.5s then CTAs visible)  
- Title: `本关完成！`  
- Streak: `连续学习 N 天` + flame  
- Points: `+XX`  
- If this node had a gift → play **R-04b** as a beat (chest opens, extra points) before or as part of the same screen  
- Primary: `下一关`  
- Secondary: `先这样` → Home (path node now done)  
- Tertiary: `花 30 秒测一下？` → R-05

### R-04b Chest open

- Chest illustration closed → open  
- Reward: points (and later freeze fuel)  
- Then same CTAs as R-04 (can be combined into one frame with two states)

### R-05 Soft quiz prompt

- `要不要随手测一下？约 30 秒`  
- `开始` / `跳过`  
- Skipping must feel first-class (not buried)

---

### L-01 Library

- Segments or filters: `进行中` / `已完成`  
- Rows: title, progress `第 X/Y 关`, last activity  
- Account entry: avatar/email or `登录` top-right  
- Free restore hint (compact): `免费补签剩余 N` → L-03  

### L-02 Material overview

- Title + overall progress  
- Same **关卡 path + gift chests** as Home (full trail, scrollable)  
- Primary: `继续本关`  
- Secondary: `测验` (optional)  
- No equal-weight Chat / Galgame mode cards  

### L-03 Account / settings

- Login state  
- Streak + `免费补签` button  
- Settings entry (API/provider if needed — keep visually quiet)  
- Logout  

---

### Q-01 / Q-02 Quiz (optional)

- Single question focus, progress `1/5`  
- Result with short explanation  
- Exit always available; completing quiz is not required for streak  

---

## 6. Key UI copy bank (Chinese — primary UI)

| Context | Copy |
|---------|------|
| Tab Home | 首页 |
| Tab Import | 导入 |
| Tab Library | 书库 |
| Continue | 继续 |
| Start sample | 开始试学 |
| Status need stop | 今日还差 1 关 |
| Status done | 今日已打卡 |
| Import CTA empty | 放进一篇长文 |
| Paste placeholder | 把文章贴在这里 |
| Title optional | 标题（可选） |
| Title AI hint | 不填将自动生成标题 |
| Processing | 正在提炼成关卡… |
| Processing title | 正在起一个标题 |
| Original | 原文 |
| Back to card | 返回卡片 |
| From original hint | 来自原文 · 点「原文」查看 |
| Stop done | 本关完成！ |
| Chest | 礼物 |
| Next stop | 下一关 |
| Done for now | 先这样 |
| Soft quiz | 花 30 秒测一下？ |
| Skip quiz | 跳过 |
| Soft auth | 保存进度？ |
| Auth benefit | 登录后可导入自己的文章，并同步打卡 |
| Guest + gate | 导入文章需要登录 |
| Explain | 讲解 |
| Highlight | 高亮 |
| Note | 笔记 |
| Explain presets | 更简单 / 打个比方 / 联系上文 |
| Restore | 免费补签 |

English equivalents optional for a second locale frame set; **v1 frames use Chinese**.

---

## 7. Component checklist (Figma)

Create as components where reused:
- Bottom tab bar (3 states)  
- Streak chip + points chip  
- **关卡 path node** (done / current / upcoming)  
- **Gift chest** (locked / unopened / opened)  
- Continue control on current node  
- In-progress material row (switcher)  
- Card surface (reader)  
- Selection toolbar (讲解 / 高亮 / 笔记)  
- Sheet / modal scaffold  
- Primary / secondary / tertiary buttons  
- Celebration motif (burst + flame + chest-open)  

---

## 8. Motion annotations (for prototype / sticky notes on frames)

| Event | Motion note |
|-------|-------------|
| Card complete | Short settle / check; optional haptic; tiny `+N` |
| Advance card | Light horizontal or fade |
| 关卡 complete | **Celebration 1.5–2.5s** (burst/confetti), then CTAs stay on screen |
| Chest open | Lid open + reward pop; can chain after 关卡 complete |
| Streak up | Flame pulse on R-04 / Home |
| Path node complete | Node fills; Home path updates when returning |

Celebrations are **in scope and should be designed** (states + motion notes). Do not ship a 8s unskippable cutscene.

---

## 9. Explicit out of scope for this Figma set

- Chat / 群聊 mode screens  
- Visual novel / Galgame screens  
- Mode picker at import  
- Daily quest board, leaderboards, pets, **world maps of all articles**, card rarities, shop  
  (path + chests on the **current material** are in scope)  
- Complex subject/tag taxonomies as primary nav  
- Desktop-first marketing landing (optional later)  
- Dark mode (optional later; design light first)

---

## 10. Suggested Figma page structure

```text
📄 00 Cover — product one-liner + principles
📄 01 Flows — guest sample → login → import → continue habit
📄 02 Home (path + chests)
📄 03 Import & Auth (content-first paste)
📄 04 Reader, selection tools, Stop complete + chest
📄 05 Library & Material
📄 06 Quiz (optional)
📄 07 Components
📄 08 Out of scope (reference only)
```

---

## 11. Acceptance checklist for the Figma deliverable

- [ ] Guest loop: H-01 (path) → R-01 → R-04 (+ chest if gifted) → A-02  
- [ ] Logged-in habit: H-02 (path + gift visible) → R-01 → R-04 → H-04  
- [ ] Home shows **steps + gifts**; Continue sits on the **current node**  
- [ ] Cards look **distilled**; **原文** is visible on R-01 and O-01 highlights the linked span + `返回卡片`  
- [ ] Import I-02 is **content-first**; title optional / collapsed  
- [ ] Selection toolbar: **讲解** primary, plus **高亮** and **笔记** only  
- [ ] No mode picker; cards-only reader  
- [ ] Quiz always skippable  
- [ ] `+` is center tab only (no Home FAB)  
- [ ] Soft streak tone (no shame empty states)  
- [ ] Screen IDs match this brief  

---

## 12. Handoff note for the next coding agent (later)

Implement from **Figma + this brief +** `2026-08-08-continue-first-product-redesign-design.md`.  
Ignore `Docs/superpowers/plans/2026-08-08-continue-first-spine.md` until explicitly starting engineering; it is an optional code plan, not a design dependency.
