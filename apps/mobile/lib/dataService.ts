import * as guestStorage from './guestStorage';
import { getSessionUserId, isSupabaseConfigured, supabase } from './supabase';
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

async function isAuthenticated(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  return Boolean(await getSessionUserId());
}

async function requireUserId(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) throw new Error('请先登录');
  return userId;
}

export function resetDataServiceState(): void {
  // Intentionally empty — mobile keeps no long-lived cache across auth switches yet.
}

export async function getArticles(): Promise<ArticleWithProgress[]> {
  if (!(await isAuthenticated())) {
    return guestStorage.getArticles();
  }

  const { data: articles, error } = await supabase
    .from('articles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!articles) return [];

  const articleIds = articles.map((a) => a.id);
  const [{ data: progressRows }, { data: cardRows }] = await Promise.all([
    supabase.from('learning_progress').select('*').in('article_id', articleIds).eq('mode', 'card'),
    supabase.from('cards').select('article_id').in('article_id', articleIds),
  ]);

  const progressMap = new Map<string, LearningProgress>();
  for (const row of progressRows || []) {
    progressMap.set(row.article_id, row);
  }
  const cardCountMap = new Map<string, number>();
  for (const row of cardRows || []) {
    cardCountMap.set(row.article_id, (cardCountMap.get(row.article_id) || 0) + 1);
  }

  return articles.map((article) => ({
    ...article,
    progress: progressMap.get(article.id),
    cardCount: cardCountMap.get(article.id) || 0,
  }));
}

export async function getArticle(id: string): Promise<Article | null> {
  if (!(await isAuthenticated())) {
    return guestStorage.getArticle(id);
  }

  const { data, error } = await supabase.from('articles').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function createArticle(
  title: string,
  content: string,
  mode: ArticleMode = 'card',
  characters?: string,
  metadata: ArticleSourceMetadata = {}
): Promise<Article> {
  if (!(await isAuthenticated())) {
    return guestStorage.createArticle(title, content, mode, characters, metadata);
  }

  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('articles')
    .insert({
      title,
      original_content: content,
      mode,
      characters,
      subject_id: metadata.subjectId ?? null,
      source_type: metadata.sourceType ?? 'text',
      source_url: metadata.sourceUrl ?? null,
      user_id: userId,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteArticle(id: string): Promise<void> {
  if (!(await isAuthenticated())) {
    return guestStorage.deleteArticle(id);
  }

  const { error } = await supabase.from('articles').delete().eq('id', id);
  if (error) throw error;
}

export async function getCards(articleId: string): Promise<Card[]> {
  if (!(await isAuthenticated())) {
    return guestStorage.getCards(articleId);
  }

  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('article_id', articleId)
    .order('sequence_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createCards(
  articleId: string,
  cards: Omit<Card, 'id' | 'article_id' | 'created_at' | 'sequence_order'>[]
): Promise<Card[]> {
  if (!(await isAuthenticated())) {
    return guestStorage.createCards(articleId, cards);
  }

  const cardsToInsert = cards.map((card, index) => ({
    ...card,
    article_id: articleId,
    sequence_order: index,
  }));

  const { data, error } = await supabase.from('cards').insert(cardsToInsert).select();
  if (error) throw error;
  return data || [];
}

export async function getProgress(
  articleId: string,
  mode: LearningMode = 'card'
): Promise<LearningProgress | null> {
  if (!(await isAuthenticated())) {
    return guestStorage.getProgress(articleId, mode);
  }

  const { data, error } = await supabase
    .from('learning_progress')
    .select('*')
    .eq('article_id', articleId)
    .eq('mode', mode)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertProgress(
  articleId: string,
  currentIndex: number,
  totalCount: number,
  mode: LearningMode = 'card'
): Promise<LearningProgress> {
  if (!(await isAuthenticated())) {
    return guestStorage.upsertProgress(articleId, currentIndex, totalCount, mode);
  }

  const userId = await requireUserId();
  const { data, error } = await supabase
    .from('learning_progress')
    .upsert(
      {
        article_id: articleId,
        mode,
        current_index: currentIndex,
        completed_count: currentIndex + 1,
        total_count: totalCount,
        last_read_at: new Date().toISOString(),
        user_id: userId,
      },
      { onConflict: 'user_id,article_id,mode' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getTotalPoints(): Promise<number> {
  if (!(await isAuthenticated())) {
    return guestStorage.getTotalPoints();
  }

  const { data, error } = await supabase.from('rewards').select('points');
  if (error) throw error;
  return data?.reduce((sum, r) => sum + r.points, 0) || 0;
}

export async function claimReward(
  articleId: string,
  milestone: 30 | 60 | 80
): Promise<Reward | null> {
  if (!(await isAuthenticated())) {
    return guestStorage.claimReward(articleId, milestone);
  }

  const userId = await requireUserId();
  const points = Math.floor(Math.random() * 41) + 10;
  const { data, error } = await supabase
    .from('rewards')
    .insert({
      article_id: articleId,
      milestone,
      points,
      user_id: userId,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return null;
    throw error;
  }
  return data;
}
