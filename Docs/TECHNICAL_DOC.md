# fragmentArticle 技术文档

最后更新: 2026-01-20

## 1. 项目概览

这是一个基于 **Vite + React + TypeScript + Tailwind** 的前端应用，结合 **Supabase** 作为后端与数据存储。核心目标是把文章拆成可学习的卡片，并提供多种学习模式与 AI 辅助功能：

- **卡片模式 (card)**: 逐卡片学习、上下文预览、标注高亮、书签、AI 问答、学习进度与奖励
- **对话模式 (dialogue)**: 文章转成角色对话，支持长按对话提问，保存 Q&A
- **视觉小说模式 (galgame)**: 文章转为视觉小说风格对话，带打字机效果和屏幕特效
- **原文查看**: 原文高亮、下划线、加粗标注，支持选中文本问 AI
- **用户体系**: 支持访客模式 (localStorage) 与 Supabase Auth 登录模式

---

## 2. 技术栈

| 类别 | 技术选型 |
|------|----------|
| 前端框架 | React 18, TypeScript |
| 构建工具 | Vite |
| UI 样式 | Tailwind CSS |
| 图标库 | lucide-react |
| 后端服务 | Supabase (Postgres + Auth + Edge Functions) |
| AI 接口 | 通过 Supabase Edge Function 转发到 OpenAI 兼容接口 |

---

## 3. 项目结构与模块划分

```
src/
├── App.tsx                    # 应用入口，视图切换 (Home / Reader)
├── main.tsx                   # React 渲染入口
├── index.css                  # Tailwind 样式入口
├── types/                     # 类型定义
│   └── index.ts              # 所有 TypeScript 接口定义
├── contexts/                  # React Context
│   └── AuthContext.tsx       # 认证状态管理
├── hooks/                     # 自定义 Hooks
│   └── useGesture.ts         # 手势识别 Hook
├── pages/                     # 页面级组件
│   ├── Home.tsx              # 首页：文章列表、导入、用户管理
│   └── CardReader.tsx        # 卡片阅读器：核心学习界面
├── components/                # UI 组件与功能模块
│   ├── ArticleInput.tsx      # 文章导入弹窗
│   ├── ArticleList.tsx       # 文章列表展示
│   ├── CardStack.tsx         # 卡片堆叠展示与交互
│   ├── AIChat.tsx            # AI 问答面板
│   ├── DialogueReader.tsx    # 对话模式阅读器
│   ├── GalgameReader.tsx     # 视觉小说阅读器
│   ├── OriginalTextView.tsx  # 原文查看与标注
│   ├── ContextPreview.tsx    # 上下文预览
│   ├── ProgressBar.tsx       # 进度条与里程碑
│   ├── TreasureBox.tsx       # 奖励领取弹窗
│   ├── ActionMenu.tsx        # 操作菜单
│   ├── SettingsModal.tsx     # 设置弹窗
│   ├── AuthModal.tsx         # 登录/注册弹窗
│   ├── WelcomeModal.tsx      # 访客欢迎弹窗
│   └── MarkdownRenderer.tsx  # Markdown 渲染组件
└── services/                  # 数据与 AI 服务层
    ├── dataService.ts        # 数据服务（自动切换 Supabase/本地）
    ├── guestStorage.ts       # 访客本地存储
    ├── openai.ts             # OpenAI API 封装
    └── supabase.ts           # Supabase 客户端

supabase/
├── functions/                 # Edge Functions
│   └── openai-proxy/         # OpenAI 代理函数
│       └── index.ts
└── migrations/               # 数据库迁移脚本

Docs/
└── TECHNICAL_DOC.md          # 本文档
```

---

## 4. 架构设计与数据流

### 4.1 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                        React 前端应用                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌──────────────┐  ┌────────────────────────────┐ │
│  │  Pages  │  │  Components  │  │        Contexts            │ │
│  │ ─────── │  │ ──────────── │  │ ────────────────────────── │ │
│  │ Home    │  │ CardStack    │  │ AuthContext (用户状态)      │ │
│  │ Reader  │  │ AIChat       │  └────────────────────────────┘ │
│  └────┬────┘  │ Dialogue...  │                                 │
│       │       └──────┬───────┘                                 │
│       └──────────────┼─────────────────────────────────────────│
│                      ▼                                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   Services 服务层                           ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐ ││
│  │  │ dataService  │  │   openai.ts  │  │  guestStorage.ts  │ ││
│  │  │ (路由层)      │  │  (AI 调用)   │  │  (本地存储)        │ ││
│  │  └──────┬───────┘  └──────┬───────┘  └─────────┬─────────┘ ││
│  │         │                 │                    │            ││
│  └─────────┼─────────────────┼────────────────────┼────────────┘│
└────────────┼─────────────────┼────────────────────┼─────────────┘
             │                 │                    │
             ▼                 ▼                    ▼
