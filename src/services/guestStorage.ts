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

const STORAGE_PREFIX = 'guest_';

function generateId(): string {
  return crypto.randomUUID();
}

function getItem<T>(key: string): T | null {
  const item = localStorage.getItem(STORAGE_PREFIX + key);
  return item ? JSON.parse(item) : null;
}

function setItem<T>(key: string, value: T): void {
  localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value));
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

function getBookmarksStore(): string[] {
  return getItem<string[]>('bookmarks') || [];
}

function setBookmarksStore(bookmarks: string[]): void {
  setItem('bookmarks', bookmarks);
}

function getConversationsStore(): AIConversation[] {
  return getItem<AIConversation[]>('conversations') || [];
}

function setConversationsStore(conversations: AIConversation[]): void {
  setItem('conversations', conversations);
}

function getHighlightsStore(): Highlight[] {
  return getItem<Highlight[]>('highlights') || [];
}

function setHighlightsStore(highlights: Highlight[]): void {
  setItem('highlights', highlights);
}

function getNotesStore(): CardNote[] {
  return getItem<CardNote[]>('notes') || [];
}

function setNotesStore(notes: CardNote[]): void {
  setItem('notes', notes);
}

function getDialogueMessagesStore(articleId: string): DialogueMessage[] {
  return getItem<DialogueMessage[]>(`dialogue_${articleId}`) || [];
}

function setDialogueMessagesStore(articleId: string, messages: DialogueMessage[]): void {
  setItem(`dialogue_${articleId}`, messages);
}

function getDialogueQAStore(): DialogueQA[] {
  return getItem<DialogueQA[]>('dialogue_qa') || [];
}

function setDialogueQAStore(qas: DialogueQA[]): void {
  setItem('dialogue_qa', qas);
}

function getGalgameMessagesStore(articleId: string): GalgameMessage[] {
  return getItem<GalgameMessage[]>(`galgame_${articleId}`) || [];
}

function setGalgameMessagesStore(articleId: string, messages: GalgameMessage[]): void {
  setItem(`galgame_${articleId}`, messages);
}

export async function getArticles(): Promise<ArticleWithProgress[]> {
  const articles = getArticlesStore();
  const progressStore = getProgressStore();

  return articles.map(article => {
    const progress = progressStore[article.id];
    if (article.mode === 'dialogue') {
      const messages = getDialogueMessagesStore(article.id);
      return { ...article, progress, messageCount: messages.length };
    } else if (article.mode === 'galgame') {
      const messages = getGalgameMessagesStore(article.id);
      return { ...article, progress, galgameMessageCount: messages.length };
    } else {
      const cards = getCardsStore(article.id);
      return { ...article, progress, cardCount: cards.length };
    }
  });
}

export async function getArticle(id: string): Promise<Article | null> {
  const articles = getArticlesStore();
  return articles.find(a => a.id === id) || null;
}

export async function createArticle(
  title: string,
  content: string,
  mode: ArticleMode = 'card',
  characters?: string
): Promise<Article> {
  const article: Article = {
    id: generateId(),
    title,
    original_content: content,
    mode,
    characters,
    created_at: new Date().toISOString(),
  };

  const articles = getArticlesStore();
  articles.unshift(article);
  setArticlesStore(articles);

  return article;
}

export async function deleteArticle(id: string): Promise<void> {
  const articles = getArticlesStore();
  setArticlesStore(articles.filter(a => a.id !== id));

  localStorage.removeItem(STORAGE_PREFIX + `cards_${id}`);
  localStorage.removeItem(STORAGE_PREFIX + `dialogue_${id}`);
  localStorage.removeItem(STORAGE_PREFIX + `galgame_${id}`);

  const progressStore = getProgressStore();
  delete progressStore[id];
  setProgressStore(progressStore);

  const rewards = getRewardsStore();
  setRewardsStore(rewards.filter(r => r.article_id !== id));
}

export async function getCards(articleId: string): Promise<Card[]> {
  return getCardsStore(articleId);
}

export async function createCards(
  articleId: string,
  cards: Omit<Card, 'id' | 'article_id' | 'created_at'>[]
): Promise<Card[]> {
  const newCards: Card[] = cards.map((card, index) => ({
    ...card,
    id: generateId(),
    article_id: articleId,
    sequence_order: index,
    created_at: new Date().toISOString(),
  }));

  setCardsStore(articleId, newCards);
  return newCards;
}

export async function getProgress(articleId: string): Promise<LearningProgress | null> {
  const progressStore = getProgressStore();
  return progressStore[articleId] || null;
}

export async function upsertProgress(
  articleId: string,
  currentIndex: number,
  totalCount: number
): Promise<LearningProgress> {
  const progressStore = getProgressStore();
  const existing = progressStore[articleId];

  const progress: LearningProgress = {
    id: existing?.id || generateId(),
    article_id: articleId,
    current_index: currentIndex,
    completed_count: currentIndex + 1,
    total_count: totalCount,
    last_read_at: new Date().toISOString(),
  };

  progressStore[articleId] = progress;
  setProgressStore(progressStore);

  return progress;
}

