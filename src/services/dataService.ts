import { supabase } from './supabase';
import * as guestStorage from './guestStorage';
import type {
  Article,
  Card,
  LearningProgress,
  Reward,
  ArticleWithProgress,
  AIConversation,
  Highlight,
  DialogueMessage,
  DialogueQA,
  DialogueGenerationResult,
  ArticleMode,
  CardNote,
  GalgameMessage,
  GalgameGenerationResult,
  ArticleTextAnnotation,
  ArticleTextQA,
  QuizQuestion,
  QuizGenerationResult,
  Tag,
} from '../types';

type CacheEntry<T> = {
  data: T;
  ts: number;
};

const CACHE_TTL_MS = Number.POSITIVE_INFINITY;

const cache = {
  articles: null as CacheEntry<ArticleWithProgress[]> | null,
  articlesById: new Map<string, CacheEntry<Article>>(),
  tags: null as CacheEntry<Tag[]> | null,
  articleTagsByArticleId: new Map<string, CacheEntry<string[]>>(),
  cardsByArticleId: new Map<string, CacheEntry<Card[]>>(),
  progressByArticleId: new Map<string, CacheEntry<LearningProgress | null>>(),
  rewardsByArticleId: new Map<string, CacheEntry<Reward[]>>(),
  dialogueByArticleId: new Map<string, CacheEntry<DialogueMessage[]>>(),
  galgameByArticleId: new Map<string, CacheEntry<GalgameMessage[]>>(),
  quizByArticleId: new Map<string, CacheEntry<QuizQuestion[]>>(),
};

function notifyCardsUpdated(articleId: string): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('cards:update', { detail: { articleId } }));
}

function notifyProgressUpdated(articleId: string, progress: LearningProgress | null): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent('progress:update', { detail: { articleId, progress } }));
}

function isFresh<T>(entry: CacheEntry<T> | null): entry is CacheEntry<T> {
  if (!entry) return false;
  if (CACHE_TTL_MS === Number.POSITIVE_INFINITY) return true;
  return Date.now() - entry.ts < CACHE_TTL_MS;
}

function setCacheEntry<T>(map: Map<string, CacheEntry<T>>, key: string, data: T): void {
  map.set(key, { data, ts: Date.now() });
}

function getCacheEntry<T>(map: Map<string, CacheEntry<T>>, key: string): T | null {
  const entry = map.get(key);
  if (entry && isFresh(entry)) {
    return entry.data;
  }
  return null;
}

function getCacheEntryAllowNull<T>(map: Map<string, CacheEntry<T>>, key: string): { hit: boolean; data: T | null } {
  const entry = map.get(key);
  if (entry && isFresh(entry)) {
    return { hit: true, data: entry.data ?? null };
  }
  return { hit: false, data: null };
}

function invalidateArticlesCache(): void {
  cache.articles = null;
}

function updateArticleTagsInCache(articleId: string, tagIds: string[]): void {
  if (cache.articles?.data) {
    const next = cache.articles.data.map(article => (
      article.id === articleId ? { ...article, tagIds } : article
    ));
    cache.articles = { data: next, ts: Date.now() };
  }
  const cachedArticle = cache.articlesById.get(articleId);
  if (cachedArticle) {
    cache.articlesById.set(articleId, { data: { ...cachedArticle.data, tagIds }, ts: Date.now() });
  }
  setCacheEntry(cache.articleTagsByArticleId, articleId, tagIds);
}

function updateArticleCount(
  articleId: string,
  field: 'cardCount' | 'messageCount' | 'galgameMessageCount' | 'quizCount',
  delta: number
): void {
  if (!cache.articles?.data) return;
  const next = cache.articles.data.map((article) => {
    if (article.id !== articleId) return article;
    return {
      ...article,
      [field]: Math.max(0, (article[field] || 0) + delta),
    };
  });
  cache.articles = { data: next, ts: Date.now() };
}

export function getArticlesCacheSnapshot(): ArticleWithProgress[] | null {
  return cache.articles?.data || null;
}

export function getTagsCacheSnapshot(): Tag[] | null {
  return cache.tags?.data || null;
}