┌────────────────────┐ ┌──────────────────┐ ┌─────────────────┐
│   Supabase DB      │ │ Edge Function    │ │  localStorage   │
│  (已登录用户)       │ │ (openai-proxy)   │ │  (访客用户)      │
└────────────────────┘ └────────┬─────────┘ └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │  OpenAI API     │
                       │  (或兼容接口)    │
                       └─────────────────┘
```

### 4.2 数据服务路由策略

`dataService.ts` 是数据访问的统一入口，会根据用户登录状态自动路由：

```typescript
// 伪代码示意
async function anyDataOperation(...args) {
  if (!(await isAuthenticated())) {
    return guestStorage.sameOperation(...args);  // 访客 → localStorage
  }
  return supabaseOperation(...args);              // 登录 → Supabase
}
```

**关键函数**：
- `getUserId()`: 获取当前用户 ID
- `isAuthenticated()`: 判断是否已登录

---

## 5. 关键页面与流程详解

### 5.1 App 入口与视图切换

**文件**: `src/App.tsx`

**职责**:
- 使用 `AuthProvider` 包裹整个应用，提供认证状态
- 管理 `view` 状态控制首页或阅读器视图
- 根据文章的 `mode` 字段切换到对应的阅读器

**视图切换逻辑**:
```
view.type === 'home' → <Home />
view.type === 'reader':
  article.mode === 'dialogue' → <DialogueReader />
  article.mode === 'galgame'  → <GalgameReader />
  article.mode === 'card'     → <CardReader />
```

**状态管理**:
```typescript
type View = { type: 'home' } | { type: 'reader'; articleId: string };
const [view, setView] = useState<View>({ type: 'home' });
```

### 5.2 首页 (Home)

**文件**: `src/pages/Home.tsx`

**职责**:
- 展示文章列表与总积分
- 提供文章导入、删除功能
- 管理用户登录/登出状态
- 访客模式提示与注册引导

**数据加载**:
```typescript
const loadData = async () => {
  const [articlesData, points] = await Promise.all([
    getArticles(),      // 获取文章列表（含进度信息）
    getTotalPoints(),   // 获取总积分
  ]);
};
```

**Props 接口**:
```typescript
interface HomeProps {
  onSelectArticle: (id: string) => void;  // 选择文章回调，切换到阅读器
}
```

### 5.3 文章导入流程

**文件**: `src/components/ArticleInput.tsx`

**三步流程**:
1. **content**: 输入标题和内容
2. **mode**: 选择学习模式 (卡片/对话/视觉小说)
3. **processing**: AI 处理中

**各模式调用链**:

| 模式 | AI 处理函数 | 数据创建函数 |
|------|------------|-------------|
| 卡片 | `splitArticle()` | `createArticle()` → `createCards()` |
| 对话 | `convertToDialogue()` | `createArticle()` → `createDialogueMessages()` |
| 视觉小说 | `convertToGalgame()` | `createArticle()` → `createGalgameMessages()` |

### 5.4 卡片阅读器

**文件**: `src/pages/CardReader.tsx`

**职责**:
- 核心学习界面，管理卡片浏览和学习进度
- 整合多个子组件实现完整功能

**数据加载**:
```typescript
const loadData = async () => {
  const [articleData, cardsData, progressData, rewardsData, 
         bookmarksData, convCount, highlights] = await Promise.all([
    getArticle(articleId),
    getCards(articleId),
    getProgress(articleId),
    getRewards(articleId),
    getBookmarks(articleId),
    getConversationCount(articleId),
    getAllHighlights(articleId),
  ]);
};
```

**组件组合**:
```
CardReader
├── ProgressBar          # 进度条与里程碑显示
├── CardStack            # 卡片展示与交互
│   ├── 文本选择工具栏    # 高亮/下划线/加粗
│   └── 笔记区域         # 卡片笔记
├── ContextPreview       # 上下文预览（长按触发）
├── OriginalTextView     # 原文查看与标注
├── AIChat               # AI 问答面板
└── TreasureBox          # 里程碑奖励领取
```

**交互流程**:
```
点击边缘 → 切换卡片 → 保存进度 → 检查里程碑
长按边缘 → 显示上下文预览
选中文字 → 显示标注工具栏 → 创建高亮
点击"问AI" → 打开 AIChat → 流式回答 → 保存对话
```

### 5.5 对话模式阅读器

**文件**: `src/components/DialogueReader.tsx`

**职责**:
- 微信聊天风格展示对话内容
- 长按消息气泡可向 AI 提问
- 侧边栏显示 Q&A 记录

**核心功能**:
```typescript
// 长按消息触发
const handleLongPressStart = (message: DialogueMessage) => {
  const timer = setTimeout(() => {
    setSelectedMessage(message);
    setShowQAPanel(true);
  }, 500);
};

