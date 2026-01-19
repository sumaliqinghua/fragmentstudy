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
} from '../types';

async function getUserId(): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id || null;
}

async function isAuthenticated(): Promise<boolean> {
  const userId = await getUserId();
  return userId !== null;
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

  const articlesWithProgress: ArticleWithProgress[] = [];

  for (const article of articles) {
    const { data: progress } = await supabase
      .from('learning_progress')
      .select('*')
      .eq('article_id', article.id)
      .maybeSingle();

    if (article.mode === 'dialogue') {
      const { count } = await supabase
        .from('dialogue_messages')
        .select('*', { count: 'exact', head: true })
        .eq('article_id', article.id);

      articlesWithProgress.push({
        ...article,
        progress: progress || undefined,
        messageCount: count || 0,
      });
    } else if (article.mode === 'galgame') {
      const { count } = await supabase
        .from('galgame_messages')
        .select('*', { count: 'exact', head: true })
        .eq('article_id', article.id);

      articlesWithProgress.push({
        ...article,
        progress: progress || undefined,
        galgameMessageCount: count || 0,
      });
    } else {
      const { count } = await supabase
        .from('cards')
        .select('*', { count: 'exact', head: true })
        .eq('article_id', article.id);

      articlesWithProgress.push({
        ...article,
        progress: progress || undefined,
        cardCount: count || 0,
      });
    }
  }

  return articlesWithProgress;
}

export async function getArticle(id: string): Promise<Article | null> {
  if (!(await isAuthenticated())) {
    return guestStorage.getArticle(id);
  }

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
  mode: ArticleMode = 'card',
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
  cards: Omit<Card, 'id' | 'article_id' | 'created_at'>[]
): Promise<Card[]> {
  if (!(await isAuthenticated())) {
    return guestStorage.createCards(articleId, cards);
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
  return data || [];
}

export async function getProgress(articleId: string): Promise<LearningProgress | null> {
  if (!(await isAuthenticated())) {
    return guestStorage.getProgress(articleId);
  }

  const { data, error } = await supabase
    .from('learning_progress')
    .select('*')
    .eq('article_id', articleId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertProgress(
  articleId: string,
  currentIndex: number,
  totalCount: number
): Promise<LearningProgress> {
  if (!(await isAuthenticated())) {
    return guestStorage.upsertProgress(articleId, currentIndex, totalCount);
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
  return data;
}

export async function getRewards(articleId: string): Promise<Reward[]> {
  if (!(await isAuthenticated())) {
    return guestStorage.getRewards(articleId);
  }

  const { data, error } = await supabase
    .from('rewards')
    .select('*')
    .eq('article_id', articleId);

  if (error) throw error;
  return data || [];
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
  return data || [];
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

  const { data, error } = await supabase
    .from('galgame_messages')
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
    screen_effect: msg.screen_effect || 'none',
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
