import { createClient } from '@supabase/supabase-js';
import type { Article, Card, LearningProgress, Reward, ArticleWithProgress, AIConversation, Highlight, DialogueMessage, DialogueQA, DialogueGenerationResult, ArticleMode, CardNote, GalgameMessage, GalgameGenerationResult, QuizQuestion, QuizGenerationResult } from '../types';
import { resolveSupabaseConfig } from './supabaseConfig';

const supabaseConfig = resolveSupabaseConfig(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  import.meta.env.VITE_SUPABASE_BROWSER_URL
);

export const isSupabaseConfigured = supabaseConfig.isConfigured;
export const supabaseConfigError = supabaseConfig.error;
export const supabaseApiUrl = supabaseConfig.url;

export const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
  auth: { persistSession: isSupabaseConfigured },
});

export async function getArticles(): Promise<ArticleWithProgress[]> {
  const { data: articles, error } = await supabase
    .from('articles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  if (!articles) return [];

  const articlesWithProgress: ArticleWithProgress[] = [];

  for (const article of articles) {
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

    articlesWithProgress.push({
      ...article,
      progress: progress || undefined,
      cardCount: cardCount || 0,
      messageCount: messageCount || 0,
      galgameMessageCount: galgameMessageCount || 0,
      quizCount: quizCount || 0,
    });
  }

  return articlesWithProgress;
}

export async function getArticle(id: string): Promise<Article | null> {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function createArticle(
  title: string,
  content: string,
  mode: ArticleMode = 'source',
  characters?: string
): Promise<Article> {
  const { data, error } = await supabase
    .from('articles')
    .insert({ title, original_content: content, mode, characters })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteArticle(id: string): Promise<void> {
  const { error } = await supabase
    .from('articles')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getCards(articleId: string): Promise<Card[]> {
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .eq('article_id', articleId)
    .order('sequence_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createCards(articleId: string, cards: Omit<Card, 'id' | 'article_id' | 'created_at' | 'sequence_order'>[]): Promise<Card[]> {
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
  return data || [];
}

export async function getProgress(articleId: string): Promise<LearningProgress | null> {
  const { data, error } = await supabase
    .from('learning_progress')
    .select('*')
    .eq('article_id', articleId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertProgress(articleId: string, currentIndex: number, totalCount: number): Promise<LearningProgress> {
  const completedCount = currentIndex + 1;

  const { data, error } = await supabase
    .from('learning_progress')
    .upsert({
      article_id: articleId,
      current_index: currentIndex,
      completed_count: completedCount,
      total_count: totalCount,
      last_read_at: new Date().toISOString(),
    }, {
      onConflict: 'article_id',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getRewards(articleId: string): Promise<Reward[]> {
  const { data, error } = await supabase
    .from('rewards')
    .select('*')
    .eq('article_id', articleId);

  if (error) throw error;
  return data || [];
}

export async function claimReward(articleId: string, milestone: 30 | 60 | 80): Promise<Reward | null> {
  const points = Math.floor(Math.random() * 41) + 10;

  const { data, error } = await supabase
    .from('rewards')
    .insert({
      article_id: articleId,
      milestone,
      points,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') return null;
    throw error;
  }
  return data;
}

export async function getTotalPoints(): Promise<number> {
  const { data, error } = await supabase
    .from('rewards')
    .select('points');

  if (error) throw error;
  return data?.reduce((sum, r) => sum + r.points, 0) || 0;
}

export async function getBookmarks(articleId: string): Promise<string[]> {
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
  const { data: existing } = await supabase
    .from('bookmarks')
    .select('id')
    .eq('card_id', cardId)
    .maybeSingle();

  if (existing) {
    await supabase.from('bookmarks').delete().eq('card_id', cardId);
    return false;
  } else {
    await supabase.from('bookmarks').insert({ card_id: cardId });
    return true;
  }
}

export async function getConversations(cardId: string): Promise<AIConversation[]> {
  const { data, error } = await supabase
    .from('ai_conversations')
    .select('*')
    .eq('card_id', cardId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getConversationCount(articleId: string): Promise<number> {
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
  const { data, error } = await supabase
    .from('ai_conversations')
    .insert({ card_id: cardId, question_type: questionType, question, answer })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getHighlights(cardId: string): Promise<Highlight[]> {
  const { data, error } = await supabase
    .from('highlights')
    .select('*')
    .eq('card_id', cardId)
    .order('start_offset', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getAllHighlights(articleId: string): Promise<Map<string, Highlight[]>> {
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
  const { data, error } = await supabase
    .from('highlights')
    .insert({
      card_id: cardId,
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

export async function deleteHighlight(id: string): Promise<void> {
  const { error } = await supabase
    .from('highlights')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function getDialogueMessages(articleId: string): Promise<DialogueMessage[]> {
  const { data, error } = await supabase
    .from('dialogue_messages')
    .select('*')
    .eq('article_id', articleId)
    .order('sequence_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createDialogueMessages(
  articleId: string,
  messages: DialogueGenerationResult[]
): Promise<DialogueMessage[]> {
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
  return data || [];
}

export async function getDialogueQAs(articleId: string): Promise<DialogueQA[]> {
  const { data, error } = await supabase
    .from('dialogue_qa')
    .select('*')
    .eq('article_id', articleId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getDialogueQAsByMessage(messageId: string): Promise<DialogueQA[]> {
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
  const { data, error } = await supabase
    .from('dialogue_qa')
    .insert({
      message_id: messageId,
      article_id: articleId,
      question,
      answer,
      context_up_to: contextUpTo,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getCardNote(cardId: string): Promise<CardNote | null> {
  const { data, error } = await supabase
    .from('card_notes')
    .select('*')
    .eq('card_id', cardId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getAllCardNotes(articleId: string): Promise<Map<string, CardNote>> {
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
  const { data, error } = await supabase
    .from('card_notes')
    .upsert({
      card_id: cardId,
      content,
      updated_at: new Date().toISOString(),
    }, {
      onConflict: 'card_id',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getGalgameMessages(articleId: string): Promise<GalgameMessage[]> {
  const { data, error } = await supabase
    .from('galgame_messages')
    .select('*')
    .eq('article_id', articleId)
    .order('sequence_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getQuizQuestions(articleId: string): Promise<QuizQuestion[]> {
  const { data, error } = await supabase
    .from('quiz_questions')
    .select('*')
    .eq('article_id', articleId)
    .order('sequence_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createGalgameMessages(
  articleId: string,
  messages: GalgameGenerationResult[]
): Promise<GalgameMessage[]> {
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
  return data || [];
}

export async function createQuizQuestions(
  articleId: string,
  questions: QuizGenerationResult[]
): Promise<QuizQuestion[]> {
  const questionsToInsert = questions.map((question, index) => ({
    ...question,
    article_id: articleId,
    sequence_order: index,
  }));

  const { data, error } = await supabase
    .from('quiz_questions')
    .insert(questionsToInsert)
    .select();

  if (error) throw error;
  return data || [];
}