// 获取上下文（提问时传给 AI）
const getContextMessages = (upToOrder: number) => {
  return messages
    .filter(m => m.sequence_order <= upToOrder)
    .map(m => ({ character_name: m.character_name, content: m.content }));
};
```

**布局结构**:
```
DialogueReader
├── Header               # 标题、消息数、原文按钮
├── 消息列表             # 左右气泡布局
│   ├── 头像            # 基于 avatar_seed 生成颜色
│   ├── 角色名称
│   ├── 消息内容        # 可长按
│   └── 知识点标签
└── QA 侧边栏           # 选中消息后显示
    ├── 历史问答记录
    └── 提问输入框
```

### 5.6 视觉小说阅读器

**文件**: `src/components/GalgameReader.tsx`

**职责**:
- 类似 Galgame/视觉小说的沉浸式阅读体验
- 打字机效果逐字显示
- 屏幕特效 (震动/闪白/脉冲)
- 自动播放与速度调节

**核心功能**:
```typescript
// 打字机效果
const typeText = (text: string) => {
  setIsTyping(true);
  let index = 0;
  const interval = setInterval(() => {
    if (index < text.length) {
      setDisplayedText(text.slice(0, index + 1));
      index++;
    } else {
      clearInterval(interval);
      setIsTyping(false);
    }
  }, textSpeed);
};

// 屏幕特效
const triggerScreenEffect = (effect: string) => {
  if (effect && effect !== 'none') {
    setScreenEffect(effect);
    setTimeout(() => setScreenEffect(null), 500);
  }
};
```

**特效类型**:
| 特效 | CSS 动画 | 触发场景 |
|------|---------|---------|
| shake | 左右摇晃 | 惊讶、愤怒 |
| flash | 屏幕闪白 | 恍然大悟 |
| pulse | 脉冲放大 | 强调、心跳 |

**情绪表情映射**:
```typescript
const EMOTION_EMOJIS = {
  sweat: '💧',    // 汗颜
  angry: '💢',    // 愤怒
  love: '💕',     // 喜欢
  shock: '❗',    // 惊讶
  question: '❓', // 疑惑
  happy: '✨',    // 开心
  think: '💭',    // 思考
  sad: '💔',      // 悲伤
};
```

### 5.7 原文查看与标注

**文件**: `src/components/OriginalTextView.tsx`

**职责**:
- 全屏展示文章原文
- 高亮当前卡片/对话对应的原文位置
- 选中文字可标注 (高亮/下划线/加粗)
- 选中文字可向 AI 提问并保存 Q&A

**标注样式**:
```typescript
const ANNOTATION_STYLES = {
  highlight: { color: '#fef08a', label: '高亮' },
  underline: { color: '#93c5fd', label: '下划线' },
  bold: { color: '#fca5a5', label: '加粗' },
};
```

**文本选择流程**:
```
选中文本 → 计算位置偏移 → 显示工具栏
├── 点击标注按钮 → createArticleTextAnnotation()
└── 点击"问AI" → 输入问题 → 流式回答 → saveArticleTextQA()
```

---

## 6. 类型定义详解

**文件**: `src/types/index.ts`

### 6.1 核心实体类型

```typescript
// 文章模式
type ArticleMode = 'card' | 'dialogue' | 'galgame';

// 文章
interface Article {
  id: string;
  title: string;
  original_content: string;   // 原文内容
  mode: ArticleMode;
  characters?: string;        // 角色设定（对话/视觉小说模式）
  created_at: string;
}

// 学习卡片
interface Card {
  id: string;
  article_id: string;
  content: string;           // 卡片内容
  sequence_order: number;    // 顺序号
  semantic_label: string;    // 语义标签 (概念定义/举例说明等)
  context_summary: string;   // 上下文摘要
  created_at: string;
}

// 学习进度
interface LearningProgress {
  id: string;
  article_id: string;
  current_index: number;     // 当前位置
  completed_count: number;   // 已完成数量
  total_count: number;       // 总数量
  last_read_at: string;
}

// 里程碑奖励
interface Reward {
  id: string;
  article_id: string;
  milestone: 30 | 60 | 80;   // 里程碑百分比
  points: number;            // 获得积分 (10-50 随机)
  claimed_at: string;
}
```

### 6.2 对话模式类型

```typescript
// 对话消息
interface DialogueMessage {
  id: string;
  article_id: string;
  character_name: string;    // 角色名称
  avatar_seed: string;       // 头像颜色种子
  content: string;
  sequence_order: number;
  is_right_side: boolean;    // 是否显示在右侧
  knowledge_point?: string;  // 知识点标签
  created_at: string;
}

// 对话问答记录
interface DialogueQA {
  id: string;
  message_id: string;        // 关联的消息 ID
  article_id: string;
  question: string;
  answer: string;
  context_up_to: number;     // 上下文截止到第几条消息
  created_at: string;
}
```

### 6.3 视觉小说类型

```typescript
type ScreenEffect = 'none' | 'shake' | 'flash' | 'pulse';
type CharacterPosition = 'left' | 'right' | 'center';