export function getCardsCacheSnapshot(articleId: string): Card[] | undefined {
  return cache.cardsByArticleId.get(articleId)?.data;
}

export function getQuizCacheSnapshot(articleId: string): QuizQuestion[] | undefined {
  return cache.quizByArticleId.get(articleId)?.data;
}

export function getDialogueCacheSnapshot(articleId: string): DialogueMessage[] | undefined {
  return cache.dialogueByArticleId.get(articleId)?.data;
}

export function getGalgameCacheSnapshot(articleId: string): GalgameMessage[] | undefined {
  return cache.galgameByArticleId.get(articleId)?.data;
}

export function getProgressCacheSnapshot(articleId: string): LearningProgress | null | undefined {
  if (!cache.progressByArticleId.has(articleId)) return undefined;
  return cache.progressByArticleId.get(articleId)?.data ?? null;
}

export function getRewardsCacheSnapshot(articleId: string): Reward[] | undefined {
  return cache.rewardsByArticleId.get(articleId)?.data;
}

async function getUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

async function isAuthenticated(): Promise<boolean> {
  const userId = await getUserId();
  return userId !== null;
}

const missingTables = new Set<string>();

function isMissingTableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { code?: string; status?: number; message?: string };
  if (err.code === 'PGRST205') return true;
  if (err.status === 404) return true;
  if (err.message && err.message.includes('Could not find the table')) return true;
  return false;
}

async function getArticleTagsForArticles(articleIds: string[]): Promise<Map<string, string[]>> {
  if (articleIds.length === 0) return new Map();

  if (!(await isAuthenticated())) {
    return guestStorage.getArticleTagsForArticles(articleIds);
  }

  if (missingTables.has('article_tags')) {
    const empty = new Map<string, string[]>();
    for (const articleId of articleIds) {
      empty.set(articleId, []);
    }
    return empty;
  }

  const { data, error } = await supabase
    .from('article_tags')
    .select('article_id, tag_id')
    .in('article_id', articleIds);

  if (error) {
    if (isMissingTableError(error)) {
      missingTables.add('article_tags');
      const empty = new Map<string, string[]>();
      for (const articleId of articleIds) {
        empty.set(articleId, []);
      }
      return empty;
    }
    throw error;
  }
  const result = new Map<string, string[]>();
  for (const articleId of articleIds) {
    result.set(articleId, []);
  }
  for (const row of data || []) {
    const list = result.get(row.article_id) || [];
    list.push(row.tag_id);
    result.set(row.article_id, list);
  }
  return result;
}

