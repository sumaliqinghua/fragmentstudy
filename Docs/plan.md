# 界面改造计划（移动端优先 · 多邻国风格）

## 整体架构

### 底部 Tab 导航（4 Tab）
| Tab | 图标 | 页面 | 说明 |
|-----|------|------|------|
| 首页 | `home` | Home | 学习路径闯关 + 当前文章 |
| 新建 | `add` | Create | 导入/粘贴/AI 生成 |
| 阅读 | `menu_book` | Reader | 原文/群聊/Galgame 三合一 |
| 我的 | `person` | Profile | 统计/设置/登录 |

### 文章阅读界面三模式切换
在「阅读」Tab 内提供顶部 Segment 切换：
- **原文** — 带高亮标注的阅读器
- **群聊** — 微信风格对话学习
- **Galgame** — 视觉小说沉浸体验

---

## 核心数据结构（现有）

```typescript
// 文章
interface Article {
  id: string;
  title: string;
  original_content: string;
}

// 分段卡片（AI 生成）
interface Card {
  id: string;
  article_id: string;
  content: string;           // 卡片内容
  sequence_order: number;    // 顺序
  semantic_label: string;    // 语义标签
  context_summary: string;   // 上下文摘要
}

// 单选题（AI 生成）
interface QuizQuestion {
  id: string;
  article_id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  sequence_order: number;
}

// 学习进度
interface LearningProgress {
  article_id: string;
  current_index: number;     // 当前卡片索引
  completed_count: number;   // 已完成数
  total_count: number;       // 总数
}
```

---

## 首页闯关路径设计

### 路径节点类型

```typescript
type PathNodeType = 'card' | 'quiz' | 'chest';

interface PathNode {
  id: string;
  type: PathNodeType;
  status: 'completed' | 'current' | 'locked';
  // 卡片节点
  cardIds?: string[];        // 该节点包含的卡片 ID
  cardRange?: [number, number]; // 卡片范围 [start, end]
  // 问答节点
  quizIds?: string[];        // 该节点包含的题目 ID
  // 宝箱节点
  milestone?: 30 | 60 | 80;
  claimed?: boolean;
}
```

### 节点生成逻辑

```
每 2 张卡片 = 1 个卡片节点
每 1-2 道题 = 1 个问答节点（穿插在卡片节点之间）
30%/60%/80% 位置 = 宝箱节点

示例（10张卡片 + 5道题）：
┌─────────────────────────────────────┐
│  ✓  Card 1-2     (completed)        │
│  ✓  Quiz 1       (completed)        │
│  ★  Card 3-4     (current, pulse)   │
│  🔒 Quiz 2       (locked)           │
│  🔒 Card 5-6     (locked)           │
│  📦 30% Chest    (locked)           │
│  🔒 Card 7-8     (locked)           │
│  🔒 Quiz 3-4     (locked)           │
│  🔒 Card 9-10    (locked)           │
│  📦 60% Chest    (locked)           │
│  🔒 Quiz 5       (locked)           │
│  📦 80% Chest    (locked)           │
└─────────────────────────────────────┘
```

### 节点状态判定

```typescript
function getNodeStatus(nodeIndex: number, progress: LearningProgress): NodeStatus {
  const completedNodes = calculateCompletedNodes(progress);
  if (nodeIndex < completedNodes) return 'completed';
  if (nodeIndex === completedNodes) return 'current';
  return 'locked';
}
```

### 节点点击行为

| 节点类型 | 状态 | 点击行为 |
|----------|------|----------|
| 卡片节点 | current | 进入 CardReader，定位到该节点的第一张卡片 |
| 问答节点 | current | 进入 QuizReader，只显示该节点的题目 |
| 宝箱节点 | current | 弹出 TreasureBox，领取奖励 |
| 任意节点 | completed | 可重新进入复习 |
| 任意节点 | locked | 提示先完成前置节点 |

---

## 1) 视觉基线与移动端框架
- [ ] 提炼参考界面颜色体系写入 `tailwind.config.js`：
  - `primary: #58cc02` / `primary-dark: #46a302`
  - `secondary: #2b70c9` / `accent: #ffc800`
  - `surface-gray: #e5e5e5` / `locked-gray: #afafaf`
- [ ] 全局字体：Plus Jakarta Sans（标题）+ Noto Sans（正文）
- [ ] 建立移动端主容器：`max-w-md mx-auto`、安全区 padding、底部预留 Tab 高度（`pb-20`）
- [ ] 统一按钮风格：浮起阴影 `shadow-[0_4px_0_0_color]`、按压位移、圆角 `rounded-2xl`
- [ ] 卡片风格：`bg-slate-50 border border-slate-100 rounded-2xl` + hover 阴影

---