// 视觉小说消息
interface GalgameMessage {
  id: string;
  article_id: string;
  character_name: string;
  avatar_seed: string;
  content: string;
  sequence_order: number;
  emotion_emoji?: string;      // 情绪表情标识
  screen_effect: ScreenEffect; // 屏幕特效
  knowledge_point?: string;
  position: CharacterPosition; // 角色位置
  created_at: string;
}
```

### 6.4 标注与问答类型

```typescript
// 卡片内高亮
interface Highlight {
  id: string;
  card_id: string;
  text: string;
  start_offset: number;
  end_offset: number;
  style: 'highlight' | 'underline' | 'bold';
  color: string;
  created_at: string;
}

// 原文标注
interface ArticleTextAnnotation {
  id: string;
  article_id: string;
  text: string;
  start_offset: number;
  end_offset: number;
  style: 'highlight' | 'underline' | 'bold';
  color: string;
  created_at: string;
}

// 原文问答
interface ArticleTextQA {
  id: string;
  article_id: string;
  selected_text: string;
  start_offset: number;
  end_offset: number;
  question: string;
  answer: string;
  include_full_article: boolean;  // 是否包含全文作为上下文
  created_at: string;
}
```

### 6.5 AI 相关类型

```typescript
// AI 解释请求
interface AIExplanationRequest {
  cardContent: string;
  previousCards: string[];
  questionType: 'story' | 'beginner' | 'connect' | 'custom';
  customQuestion?: string;
}

// AI 对话记录
interface AIConversation {
  id: string;
  card_id: string;
  question_type: string;
  question: string;
  answer: string;
  created_at: string;
}

// 卡片笔记
interface CardNote {
  id: string;
  card_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}
```

---

## 7. 组件接口与 Props 详解

### 7.1 页面组件

```typescript
// Home - 首页
interface HomeProps {
  onSelectArticle: (id: string) => void;  // 选择文章，切换到阅读器
}

// CardReader - 卡片阅读器
interface CardReaderProps {
  articleId: string;   // 文章 ID
  onBack: () => void;  // 返回首页
}
```

### 7.2 主要功能组件

```typescript
// ArticleInput - 文章导入弹窗
interface ArticleInputProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;  // 导入成功后刷新列表
}

// ArticleList - 文章列表
interface ArticleListProps {
  articles: ArticleWithProgress[];
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

// CardStack - 卡片堆叠组件
interface CardStackProps {
  cards: Card[];
  currentIndex: number;
  isBookmarked: boolean;
  conversationCount: number;
  highlights: Highlight[];
  onNext: () => void;
  onPrev: () => void;
  onLongPress: () => void;          // 长按触发上下文预览
  onViewOriginal: () => void;       // 查看原文
  onToggleBookmark: () => void;     // 切换书签
  onAskAI: () => void;              // 打开 AI 问答
  onHighlightAdded: (h: Highlight) => void;  // 新增高亮回调
}

// AIChat - AI 问答面板
interface AIChatProps {
  isOpen: boolean;
  currentCard: Card | null;
  previousCards: Card[];           // 前面的卡片（用于上下文）
  onClose: () => void;
  onConversationSaved: () => void; // 保存对话后刷新计数
}

// DialogueReader - 对话模式阅读器
interface DialogueReaderProps {
  article: Article;
  onBack: () => void;
}

// GalgameReader - 视觉小说阅读器
interface GalgameReaderProps {
  article: Article;
  onBack: () => void;
}

// OriginalTextView - 原文查看
interface OriginalTextViewProps {
  isOpen: boolean;
  articleId: string;
  originalContent: string;
  currentCard?: Card | null;   // 卡片模式：当前卡片
  allCards?: Card[];           // 卡片模式：所有卡片
  currentText?: string;        // 对话/视觉小说：当前消息文本
  onClose: () => void;
  onJumpToCard?: (index: number) => void;  // 跳转到指定卡片
}

// ContextPreview - 上下文预览
interface ContextPreviewProps {
  isOpen: boolean;
  currentCard: Card | null;
  prevCard: Card | null;
  nextCard: Card | null;
  onClose: () => void;
}

// ProgressBar - 进度条
interface ProgressBarProps {
  current: number;              // 当前索引
  total: number;                // 总数
  claimedMilestones: number[]; // 已领取的里程碑
}

// TreasureBox - 奖励领取
interface TreasureBoxProps {
  isOpen: boolean;
  milestone: 30 | 60 | 80;
  onClaim: () => Promise<number | null>;  // 领取奖励，返回积分
  onClose: () => void;
}
```

### 7.3 模态框组件

```typescript
// AuthModal - 登录/注册弹窗
interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'login' | 'register';
}