export async function getArticles(): Promise<ArticleWithProgress[]> {
  if (!(await isAuthenticated())) {
    return guestStorage.getArticles();
  }

  if (isFresh(cache.articles)) {
    return cache.articles.data;
  }

  const { data: articles, error } = await supabase
    .from('articles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!articles) return [];

  const articleIds = articles.map(article => article.id);
  const articleTagsMap = await getArticleTagsForArticles(articleIds);
  const articlesWithProgress = await Promise.all(
    articles.map(async (article) => {
      const { data: progress } = await supabase
        .from('learning_progress')
        .select('*')
        .eq('article_id', article.id)
        .maybeSingle();

      const [{ count: cardCount }, { count: messageCount }, { count: galgameMessageCount }, { count: quizCount }] = await Promise.all([
        supabase
          .from('cards')
          .select('*', { count: 'exact', head: true })
          .eq('article_id', article.id),
        supabase
          .from('dialogue_messages')
          .select('*', { count: 'exact', head: true })
          .eq('article_id', article.id),
        supabase
          .from('galgame_messages')
          .select('*', { count: 'exact', head: true })
          .eq('article_id', article.id),
        supabase
          .from('quiz_questions')
          .select('*', { count: 'exact', head: true })
          .eq('article_id', article.id),
      ]);

      const enriched: ArticleWithProgress = {
        ...article,
        tagIds: articleTagsMap.get(article.id) || [],
        progress: progress || undefined,
        cardCount: cardCount || 0,
        messageCount: messageCount || 0,
        galgameMessageCount: galgameMessageCount || 0,
        quizCount: quizCount || 0,
      };
      cache.articlesById.set(article.id, { data: enriched, ts: Date.now() });
      setCacheEntry(cache.articleTagsByArticleId, article.id, enriched.tagIds || []);
      return enriched;
    })
  );

  cache.articles = { data: articlesWithProgress, ts: Date.now() };
  return articlesWithProgress;
}

export async function getArticle(id: string): Promise<Article | null> {
  if (!(await isAuthenticated())) {
    return guestStorage.getArticle(id);
  }

  const cached = getCacheEntry(cache.articlesById, id);
  if (cached) {
    return cached;
  }
  if (cache.articles?.data) {
    const fromList = cache.articles.data.find(article => article.id === id);
    if (fromList) {
      cache.articlesById.set(id, { data: fromList, ts: Date.now() });
      return fromList;
    }
  }

  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  const tagIds = (await getArticleTagsForArticles([id])).get(id) || [];
  const enriched: Article = { ...data, tagIds };
  cache.articlesById.set(id, { data: enriched, ts: Date.now() });
  setCacheEntry(cache.articleTagsByArticleId, id, tagIds);
  return enriched;
}

export async function createArticle(
  title: string,
  content: string,
  mode: ArticleMode = 'source',
  characters?: string
): Promise<Article> {
  if (!(await isAuthenticated())) {
    return guestStorage.createArticle(title, content, mode, characters);
  }

  const userId = await getUserId();
  const { data, error } = await supabase
    .from('articles')
    .insert({ title, original_content: content, mode, characters, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  invalidateArticlesCache();
  return data;
}

export async function deleteArticle(id: string): Promise<void> {
  if (!(await isAuthenticated())) {
    return guestStorage.deleteArticle(id);
  }

  const { error } = await supabase
    .from('articles')
    .delete()
    .eq('id', id);

  if (error) throw error;
  cache.articlesById.delete(id);
  cache.articleTagsByArticleId.delete(id);
  cache.cardsByArticleId.delete(id);
  cache.progressByArticleId.delete(id);
  cache.rewardsByArticleId.delete(id);
  cache.dialogueByArticleId.delete(id);
  cache.galgameByArticleId.delete(id);
  cache.quizByArticleId.delete(id);
  invalidateArticlesCache();
}

export async function getTags(): Promise<Tag[]> {
  if (!(await isAuthenticated())) {
    return guestStorage.getTags();
  }

  if (missingTables.has('tags')) {
    return [];
  }

  if (isFresh(cache.tags)) {
    return cache.tags.data;
  }

  const { data, error } = await supabase
    .from('tags')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    if (isMissingTableError(error)) {
      missingTables.add('tags');
      return [];
    }
    throw error;
  }
  const result = data || [];
  cache.tags = { data: result, ts: Date.now() };
  return result;
}

export async function createTag(name: string, parentId: string | null): Promise<Tag> {
  if (!(await isAuthenticated())) {
    const tag = await guestStorage.createTag(name, parentId);
    cache.tags = null;
    return tag;
  }

  if (missingTables.has('tags')) {
    throw new Error('标签表未创建，请先执行 Supabase 迁移。');
  }

  const userId = await getUserId();
  const { data, error } = await supabase
    .from('tags')
    .insert({ name, parent_id: parentId, user_id: userId })
    .select()
    .single();

  if (error) {
    if (isMissingTableError(error)) {
      missingTables.add('tags');
      throw new Error('标签表未创建，请先执行 Supabase 迁移。');
    }
    throw error;
  }
  cache.tags = null;
  return data;
}

export async function ensureTagPath(path: string): Promise<string | null> {
  const trimmed = path.trim();
  if (!trimmed) return null;
  const segments = trimmed.split('/').map(seg => seg.trim()).filter(Boolean);
  if (segments.length === 0) return null;

  let currentParentId: string | null = null;
  let tags = await getTags();

  for (const segment of segments) {
    const existing = tags.find(tag => tag.name === segment && tag.parent_id === currentParentId) || null;
    if (existing) {
      currentParentId = existing.id;
      continue;
    }
    const created = await createTag(segment, currentParentId);
    tags = [...tags, created];
    currentParentId = created.id;
  }
  return currentParentId;
}

export async function ensureTagPaths(paths: string[]): Promise<string[]> {
  const tagIds: string[] = [];
  for (const path of paths) {
    const tagId = await ensureTagPath(path);
    if (tagId) tagIds.push(tagId);
  }
  return Array.from(new Set(tagIds));
}

export async function setArticleTags(articleId: string, tagIds: string[]): Promise<void> {
  if (!(await isAuthenticated())) {
    await guestStorage.setArticleTags(articleId, tagIds);
    updateArticleTagsInCache(articleId, tagIds);
    return;
  }

  if (missingTables.has('article_tags')) return;

  const userId = await getUserId();
  const { error: deleteError } = await supabase.from('article_tags').delete().eq('article_id', articleId);
  if (deleteError) {
    if (isMissingTableError(deleteError)) return;
    throw deleteError;
  }

  if (tagIds.length > 0) {
    const rows = tagIds.map(tagId => ({
      article_id: articleId,
      tag_id: tagId,
      user_id: userId,
    }));
    const { error } = await supabase.from('article_tags').insert(rows);
    if (error) {
      if (isMissingTableError(error)) return;
      throw error;
    }
  }
  updateArticleTagsInCache(articleId, tagIds);
}

export async function getCards(articleId: string): Promise<Card[]> {
  if (!(await isAuthenticated())) {
    return guestStorage.getCards(articleId);
  }

  const cached = getCacheEntry(cache.cardsByArticleId, articleId);
  if (cached) {
    return cached;
  }

  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('article_id', articleId)
    .order('sequence_order', { ascending: true });

  if (error) throw error;
  const result = data || [];
  setCacheEntry(cache.cardsByArticleId, articleId, result);
  return result;
}

export async function createCards(
  articleId: string,
  cards: Omit<Card, 'id' | 'article_id' | 'created_at'>[]
): Promise<Card[]> {
  if (!(await isAuthenticated())) {
    const result = await guestStorage.createCards(articleId, cards);
    notifyCardsUpdated(articleId);
    return result;
  }

  const cardsToInsert = cards.map((card, index) => ({
    ...card,
    article_id: articleId,
    sequence_order: index,
  }));

  const { data, error } = await supabase
    .from('cards')
    .insert(cardsToInsert)
    .select();

  if (error) throw error;
  const result = data || [];
  const existing = cache.cardsByArticleId.get(articleId)?.data || [];
  setCacheEntry(cache.cardsByArticleId, articleId, [...existing, ...result]);
  updateArticleCount(articleId, 'cardCount', result.length);
  notifyCardsUpdated(articleId);
  return result;
}

export async function getProgress(articleId: string): Promise<LearningProgress | null> {
  if (!(await isAuthenticated())) {
    return guestStorage.getProgress(articleId);
  }

  const cached = getCacheEntryAllowNull(cache.progressByArticleId, articleId);
  if (cached.hit) {
    return cached.data;
  }

  const { data, error } = await supabase
    .from('learning_progress')
    .select('*')
    .eq('article_id', articleId)
    .maybeSingle();

  if (error) throw error;
  setCacheEntry(cache.progressByArticleId, articleId, data ?? null);
  return data;
}

export async function upsertProgress(
  articleId: string,
  currentIndex: number,
  totalCount: number
): Promise<LearningProgress> {
  if (!(await isAuthenticated())) {
    const result = await guestStorage.upsertProgress(articleId, currentIndex, totalCount);
    setCacheEntry(cache.progressByArticleId, articleId, result);
    notifyProgressUpdated(articleId, result);
    return result;
  }

  const userId = await getUserId();
  const completedCount = currentIndex + 1;

  const { data, error } = await supabase
    .from('learning_progress')
    .upsert({
      article_id: articleId,
      user_id: userId,
      current_index: currentIndex,
      completed_count: completedCount,
      total_count: totalCount,
      last_read_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,article_id',
    })
    .select()
    .single();

  if (error) throw error;
  setCacheEntry(cache.progressByArticleId, articleId, data);
  notifyProgressUpdated(articleId, data);
  return data;
}

export async function getRewards(articleId: string): Promise<Reward[]> {
  if (!(await isAuthenticated())) {
    return guestStorage.getRewards(articleId);
  }

  const cached = getCacheEntry(cache.rewardsByArticleId, articleId);
  if (cached) {
    return cached;
  }

  const { data, error } = await supabase
    .from('rewards')
    .select('*')
    .eq('article_id', articleId);

  if (error) throw error;
  const result = data || [];
  setCacheEntry(cache.rewardsByArticleId, articleId, result);
  return result;
}

export async function claimReward(
  articleId: string,
  milestone: 30 | 60 | 80
): Promise<Reward | null> {
  if (!(await isAuthenticated())) {
    return guestStorage.claimReward(articleId, milestone);
  }

  const userId = await getUserId();
  const points = Math.floor(Math.random() * 41) + 10;

  const { data, error } = await supabase
    .from('rewards')
    .insert({
      article_id: articleId,
      user_id: userId,
      milestone,
      points,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return null;
    throw error;
  }
  const existing = cache.rewardsByArticleId.get(articleId)?.data || [];
  setCacheEntry(cache.rewardsByArticleId, articleId, [...existing, data]);
  return data;
}

export async function getTotalPoints(): Promise<number> {
  if (!(await isAuthenticated())) {
    return guestStorage.getTotalPoints();
  }

  const { data, error } = await supabase
    .from('rewards')
    .select('points');

  if (error) throw error;
  return data?.reduce((sum, r) => sum + r.points, 0) || 0;
}

export async function getBookmarks(articleId: string): Promise<string[]> {
  if (!(await isAuthenticated())) {
    return guestStorage.getBookmarks(articleId);
  }

  const { data: cards } = await supabase
    .from('cards')
    .select('id')
    .eq('article_id', articleId);

  if (!cards || cards.length === 0) return [];

  const cardIds = cards.map(c => c.id);

  const { data, error } = await supabase
    .from('bookmarks')
    .select('card_id')
    .in('card_id', cardIds);

  if (error) throw error;
  return data?.map(b => b.card_id) || [];
}

export async function toggleBookmark(cardId: string): Promise<boolean> {
  if (!(await isAuthenticated())) {
    return guestStorage.toggleBookmark(cardId);
  }

  const userId = await getUserId();

  const { data: existing } = await supabase
    .from('bookmarks')
    .select('id')
    .eq('card_id', cardId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) {
    await supabase.from('bookmarks').delete().eq('id', existing.id);
    return false;
  } else {
    await supabase.from('bookmarks').insert({ card_id: cardId, user_id: userId });
    return true;
  }
}

export async function getConversations(cardId: string): Promise<AIConversation[]> {
  if (!(await isAuthenticated())) {
    return guestStorage.getConversations(cardId);
  }

  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('card_id', cardId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getConversationCount(articleId: string): Promise<number> {
  if (!(await isAuthenticated())) {
    return guestStorage.getConversationCount(articleId);
  }

  const { data: cards } = await supabase
    .from('cards')
    .select('id')
    .eq('article_id', articleId);

  if (!cards || cards.length === 0) return 0;

  const cardIds = cards.map(c => c.id);

  const { count, error } = await supabase
    .from('ai_conversations')
    .select('*', { count: 'exact', head: true })
    .in('card_id', cardIds);

  if (error) throw error;
  return count || 0;
}

export async function saveConversation(
  cardId: string,
  questionType: string,
  question: string,
  answer: string
): Promise<AIConversation> {
  if (!(await isAuthenticated())) {
    return guestStorage.saveConversation(cardId, questionType, question, answer);
  }

  const userId = await getUserId();
  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({ card_id: cardId, question_type: questionType, question, answer, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getHighlights(cardId: string): Promise<Highlight[]> {
  if (!(await isAuthenticated())) {
    return guestStorage.getHighlights(cardId);
  }

  const { data, error } = await supabase
    .from('highlights')
    .select('*')
    .eq('card_id', cardId)
    .order('start_offset', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getAllHighlights(articleId: string): Promise<Map<string, Highlight[]>> {
  if (!(await isAuthenticated())) {
    return guestStorage.getAllHighlights(articleId);
  }

  const { data: cards } = await supabase
    .from('cards')
    .select('id')
    .eq('article_id', articleId);

  if (!cards || cards.length === 0) return new Map();

  const cardIds = cards.map(c => c.id);

  const { data, error } = await supabase
    .from('highlights')
    .select('*')
    .in('card_id', cardIds)
    .order('start_offset', { ascending: true });

  if (error) throw error;

  const result = new Map<string, Highlight[]>();
  for (const h of data || []) {
    const existing = result.get(h.card_id) || [];
    existing.push(h);
    result.set(h.card_id, existing);
  }
  return result;
}

export async function createHighlight(
  cardId: string,
  text: string,
  startOffset: number,
  endOffset: number,
  style: 'highlight' | 'underline' | 'bold',
  color: string
): Promise<Highlight> {
  if (!(await isAuthenticated())) {
    return guestStorage.createHighlight(cardId, text, startOffset, endOffset, style, color);
  }

  const userId = await getUserId();
  const { data, error } = await supabase
    .from('highlights')
    .insert({
      card_id: cardId,
      text,
      start_offset: startOffset,
      end_offset: endOffset,
      style,
      color,
      user_id: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteHighlight(id: string): Promise<void> {
  if (!(await isAuthenticated())) {
    return guestStorage.deleteHighlight(id);
  }

  const { error } = await supabase
    .from('highlights')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getDialogueMessages(articleId: string): Promise<DialogueMessage[]> {
  if (!(await isAuthenticated())) {
    return guestStorage.getDialogueMessages(articleId);
  }

  const cached = getCacheEntry(cache.dialogueByArticleId, articleId);
  if (cached) {
    return cached;
  }

  const { data, error } = await supabase
    .from('dialogue_messages')
    .select('*')
    .eq('article_id', articleId)
    .order('sequence_order', { ascending: true });

  if (error) throw error;
  const result = data || [];
  setCacheEntry(cache.dialogueByArticleId, articleId, result);
  return result;
}

export async function createDialogueMessages(
  articleId: string,
  messages: DialogueGenerationResult[]
): Promise<DialogueMessage[]> {
  if (!(await isAuthenticated())) {
    return guestStorage.createDialogueMessages(articleId, messages);
  }

  const messagesToInsert = messages.map((msg, index) => ({
    article_id: articleId,
    character_name: msg.character_name,
    avatar_seed: msg.avatar_seed,
    content: msg.content,
    sequence_order: index,
    is_right_side: msg.is_right_side,
    knowledge_point: msg.knowledge_point,
  }));

  const { data, error } = await supabase
    .from('dialogue_messages')
    .insert(messagesToInsert)
    .select();

  if (error) throw error;
  const result = data || [];
  const existing = cache.dialogueByArticleId.get(articleId)?.data || [];
  setCacheEntry(cache.dialogueByArticleId, articleId, [...existing, ...result]);
  updateArticleCount(articleId, 'messageCount', result.length);
  return result;
}

export async function getDialogueQAs(articleId: string): Promise<DialogueQA[]> {
  if (!(await isAuthenticated())) {
    return guestStorage.getDialogueQAs(articleId);
  }

  const { data, error } = await supabase
    .from('dialogue_qa')
    .select('*')
    .eq('article_id', articleId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getDialogueQAsByMessage(messageId: string): Promise<DialogueQA[]> {
  if (!(await isAuthenticated())) {
    return guestStorage.getDialogueQAsByMessage(messageId);
  }

  const { data, error } = await supabase
    .from('dialogue_qa')
    .select('*')
    .eq('message_id', messageId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function saveDialogueQA(
  messageId: string,
  articleId: string,
  question: string,
  answer: string,
  contextUpTo: number
): Promise<DialogueQA> {
  if (!(await isAuthenticated())) {
    return guestStorage.saveDialogueQA(messageId, articleId, question, answer, contextUpTo);
  }

  const userId = await getUserId();
  const { data, error } = await supabase
    .from('dialogue_qa')
    .insert({
      message_id: messageId,
      article_id: articleId,
      question,
      answer,
      context_up_to: contextUpTo,
      user_id: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getCardNote(cardId: string): Promise<CardNote | null> {
  if (!(await isAuthenticated())) {
    return guestStorage.getCardNote(cardId);
  }

  const { data, error } = await supabase
    .from('card_notes')
    .select('*')
    .eq('card_id', cardId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getAllCardNotes(articleId: string): Promise<Map<string, CardNote>> {
  if (!(await isAuthenticated())) {
    return guestStorage.getAllCardNotes(articleId);
  }

  const { data: cards } = await supabase
    .from('cards')
    .select('id')
    .eq('article_id', articleId);

  if (!cards || cards.length === 0) return new Map();

  const cardIds = cards.map(c => c.id);

  const { data, error } = await supabase
    .from('card_notes')
    .select('*')
    .in('card_id', cardIds);

  if (error) throw error;

  const result = new Map<string, CardNote>();
  for (const note of data || []) {
    result.set(note.card_id, note);
  }
  return result;
}

export async function upsertCardNote(cardId: string, content: string): Promise<CardNote> {
  if (!(await isAuthenticated())) {
    return guestStorage.upsertCardNote(cardId, content);
  }

  const userId = await getUserId();
  const { data, error } = await supabase
    .from('card_notes')
    .upsert({
      card_id: cardId,
      user_id: userId,
      content,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'user_id,card_id',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getGalgameMessages(articleId: string): Promise<GalgameMessage[]> {
  if (!(await isAuthenticated())) {
    return guestStorage.getGalgameMessages(articleId);
  }

  const cached = getCacheEntry(cache.galgameByArticleId, articleId);
  if (cached) {
    return cached;
  }

  const { data, error } = await supabase
    .from('galgame_messages')
    .select('*')
    .eq('article_id', articleId)
    .order('sequence_order', { ascending: true });

  if (error) throw error;
  const result = data || [];
  setCacheEntry(cache.galgameByArticleId, articleId, result);
  return result;
}

export async function getQuizQuestions(articleId: string): Promise<QuizQuestion[]> {
  if (!(await isAuthenticated())) {
    return guestStorage.getQuizQuestions(articleId);
  }

  if (missingTables.has('quiz_questions')) {
    return [];
  }

  const cached = getCacheEntry(cache.quizByArticleId, articleId);
  if (cached) {
    return cached;
  }

  const { data, error } = await supabase
    .from('quiz_questions')
    .select('*')
    .eq('article_id', articleId)
    .order('sequence_order', { ascending: true });

  if (error) {
    if (isMissingTableError(error)) {
      missingTables.add('quiz_questions');
      const result: QuizQuestion[] = [];
      setCacheEntry(cache.quizByArticleId, articleId, result);
      return result;
    }
    throw error;
  }
  const result = data || [];
  setCacheEntry(cache.quizByArticleId, articleId, result);
  return result;
}

export async function createGalgameMessages(
  articleId: string,
  messages: GalgameGenerationResult[]
): Promise<GalgameMessage[]> {
  if (!(await isAuthenticated())) {
    return guestStorage.createGalgameMessages(articleId, messages);
  }

  const messagesToInsert = messages.map((msg, index) => ({
    article_id: articleId,
    character_name: msg.character_name,
    avatar_seed: msg.avatar_seed,
    content: msg.content,
    sequence_order: index,
    emotion_emoji: msg.emotion_emoji,
    screen_effect: 'none',
    knowledge_point: msg.knowledge_point,
    position: msg.position,
  }));

  const { data, error } = await supabase
    .from('galgame_messages')
    .insert(messagesToInsert)
    .select();

  if (error) throw error;
  const result = data || [];
  const existing = cache.galgameByArticleId.get(articleId)?.data || [];
  setCacheEntry(cache.galgameByArticleId, articleId, [...existing, ...result]);
  updateArticleCount(articleId, 'galgameMessageCount', result.length);
  return result;
}

export async function createQuizQuestions(
  articleId: string,
  questions: QuizGenerationResult[]
): Promise<QuizQuestion[]> {
  if (!(await isAuthenticated())) {
    return guestStorage.createQuizQuestions(articleId, questions);
  }

  if (missingTables.has('quiz_questions')) {
    throw new Error('题库表未创建，请先执行 Supabase 迁移。');
  }

  const questionsToInsert = questions.map((question, index) => ({
    ...question,
    article_id: articleId,
    sequence_order: index,
  }));

  const { data, error } = await supabase
    .from('quiz_questions')
    .insert(questionsToInsert)
    .select();

  if (error) {
    if (isMissingTableError(error)) {
      missingTables.add('quiz_questions');
      throw new Error('题库表未创建，请先执行 Supabase 迁移。');
    }
    throw error;
  }
  const result = data || [];
  const existing = cache.quizByArticleId.get(articleId)?.data || [];
  setCacheEntry(cache.quizByArticleId, articleId, [...existing, ...result]);
  updateArticleCount(articleId, 'quizCount', result.length);
  return result;
}

export async function getArticleTextAnnotations(articleId: string): Promise<ArticleTextAnnotation[]> {
  if (!(await isAuthenticated())) {
    return guestStorage.getArticleTextAnnotations(articleId);
  }

  const { data, error } = await supabase
    .from('article_text_annotations')
    .select('*')
    .eq('article_id', articleId)
    .order('start_offset', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createArticleTextAnnotation(
  articleId: string,
  text: string,
  startOffset: number,
  endOffset: number,
  style: 'highlight' | 'underline' | 'bold',
  color: string
): Promise<ArticleTextAnnotation> {
  if (!(await isAuthenticated())) {
    return guestStorage.createArticleTextAnnotation(articleId, text, startOffset, endOffset, style, color);
  }

  const userId = await getUserId();
  const { data, error } = await supabase
    .from('article_text_annotations')
    .insert({
      article_id: articleId,
      user_id: userId,
      text,
      start_offset: startOffset,
      end_offset: endOffset,
      style,
      color,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteArticleTextAnnotation(id: string): Promise<void> {
  if (!(await isAuthenticated())) {
    return guestStorage.deleteArticleTextAnnotation(id);
  }

  const { error } = await supabase
    .from('article_text_annotations')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getArticleTextQAs(articleId: string): Promise<ArticleTextQA[]> {
  if (!(await isAuthenticated())) {
    return guestStorage.getArticleTextQAs(articleId);
  }

  const { data, error } = await supabase
    .from('article_text_qa')
    .select('*')
    .eq('article_id', articleId)
    .order('start_offset', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getArticleTextQAsByRange(
  articleId: string,
  startOffset: number,
  endOffset: number
): Promise<ArticleTextQA[]> {
  if (!(await isAuthenticated())) {
    return guestStorage.getArticleTextQAsByRange(articleId, startOffset, endOffset);
  }

  const { data, error } = await supabase
    .from('article_text_qa')
    .select('*')
    .eq('article_id', articleId)
    .eq('start_offset', startOffset)
    .eq('end_offset', endOffset)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function saveArticleTextQA(
  articleId: string,
  selectedText: string,
  startOffset: number,
  endOffset: number,
  question: string,
  answer: string,
  includeFullArticle: boolean
): Promise<ArticleTextQA> {
  if (!(await isAuthenticated())) {
    return guestStorage.saveArticleTextQA(articleId, selectedText, startOffset, endOffset, question, answer, includeFullArticle);
  }

  const userId = await getUserId();
  const { data, error } = await supabase
    .from('article_text_qa')
    .insert({
      article_id: articleId,
      user_id: userId,
      selected_text: selectedText,
      start_offset: startOffset,
      end_offset: endOffset,
      question,
      answer,
      include_full_article: includeFullArticle,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export { supabase } from './supabase';