## 2) 底部 Tab Bar 导航
- [ ] 创建 `BottomTabBar` 组件，固定底部 `fixed bottom-0 z-50`
- [ ] 4 个 Tab 入口：首页/新建/阅读/我的
- [ ] 当前 Tab 高亮（`bg-primary/10 border-primary/20`）
- [ ] 安全区适配：`pb-safe` 或 `pb-[env(safe-area-inset-bottom)]`
- [ ] 更新 `App.tsx` 视图状态：
  ```ts
  type Tab = 'home' | 'create' | 'reader' | 'profile';
  type View =
    | { tab: 'home'; articleId?: string }      // 首页或文章闯关详情
    | { tab: 'create' }                         // 新建页
    | { tab: 'reader'; articleId: string; mode: 'original' | 'dialogue' | 'galgame' }
    | { tab: 'profile' };                       // 我的
  ```

---

## 3) 首页（Home Tab）

### 3.1) 顶部 Header
- [ ] 左侧「当前文章」下拉选择器
  - 显示当前文章标题 + 展开图标
  - 点击展开文章列表 Dropdown
  - 使用 `getArticles()` 获取数据
- [ ] 右侧状态指标
  - 连胜火苗 🔥 + 天数
  - 积分钻石 💎 + `getTotalPoints()`

### 3.2) 学习路径主体
- [ ] 新建 `src/utils/pathGenerator.ts`：

```typescript
interface GeneratePathOptions {
  cards: Card[];
  quizzes: QuizQuestion[];
  progress: LearningProgress | null;
  claimedMilestones: number[];
  cardsPerNode?: number;  // 默认 2
}

function generateLearningPath(options: GeneratePathOptions): PathNode[] {
  // 1. 按 cardsPerNode 分组卡片
  // 2. 按比例穿插问答节点
  // 3. 在 30%/60%/80% 位置插入宝箱节点
  // 4. 根据 progress.current_index 计算各节点状态
}
```

- [ ] 路径节点视觉样式：

| 状态 | 样式 |
|------|------|
| completed | `bg-primary` + ✓ 图标 + 星星评级 |
| current | `bg-primary` + ★ 图标 + 脉冲动画 + "START" 浮层 |
| locked | `bg-locked-gray` + 🔒 图标 |
| chest | 宝箱图标 📦 + 虚线边框 |

- [ ] 路径布局：纵向蛇形排列，左右交错
- [ ] 节点间连线：SVG 曲线或 CSS 伪元素

### 3.3) 节点点击交互
- [ ] 卡片节点 → `CardReader` 定位到对应卡片范围
- [ ] 问答节点 → `QuizReader` 只显示该节点题目
- [ ] 宝箱节点 → `TreasureBox` 弹窗
- [ ] 锁定节点 → Toast 提示 "请先完成前置关卡"

### 3.4) 空状态
- [ ] 无文章时显示引导：插画 + "导入你的第一篇文章"
- [ ] 有文章但未生成卡片：显示 "生成学习卡片" 入口

### 3.5) 右下悬浮按钮
- [ ] `+` 按钮跳转新建页
- [ ] 样式：`bg-secondary shadow-lg rounded-2xl`

---

## 4) 新建页（Create Tab）
- [ ] 全屏移动端页面，参考 `import_learning_material/code.html`
- [ ] 顶部标题：What do you want to **process** today?
- [ ] 三入口卡片：
  - 粘贴文章（`content_paste`）
  - 上传 PDF（`upload_file`）
  - AI 生成（`dataset` + New 标签）
- [ ] 下方「Jump back in」最近文章横向滚动列表
- [ ] 保留现有 `ArticleInput` 逻辑，改为底部 Sheet 或全屏表单

---

## 5) 阅读页（Reader Tab）— 三模式合一
- [ ] 顶部固定 Header：
  - 关闭/返回按钮
  - 中间进度条
  - 设置按钮
- [ ] 顶部 Segment 切换：原文 / 群聊 / Galgame
  - 使用 `rounded-full bg-slate-100` 容器 + 滑块高亮
- [ ] 根据当前 mode 渲染对应组件：
  - `original` → `OriginalTextView`（重构为阅读页样式）
  - `dialogue` → `DialogueReader`
  - `galgame` → `GalgameReader`
- [ ] 未生成内容时显示「生成」入口 + 角色设定弹窗

### 5.1) 原文阅读模式
- [ ] 参考 `material_reader/code.html` 布局：
  - 顶部大图 + 标题 + 难度/时长标签
  - 段落文字 20px、行高 1.8
  - 可点击词汇高亮样式 `interactive-word` / `active-word`
- [ ] 点击词汇弹出底部释义卡片（圆角 `rounded-[28px]`）
- [ ] 段落标注：左侧绿色边线 `highlight-sentence`
- [ ] 底部「Comprehension Check」按钮进入问答

### 5.2) 群聊模式
- [ ] 保持现有 `DialogueReader` 微信风格
- [ ] 长按气泡 → AI 问答侧边栏
- [ ] 共用顶部 Header 和 Segment

### 5.3) Galgame 模式
- [ ] 保持现有 `GalgameReader` 视觉小说风格
- [ ] 立绘/背景/情绪表情/屏幕特效
- [ ] 共用顶部 Header（半透明渐变）

---

## 6) 文章入口页（ArticleHub → 改为首页子页面）
- [ ] 从首页点击路径节点进入
- [ ] 显示文章标题、进度、各模式生成状态
- [ ] 模式入口改为横向卡片滚动或网格布局
- [ ] 主 CTA：「继续学习」→ 跳转阅读页对应模式