// SettingsModal - 设置弹窗
interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// WelcomeModal - 访客欢迎弹窗
interface WelcomeModalProps {
  isOpen: boolean;
  onLogin: () => void;
  onRegister: () => void;
  onSkip: () => void;
}
```

---

## 8. Hooks 详解

### 8.1 useGesture - 手势识别

**文件**: `src/hooks/useGesture.ts`

**功能**: 统一处理触摸和鼠标手势

```typescript
interface UseGestureOptions {
  onSwipeLeft?: () => void;   // 左滑
  onSwipeRight?: () => void;  // 右滑
  onSwipeUp?: () => void;     // 上滑
  onSwipeDown?: () => void;   // 下滑
  onLongPress?: () => void;   // 长按 (默认 500ms)
  onTap?: () => void;         // 点击
  swipeThreshold?: number;    // 滑动阈值 (默认 50px)
  longPressDelay?: number;    // 长按延迟 (默认 500ms)
}

// 返回值
interface UseGestureReturn {
  handlers: {
    onTouchStart, onTouchMove, onTouchEnd,
    onMouseDown, onMouseMove, onMouseUp, onMouseLeave
  };
  offset: { x: number; y: number };  // 当前拖拽偏移
  isDragging: boolean;               // 是否正在拖拽
}
```

**使用示例**:
```typescript
const { handlers, offset, isDragging } = useGesture({
  onSwipeLeft: handleNext,
  onSwipeRight: handlePrev,
  onLongPress: showContextPreview,
});

return <div {...handlers}>...</div>;
```

### 8.2 useAuth - 认证状态

**文件**: `src/contexts/AuthContext.tsx`

```typescript
interface AuthContextType {
  user: User | null;           // 当前用户
  session: Session | null;     // 会话信息
  isGuest: boolean;            // 是否访客
  isLoading: boolean;          // 加载状态
  signIn: (email, password) => Promise<{ error }>;
  signUp: (email, password) => Promise<{ error }>;
  signOut: () => Promise<void>;
  resetPassword: (email) => Promise<{ error }>;
}

// 使用
const { user, isGuest, signIn, signOut } = useAuth();
```

---

## 9. 服务层接口详解

### 9.1 数据服务 (dataService.ts)

**核心特点**: 根据登录状态自动路由到 Supabase 或 localStorage

#### 文章管理

```typescript
// 获取文章列表（含进度信息）
getArticles(): Promise<ArticleWithProgress[]>

// 获取单篇文章
getArticle(id: string): Promise<Article | null>

// 创建文章
createArticle(
  title: string,
  content: string,
  mode: ArticleMode = 'card',
  characters?: string
): Promise<Article>

// 删除文章（级联删除相关数据）
deleteArticle(id: string): Promise<void>
```

#### 卡片管理

```typescript
// 获取文章的所有卡片
getCards(articleId: string): Promise<Card[]>

// 批量创建卡片
createCards(
  articleId: string,
  cards: Omit<Card, 'id' | 'article_id' | 'created_at'>[]
): Promise<Card[]>
```

#### 学习进度

```typescript
// 获取进度
getProgress(articleId: string): Promise<LearningProgress | null>

// 更新进度（upsert）
upsertProgress(
  articleId: string,
  currentIndex: number,
  totalCount: number
): Promise<LearningProgress>
```

#### 奖励系统

```typescript
// 获取已领取的奖励
getRewards(articleId: string): Promise<Reward[]>

// 领取里程碑奖励（防重复）
claimReward(
  articleId: string,
  milestone: 30 | 60 | 80
): Promise<Reward | null>

// 获取总积分
getTotalPoints(): Promise<number>
```

#### 书签

```typescript
// 获取文章的所有书签卡片 ID
getBookmarks(articleId: string): Promise<string[]>

// 切换书签状态
toggleBookmark(cardId: string): Promise<boolean>  // 返回新状态
```

#### AI 问答

```typescript
// 获取卡片的问答记录
getConversations(cardId: string): Promise<AIConversation[]>

// 获取文章的问答总数
getConversationCount(articleId: string): Promise<number>

// 保存问答记录
saveConversation(
  cardId: string,
  questionType: string,
  question: string,
  answer: string
): Promise<AIConversation>
```

#### 高亮标注

```typescript
// 获取卡片的高亮
getHighlights(cardId: string): Promise<Highlight[]>

// 获取文章所有卡片的高亮 (Map<cardId, highlights>)
getAllHighlights(articleId: string): Promise<Map<string, Highlight[]>>

// 创建高亮
createHighlight(
  cardId: string,
  text: string,
  startOffset: number,
  endOffset: number,
  style: 'highlight' | 'underline' | 'bold',
  color: string
): Promise<Highlight>

// 删除高亮
deleteHighlight(id: string): Promise<void>
```

#### 对话模式

```typescript
// 获取对话消息
getDialogueMessages(articleId: string): Promise<DialogueMessage[]>

