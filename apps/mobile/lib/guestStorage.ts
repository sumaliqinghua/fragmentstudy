import type {
  Article,
  ArticleMode,
  ArticleSourceMetadata,
  ArticleWithProgress,
  Card,
  LearningMode,
  LearningProgress,
  Reward,
} from './types';

const memoryStore = new Map<string, unknown>();

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function cloneValue<T>(value: T): T {
  return structuredClone(value);
}

function getItem<T>(key: string): T | null {
  const item = memoryStore.get(key);
  return item === undefined ? null : cloneValue(item as T);
}

function setItem<T>(key: string, value: T): void {
  memoryStore.set(key, cloneValue(value));
}

function removeItem(key: string): void {
  memoryStore.delete(key);
}

function progressKey(articleId: string, mode: LearningMode): string {
  return `${articleId}:${mode}`;
}

export function clearGuestData(): void {
  memoryStore.clear();
}

function getArticlesStore(): Article[] {
  return getItem<Article[]>('articles') || [];
}

function setArticlesStore(articles: Article[]): void {
  setItem('articles', articles);
}

function getCardsStore(articleId: string): Card[] {
  return getItem<Card[]>(`cards_${articleId}`) || [];
}

function setCardsStore(articleId: string, cards: Card[]): void {
  setItem(`cards_${articleId}`, cards);
}

function getProgressStore(): Record<string, LearningProgress> {
  return getItem<Record<string, LearningProgress>>('progress') || {};
}

function setProgressStore(progress: Record<string, LearningProgress>): void {
  setItem('progress', progress);
}

function getRewardsStore(): Reward[] {
  return getItem<Reward[]>('rewards') || [];
}

function setRewardsStore(rewards: Reward[]): void {
  setItem('rewards', rewards);
}

export async function getArticles(): Promise<ArticleWithProgress[]> {
  const articles = getArticlesStore();
  const progressStore = getProgressStore();
  return articles.map((article) => {
    const progress = progressStore[progressKey(article.id, 'card')];
    const cards = getCardsStore(article.id);
    return {
      ...article,
      progress,
      cardCount: cards.length,
    };
  });
}

export async function getArticle(id: string): Promise<Article | null> {
  return getArticlesStore().find((a) => a.id === id) || null;
}

export async function createArticle(
  title: string,
  content: string,
  mode: ArticleMode = 'card',
  characters?: string,
  metadata: ArticleSourceMetadata = {}
): Promise<Article> {
  const article: Article = {
    id: generateId(),
    title,
    original_content: content,
    mode,
    characters,
    subject_id: metadata.subjectId ?? null,
    source_type: metadata.sourceType ?? 'text',
    source_url: metadata.sourceUrl ?? null,
    tagIds: [],
    created_at: new Date().toISOString(),
  };
  const articles = getArticlesStore();
  articles.unshift(article);
  setArticlesStore(articles);
  return article;
}

export async function deleteArticle(id: string): Promise<void> {
  setArticlesStore(getArticlesStore().filter((a) => a.id !== id));
  removeItem(`cards_${id}`);
  const progressStore = getProgressStore();
  for (const key of Object.keys(progressStore)) {
    if (key.startsWith(`${id}:`)) delete progressStore[key];
  }
  setProgressStore(progressStore);
  setRewardsStore(getRewardsStore().filter((r) => r.article_id !== id));
}

export async function getCards(articleId: string): Promise<Card[]> {
  return getCardsStore(articleId).sort((a, b) => a.sequence_order - b.sequence_order);
}

export async function createCards(
  articleId: string,
  cards: Omit<Card, 'id' | 'article_id' | 'created_at' | 'sequence_order'>[]
): Promise<Card[]> {
  const existing = getCardsStore(articleId);
  const created: Card[] = cards.map((card, index) => ({
    ...card,
    id: generateId(),
    article_id: articleId,
    sequence_order: existing.length + index,
    created_at: new Date().toISOString(),
  }));
  setCardsStore(articleId, [...existing, ...created]);
  return created;
}

export async function getProgress(
  articleId: string,
  mode: LearningMode = 'card'
): Promise<LearningProgress | null> {
  return getProgressStore()[progressKey(articleId, mode)] || null;
}

export async function upsertProgress(
  articleId: string,
  currentIndex: number,
  totalCount: number,
  mode: LearningMode = 'card'
): Promise<LearningProgress> {
  const store = getProgressStore();
  const key = progressKey(articleId, mode);
  const existing = store[key];
  const progress: LearningProgress = {
    id: existing?.id || generateId(),
    article_id: articleId,
    mode,
    current_index: currentIndex,
    completed_count: currentIndex + 1,
    total_count: totalCount,
    last_read_at: new Date().toISOString(),
  };
  store[key] = progress;
  setProgressStore(store);
  return progress;
}

export async function getTotalPoints(): Promise<number> {
  return getRewardsStore().reduce((sum, r) => sum + r.points, 0);
}

export async function claimReward(
  articleId: string,
  milestone: 30 | 60 | 80
): Promise<Reward | null> {
  const rewards = getRewardsStore();
  if (rewards.some((r) => r.article_id === articleId && r.milestone === milestone)) {
    return null;
  }
  const reward: Reward = {
    id: generateId(),
    article_id: articleId,
    milestone,
    points: Math.floor(Math.random() * 41) + 10,
    claimed_at: new Date().toISOString(),
  };
  rewards.push(reward);
  setRewardsStore(rewards);
  return reward;
}