---

## 7) 知识卡片（CardReader）
- [ ] 调整为 Duolingo 卡片堆叠视觉：
  - 背卡层级、柔和投影
  - 顶部进度条
- [ ] 底部主按钮区：跳过 / 回退 / 完成
- [ ] 二级操作（原文/标记/问 AI/笔记）收纳到 Action Sheet
- [ ] 保留现有高亮、笔记、问 AI、书签逻辑

---

## 8) 智能问答（QuizReader）
- [ ] 顶部布局：进度条 + 生命值/连胜
- [ ] 问题区居中，答案卡片带按压阴影
- [ ] 答题反馈：正确绿 / 错误红 + 震动
- [ ] 主按钮「检查答案」样式：
  - `bg-primary shadow-[0_4px_0_0_#46a302]`

---

## 9) 连胜奖励弹窗（Streak）
- [ ] 基于 `TreasureBox` 改造为连胜庆祝弹窗
- [ ] 火苗图标 + 7 日日历
- [ ] 触发时机：完成关卡 / 达成里程碑

---

## 10) 个人中心（Profile Tab）
- [ ] 顶部用户信息：头像 + 昵称 + 登录状态
- [ ] 统计卡片网格：
  - 文章数（`getArticles().length`）
  - 总积分（`getTotalPoints()`）
  - 连胜天数
  - 学习进度
- [ ] 设置入口：API Key / 主题 / 通知
- [ ] 登录/退出按钮

---

## 11) 体验与验收
- [ ] 全站移动端布局：无水平溢出
- [ ] 点击区域 >= 44px
- [ ] 安全区适配（刘海/底部）
- [ ] 小屏测试（iPhone SE 375px）
- [ ] 大屏测试（iPhone 14 Pro Max 430px）
- [ ] 卡片/问答/原文核心流程可顺畅操作
- [ ] 视觉统一：颜色/圆角/阴影/字体

---

## 文件改动清单

| 文件 | 改动 | 优先级 |
|------|------|--------|
| `tailwind.config.js` | 新增颜色、阴影、字体配置 | P0 |
| `src/index.css` | 全局样式、动画 keyframes | P0 |
| `src/App.tsx` | Tab 导航状态、路由逻辑重构 | P0 |
| `src/components/BottomTabBar.tsx` | 新建底部导航组件 | P0 |
| `src/utils/pathGenerator.ts` | 学习路径节点生成逻辑（新文件） | P0 |
| `src/components/LearningPath.tsx` | 学习路径闯关 UI（新文件） | P0 |
| `src/components/PathNode.tsx` | 路径节点组件（新文件） | P0 |
| `src/pages/Home.tsx` | 重构为路径闯关首页 | P0 |
| `src/pages/Create.tsx` | 新建导入页（新文件） | P1 |
| `src/pages/ReaderPage.tsx` | 三模式阅读页容器（新文件） | P1 |
| `src/pages/Profile.tsx` | 个人中心页（新文件） | P1 |
| `src/components/SegmentControl.tsx` | 顶部模式切换组件（新文件） | P1 |
| `src/components/OriginalTextView.tsx` | 重构为阅读器样式 | P2 |
| `src/pages/ArticleHub.tsx` | 移除或简化 | P2 |
| `src/pages/CardReader.tsx` | Duolingo 卡片样式调整 | P2 |
| `src/pages/QuizReader.tsx` | 支持单题模式 + 样式调整 | P1 |

---

## 实现优先级

### Phase 1: 基础框架（P0）
1. Tailwind 配置 + 全局样式
2. 底部 Tab 导航
3. 路径生成逻辑
4. 首页闯关路径 UI

### Phase 2: 核心功能（P1）
1. 新建页
2. 阅读页（三模式切换）
3. 个人中心
4. QuizReader 单题模式

### Phase 3: 体验优化（P2）
1. 原文阅读器样式
2. 卡片样式调整
3. 动画与过渡效果

---

## 数据流示意

```
┌─────────────────────────────────────────────────────────┐
│                        App.tsx                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ state: { tab, articleId?, mode?, nodeIndex? }   │   │
│  └─────────────────────────────────────────────────┘   │
│                          │                              │
│         ┌────────────────┼────────────────┐            │
│         ▼                ▼                ▼            │
│    ┌─────────┐     ┌──────────┐     ┌──────────┐      │
│    │  Home   │     │  Reader  │     │ Profile  │      │
│    └────┬────┘     └────┬─────┘     └──────────┘      │
│         │               │                              │
│         ▼               ▼                              │
│  ┌─────────────┐  ┌──────────────┐                    │
│  │LearningPath │  │SegmentControl│                    │
│  │  ├─PathNode │  │ ├─Original   │                    │
│  │  ├─PathNode │  │ ├─Dialogue   │                    │
│  │  └─PathNode │  │ └─Galgame    │                    │
│  └─────────────┘  └──────────────┘                    │
│         │                                              │
│         ▼                                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │  CardReader / QuizReader / TreasureBox          │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```