// 创建对话消息
createDialogueMessages(
  articleId: string,
  messages: DialogueGenerationResult[]
): Promise<DialogueMessage[]>

// 获取对话问答
getDialogueQAs(articleId: string): Promise<DialogueQA[]>
getDialogueQAsByMessage(messageId: string): Promise<DialogueQA[]>

// 保存对话问答
saveDialogueQA(
  messageId: string,
  articleId: string,
  question: string,
  answer: string,
  contextUpTo: number
): Promise<DialogueQA>
```

#### 卡片笔记

```typescript
// 获取卡片笔记
getCardNote(cardId: string): Promise<CardNote | null>

// 获取文章所有卡片笔记
getAllCardNotes(articleId: string): Promise<Map<string, CardNote>>

// 更新卡片笔记（upsert）
upsertCardNote(cardId: string, content: string): Promise<CardNote>
```

#### 视觉小说

```typescript
// 获取视觉小说消息
getGalgameMessages(articleId: string): Promise<GalgameMessage[]>

// 创建视觉小说消息
createGalgameMessages(
  articleId: string,
  messages: GalgameGenerationResult[]
): Promise<GalgameMessage[]>
```

#### 原文标注与问答

```typescript
// 原文标注
getArticleTextAnnotations(articleId: string): Promise<ArticleTextAnnotation[]>
createArticleTextAnnotation(...): Promise<ArticleTextAnnotation>
deleteArticleTextAnnotation(id: string): Promise<void>

// 原文问答
getArticleTextQAs(articleId: string): Promise<ArticleTextQA[]>
getArticleTextQAsByRange(articleId, startOffset, endOffset): Promise<ArticleTextQA[]>
saveArticleTextQA(...): Promise<ArticleTextQA>
```

### 9.2 OpenAI 服务 (openai.ts)

#### 配置管理

```typescript
interface OpenAIConfig {
  apiKey: string;
  apiEndpoint: string;  // 默认: https://api.openai.com/v1
  model: string;        // 默认: gpt-4o-mini
}

// 获取配置
getOpenAIConfig(): OpenAIConfig

// 保存配置
saveOpenAIConfig(config: OpenAIConfig): void

// 检查是否已配置
isConfigured(): boolean
```

#### AI 功能

```typescript
// 拆分文章为卡片
splitArticle(content: string): Promise<CardSplitResult[]>

// 流式解释卡片（AsyncGenerator）
async function* explainCard(request: AIExplanationRequest): AsyncGenerator<string>

// 转换为对话模式
convertToDialogue(
  content: string,
  characters: string
): Promise<DialogueGenerationResult[]>

// 流式回答对话问题
async function* answerDialogueQuestion(
  question: string,
  contextMessages: { character_name: string; content: string }[]
): AsyncGenerator<string>

// 流式回答原文问题
async function* answerArticleTextQuestion(
  selectedText: string,
  question: string,
  articleContent?: string  // 可选：包含全文作为上下文
): AsyncGenerator<string>

// 转换为视觉小说
convertToGalgame(
  content: string,
  characters: string
): Promise<GalgameGenerationResult[]>
```

**问题类型预设**:
```typescript
const questionTypePrompts = {
  story: '请用一个生动的故事或类比来解释...',
  beginner: '请用最简单、最通俗的语言解释...',
  connect: '请结合之前学习的内容，解释当前知识点...',
};
```

### 9.3 访客存储 (guestStorage.ts)

**存储结构**:
```
localStorage:
├── guest_articles              # 文章列表
├── guest_cards_{articleId}     # 各文章的卡片
├── guest_dialogue_{articleId}  # 对话消息
├── guest_galgame_{articleId}   # 视觉小说消息
├── guest_progress              # 所有进度 { articleId: progress }
├── guest_rewards               # 所有奖励
├── guest_bookmarks             # 书签卡片 ID 列表
├── guest_conversations         # AI 问答记录
├── guest_highlights            # 高亮标注
├── guest_notes                 # 卡片笔记
├── guest_dialogue_qa           # 对话问答
├── guest_article_text_annotations  # 原文标注
└── guest_article_text_qa       # 原文问答
```

**清除所有访客数据**:
```typescript
clearAllGuestData(): void
```

---

## 10. Supabase Edge Function

### 10.1 openai-proxy

**文件**: `supabase/functions/openai-proxy/index.ts`

**功能**: 转发 OpenAI 兼容请求，解决跨域问题

**请求格式**:
```typescript
interface ProxyRequest {
  apiKey: string;
  apiEndpoint: string;
  model: string;
  messages: { role: string; content: string }[];
  stream?: boolean;
  temperature?: number;
}
```

**响应**:
- `stream=false`: 返回完整 JSON 响应
- `stream=true`: 返回 SSE 流 (Server-Sent Events)

**调用方式**:
```typescript
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/openai-proxy`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      apiKey, apiEndpoint, model, messages, stream, temperature
    }),
  }
);
```