export async function getRewards(articleId: string): Promise<Reward[]> {
  const rewards = getRewardsStore();
  return rewards.filter(r => r.article_id === articleId);
}

export async function claimReward(
  articleId: string,
  milestone: 30 | 60 | 80
): Promise<Reward | null> {
  const rewards = getRewardsStore();
  const existing = rewards.find(r => r.article_id === articleId && r.milestone === milestone);
  if (existing) return null;

  const points = Math.floor(Math.random() * 41) + 10;
  const reward: Reward = {
    id: generateId(),
    article_id: articleId,
    milestone,
    points,
    claimed_at: new Date().toISOString(),
  };

  rewards.push(reward);
  setRewardsStore(rewards);

  return reward;
}

export async function getTotalPoints(): Promise<number> {
  const rewards = getRewardsStore();
  return rewards.reduce((sum, r) => sum + r.points, 0);
}

export async function getBookmarks(articleId: string): Promise<string[]> {
  const cards = getCardsStore(articleId);
  const cardIds = cards.map(c => c.id);
  const bookmarks = getBookmarksStore();
  return bookmarks.filter(b => cardIds.includes(b));
}

export async function toggleBookmark(cardId: string): Promise<boolean> {
  const bookmarks = getBookmarksStore();
  const index = bookmarks.indexOf(cardId);

  if (index > -1) {
    bookmarks.splice(index, 1);
    setBookmarksStore(bookmarks);
    return false;
  } else {
    bookmarks.push(cardId);
    setBookmarksStore(bookmarks);
    return true;
  }
}

export async function getConversations(cardId: string): Promise<AIConversation[]> {
  const conversations = getConversationsStore();
  return conversations.filter(c => c.card_id === cardId);
}

export async function getConversationCount(articleId: string): Promise<number> {
  const cards = getCardsStore(articleId);
  const cardIds = cards.map(c => c.id);
  const conversations = getConversationsStore();
  return conversations.filter(c => cardIds.includes(c.card_id)).length;
}

export async function saveConversation(
  cardId: string,
  questionType: string,
  question: string,
  answer: string
): Promise<AIConversation> {
  const conversation: AIConversation = {
    id: generateId(),
    card_id: cardId,
    question_type: questionType,
    question,
    answer,
    created_at: new Date().toISOString(),
  };

  const conversations = getConversationsStore();
  conversations.push(conversation);
  setConversationsStore(conversations);

  return conversation;
}

export async function getHighlights(cardId: string): Promise<Highlight[]> {
  const highlights = getHighlightsStore();
  return highlights.filter(h => h.card_id === cardId);
}