---

## 11. 数据库结构 (Supabase Postgres)

### 11.1 articles 文章表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| title | text | 标题 |
| original_content | text | 原文内容 |
| mode | text | 模式: card/dialogue/galgame |
| characters | text | 角色设定 (nullable) |
| created_at | timestamptz | 创建时间 |
| user_id | uuid | 用户 ID (FK → auth.users) |

### 11.2 cards 卡片表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| article_id | uuid | 文章 ID (FK) |
| content | text | 卡片内容 |
| sequence_order | int | 顺序号 |
| semantic_label | text | 语义标签 |
| context_summary | text | 上下文摘要 |
| created_at | timestamptz | 创建时间 |

### 11.3 learning_progress 学习进度表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| article_id | uuid | 文章 ID (FK) |
| user_id | uuid | 用户 ID |
| current_index | int | 当前索引 |
| completed_count | int | 已完成数 |
| total_count | int | 总数 |
| last_read_at | timestamptz | 最后阅读时间 |

**唯一约束**: `(user_id, article_id)`

### 11.4 rewards 奖励表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| article_id | uuid | 文章 ID (FK) |
| user_id | uuid | 用户 ID |
| milestone | int | 里程碑: 30/60/80 |
| points | int | 积分 (10-50) |
| claimed_at | timestamptz | 领取时间 |

**唯一约束**: `(user_id, article_id, milestone)`

### 11.5 bookmarks 书签表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| card_id | uuid | 卡片 ID (FK) |
| user_id | uuid | 用户 ID |
| created_at | timestamptz | 创建时间 |

**唯一约束**: `(user_id, card_id)`

### 11.6 ai_conversations AI 问答表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| card_id | uuid | 卡片 ID (FK) |
| user_id | uuid | 用户 ID |
| question_type | text | 问题类型 |
| question | text | 问题 |
| answer | text | 回答 |
| created_at | timestamptz | 创建时间 |

### 11.7 highlights 高亮表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| card_id | uuid | 卡片 ID (FK) |
| user_id | uuid | 用户 ID |
| text | text | 高亮文本 |
| start_offset | int | 起始偏移 |
| end_offset | int | 结束偏移 |
| style | text | 样式: highlight/underline/bold |
| color | text | 颜色值 |
| created_at | timestamptz | 创建时间 |

### 11.8 card_notes 卡片笔记表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| card_id | uuid | 卡片 ID (FK) |
| user_id | uuid | 用户 ID |
| content | text | 笔记内容 |
| created_at | timestamptz | 创建时间 |
| updated_at | timestamptz | 更新时间 |

**唯一约束**: `(user_id, card_id)`

### 11.9 dialogue_messages 对话消息表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| article_id | uuid | 文章 ID (FK) |
| character_name | text | 角色名称 |
| avatar_seed | text | 头像种子 |
| content | text | 消息内容 |
| sequence_order | int | 顺序号 |
| is_right_side | boolean | 是否右侧显示 |
| knowledge_point | text | 知识点 (nullable) |
| created_at | timestamptz | 创建时间 |

### 11.10 dialogue_qa 对话问答表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| message_id | uuid | 消息 ID (FK) |
| article_id | uuid | 文章 ID (FK) |
| user_id | uuid | 用户 ID |
| question | text | 问题 |
| answer | text | 回答 |
| context_up_to | int | 上下文截止顺序号 |
| created_at | timestamptz | 创建时间 |

### 11.11 galgame_messages 视觉小说消息表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| article_id | uuid | 文章 ID (FK) |
| character_name | text | 角色名称 |
| avatar_seed | text | 头像种子 |
| content | text | 消息内容 |
| sequence_order | int | 顺序号 |
| emotion_emoji | text | 情绪表情 (nullable) |
| screen_effect | text | 屏幕特效 |
| knowledge_point | text | 知识点 (nullable) |
| position | text | 位置: left/right/center |
| created_at | timestamptz | 创建时间 |

### 11.12 article_text_annotations 原文标注表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| article_id | uuid | 文章 ID (FK) |
| user_id | uuid | 用户 ID |
| text | text | 标注文本 |
| start_offset | int | 起始偏移 |
| end_offset | int | 结束偏移 |
| style | text | 样式 |
| color | text | 颜色 |
| created_at | timestamptz | 创建时间 |

### 11.13 article_text_qa 原文问答表

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uuid | 主键 |
| article_id | uuid | 文章 ID (FK) |
| user_id | uuid | 用户 ID |
| selected_text | text | 选中的文本 |
| start_offset | int | 起始偏移 |
| end_offset | int | 结束偏移 |
| question | text | 问题 |
| answer | text | 回答 |
| include_full_article | boolean | 是否包含全文 |
| created_at | timestamptz | 创建时间 |

---

## 12. 环境变量与配置

### 12.1 环境变量

```bash
# Supabase 配置
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJxxx...
```

### 12.2 本地存储

| Key | 说明 |
|-----|------|
| `openai_config` | OpenAI API 配置 (key, endpoint, model) |
| `welcome_dismissed` | 访客欢迎弹窗是否已关闭 |
| `guest_*` | 访客模式数据 (见 guestStorage.ts) |

---

## 13. 模块关系图

```
┌──────────────────────────────────────────────────────────────────┐
│                           App.tsx                                │
│                    (AuthProvider + 视图路由)                      │
└────────────────────────────┬─────────────────────────────────────┘
                             │
         ┌───────────────────┼───────────────────┐
         │                   │                   │
         ▼                   ▼                   ▼
┌─────────────┐    ┌─────────────────┐    ┌──────────────────┐
│    Home     │    │   CardReader    │    │ DialogueReader/  │
│  (首页)     │    │  (卡片阅读器)    │    │ GalgameReader    │
└──────┬──────┘    └────────┬────────┘    └────────┬─────────┘
       │                    │                      │
       │                    │                      │
       ▼                    ▼                      ▼
┌─────────────┐    ┌─────────────────────────────────────────────┐
│ArticleInput │    │              共用组件                        │
│ArticleList  │    │  OriginalTextView / AIChat / TreasureBox   │
└──────┬──────┘    └────────────────────────────────────────────┘
       │                            │
       └────────────────────────────┼───────────────────────────┐
                                    │                           │
                                    ▼                           ▼
                         ┌──────────────────┐        ┌──────────────────┐
                         │   dataService    │        │    openai.ts     │
                         │   (数据路由层)    │        │   (AI 服务)      │
                         └────────┬─────────┘        └────────┬─────────┘
                                  │                           │
                    ┌─────────────┼─────────────┐             │
                    │             │             │             │
                    ▼             ▼             ▼             ▼
             ┌───────────┐ ┌───────────┐ ┌─────────────────────────┐
             │ Supabase  │ │guestStorage│ │   Edge Function         │
             │  (登录)   │ │  (访客)    │ │   (openai-proxy)        │
             └───────────┘ └───────────┘ └────────────┬────────────┘
                                                      │
                                                      ▼
                                              ┌───────────────┐
                                              │  OpenAI API   │
                                              └───────────────┘
```

---

## 14. 快速二次开发建议

### 14.1 新增学习模式

1. **类型扩展**: `src/types/index.ts` 中扩展 `ArticleMode`
2. **数据表**: 在 `supabase/migrations/` 添加新表迁移
3. **服务层**: 
   - `dataService.ts` 添加对应 CRUD 方法
   - `guestStorage.ts` 添加本地存储方法
4. **AI 处理**: `openai.ts` 添加内容转换函数
5. **组件**: 创建新的 Reader 组件
6. **路由**: 
   - `App.tsx` 添加模式判断
   - `ArticleInput.tsx` 添加模式选项

### 14.2 扩展 AI 功能

1. 在 `openai.ts` 中封装新函数
2. 设计合适的 System Prompt
3. 使用 AsyncGenerator 实现流式响应
4. 在 UI 组件中消费流式数据

### 14.3 数据结构变动

1. 更新 `src/types/index.ts` 类型定义
2. 创建 Supabase migration 脚本
3. 更新 `dataService.ts` 和 `guestStorage.ts`
4. 更新相关组件的 Props 和数据处理逻辑

### 14.4 添加新的标注类型

1. 在 `Highlight` 和 `ArticleTextAnnotation` 类型中扩展 `style` 选项
2. 在 `CardStack.tsx` 和 `OriginalTextView.tsx` 中：
   - 添加新的样式配置 (颜色、CSS)
   - 添加工具栏按钮
   - 更新渲染逻辑

---

## 15. 常见问题排查

### 15.1 API 调用失败

- 检查 `openai_config` 是否已配置
- 确认 API Key 和 Endpoint 正确
- 查看 Edge Function 日志

### 15.2 数据不同步

- 检查用户登录状态 (`isAuthenticated()`)
- 确认 RLS 策略配置正确
- 清除 localStorage 后重试

### 15.3 样式问题

- 确认 Tailwind 配置正确
- 检查动态类名是否在 safelist 中

---

## 16. 版本历史

| 版本 | 日期 | 主要变更 |
|------|------|---------|
| 1.0 | 2026-01-10 | 初始版本，卡片模式 |
| 1.1 | 2026-01-10 | 添加对话模式 |
| 1.2 | 2026-01-11 | 添加卡片笔记功能 |
| 1.3 | 2026-01-18 | 添加视觉小说模式 |
| 1.4 | 2026-01-18 | 添加用户认证系统 |
| 1.5 | 2026-01-18 | 添加原文标注与问答 |