export async function getAllHighlights(articleId: string): Promise<Map<string, Highlight[]>> {
  const cards = getCardsStore(articleId);
  const cardIds = cards.map(c => c.id);
  const highlights = getHighlightsStore();

  const result = new Map<string, Highlight[]>();
  for (const h of highlights) {
    if (cardIds.includes(h.card_id)) {
      const existing = result.get(h.card_id) || [];
      existing.push(h);
      result.set(h.card_id, existing);
    }
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
  const highlight: Highlight = {
    id: generateId(),
    card_id: cardId,
    text,
    start_offset: startOffset,
    end_offset: endOffset,
    style,
    color,
    created_at: new Date().toISOString(),
  };

  const highlights = getHighlightsStore();
  highlights.push(highlight);
  setHighlightsStore(highlights);

  return highlight;
}

export async function deleteHighlight(id: string): Promise<void> {
  const highlights = getHighlightsStore();
  setHighlightsStore(highlights.filter(h => h.id !== id));
}

export async function getDialogueMessages(articleId: string): Promise<DialogueMessage[]> {
  return getDialogueMessagesStore(articleId);
}

export async function createDialogueMessages(
  articleId: string,
  messages: DialogueGenerationResult[]
): Promise<DialogueMessage[]> {
  const newMessages: DialogueMessage[] = messages.map((msg, index) => ({
    id: generateId(),
    article_id: articleId,
    character_name: msg.character_name,
    avatar_seed: msg.avatar_seed,
    content: msg.content,
    sequence_order: index,
    is_right_side: msg.is_right_side,
    knowledge_point: msg.knowledge_point,
    created_at: new Date().toISOString(),
  }));

  setDialogueMessagesStore(articleId, newMessages);
  return newMessages;
}

export async function getDialogueQAs(articleId: string): Promise<DialogueQA[]> {
  const qas = getDialogueQAStore();
  return qas.filter(qa => qa.article_id === articleId);
}

export async function getDialogueQAsByMessage(messageId: string): Promise<DialogueQA[]> {
  const qas = getDialogueQAStore();
  return qas.filter(qa => qa.message_id === messageId);
}

export async function saveDialogueQA(
  messageId: string,
  articleId: string,
  question: string,
  answer: string,
  contextUpTo: number
): Promise<DialogueQA> {
  const qa: DialogueQA = {
    id: generateId(),
    message_id: messageId,
    article_id: articleId,
    question,
    answer,
    context_up_to: contextUpTo,
    created_at: new Date().toISOString(),
  };

  const qas = getDialogueQAStore();
  qas.push(qa);
  setDialogueQAStore(qas);

  return qa;
}

export async function getCardNote(cardId: string): Promise<CardNote | null> {
  const notes = getNotesStore();
  return notes.find(n => n.card_id === cardId) || null;
}

export async function getAllCardNotes(articleId: string): Promise<Map<string, CardNote>> {
  const cards = getCardsStore(articleId);
  const cardIds = cards.map(c => c.id);
  const notes = getNotesStore();

  const result = new Map<string, CardNote>();
  for (const note of notes) {
    if (cardIds.includes(note.card_id)) {
      result.set(note.card_id, note);
    }
  }
  return result;
}

export async function upsertCardNote(cardId: string, content: string): Promise<CardNote> {
  const notes = getNotesStore();
  const existingIndex = notes.findIndex(n => n.card_id === cardId);

  const note: CardNote = {
    id: existingIndex > -1 ? notes[existingIndex].id : generateId(),
    card_id: cardId,
    content,
    created_at: existingIndex > -1 ? notes[existingIndex].created_at : new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (existingIndex > -1) {
    notes[existingIndex] = note;
  } else {
    notes.push(note);
  }
  setNotesStore(notes);

  return note;
}

export async function getGalgameMessages(articleId: string): Promise<GalgameMessage[]> {
  return getGalgameMessagesStore(articleId);
}

export async function createGalgameMessages(
  articleId: string,
  messages: GalgameGenerationResult[]
): Promise<GalgameMessage[]> {
  const newMessages: GalgameMessage[] = messages.map((msg, index) => ({
    id: generateId(),
    article_id: articleId,
    character_name: msg.character_name,
    avatar_seed: msg.avatar_seed,
    content: msg.content,
    sequence_order: index,
    emotion_emoji: msg.emotion_emoji,
    screen_effect: msg.screen_effect || 'none',
    knowledge_point: msg.knowledge_point,
    position: msg.position,
    created_at: new Date().toISOString(),
  }));

  setGalgameMessagesStore(articleId, newMessages);
  return newMessages;
}

export function clearAllGuestData(): void {
  const keys = Object.keys(localStorage);
  for (const key of keys) {
    if (key.startsWith(STORAGE_PREFIX)) {
      localStorage.removeItem(key);
    }
  }
}

function getArticleTextAnnotationsStore(): ArticleTextAnnotation[] {
  return getItem<ArticleTextAnnotation[]>('article_text_annotations') || [];
}

function setArticleTextAnnotationsStore(annotations: ArticleTextAnnotation[]): void {
  setItem('article_text_annotations', annotations);
}

function getArticleTextQAStore(): ArticleTextQA[] {
  return getItem<ArticleTextQA[]>('article_text_qa') || [];
}

function setArticleTextQAStore(qas: ArticleTextQA[]): void {
  setItem('article_text_qa', qas);
}

export async function getArticleTextAnnotations(articleId: string): Promise<ArticleTextAnnotation[]> {
  const annotations = getArticleTextAnnotationsStore();
  return annotations
    .filter(a => a.article_id === articleId)
    .sort((a, b) => a.start_offset - b.start_offset);
}

export async function createArticleTextAnnotation(
  articleId: string,
  text: string,
  startOffset: number,
  endOffset: number,
  style: 'highlight' | 'underline' | 'bold',
  color: string
): Promise<ArticleTextAnnotation> {
  const annotation: ArticleTextAnnotation = {
    id: generateId(),
    article_id: articleId,
    text,
    start_offset: startOffset,
    end_offset: endOffset,
    style,
    color,
    created_at: new Date().toISOString(),
  };

  const annotations = getArticleTextAnnotationsStore();
  annotations.push(annotation);
  setArticleTextAnnotationsStore(annotations);

  return annotation;
}

export async function deleteArticleTextAnnotation(id: string): Promise<void> {
  const annotations = getArticleTextAnnotationsStore();
  setArticleTextAnnotationsStore(annotations.filter(a => a.id !== id));
}

export async function getArticleTextQAs(articleId: string): Promise<ArticleTextQA[]> {
  const qas = getArticleTextQAStore();
  return qas
    .filter(qa => qa.article_id === articleId)
    .sort((a, b) => a.start_offset - b.start_offset);
}

export async function getArticleTextQAsByRange(
  articleId: string,
  startOffset: number,
  endOffset: number
): Promise<ArticleTextQA[]> {
  const qas = getArticleTextQAStore();
  return qas
    .filter(qa =>
      qa.article_id === articleId &&
      qa.start_offset === startOffset &&
      qa.end_offset === endOffset
    )
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
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
  const qa: ArticleTextQA = {
    id: generateId(),
    article_id: articleId,
    selected_text: selectedText,
    start_offset: startOffset,
    end_offset: endOffset,
    question,
    answer,
    include_full_article: includeFullArticle,
    created_at: new Date().toISOString(),
  };

  const qas = getArticleTextQAStore();
  qas.push(qa);
  setArticleTextQAStore(qas);

  return qa;
}
