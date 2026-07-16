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
  ArticleTag,
  Subject,
  ArticleSourceMetadata,
  LearningMode,
} from '../types';

const STORAGE_PREFIX = 'guest_';
const memoryStore = new Map<string, unknown>();

function generateId(): string {
  return crypto.randomUUID();
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

export function clearGuestData(): void {
  memoryStore.clear();
  if (typeof window === 'undefined') return;

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(STORAGE_PREFIX)) {
      window.localStorage.removeItem(key);
    }
  }
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

function getProgressKey(articleId: string, mode: LearningMode): string {
  return `${articleId}:${mode}`;
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

function getQuizQuestionsStore(articleId: string): QuizQuestion[] {
  return getItem<QuizQuestion[]>(`quiz_${articleId}`) || [];
}

function setQuizQuestionsStore(articleId: string, questions: QuizQuestion[]): void {
  setItem(`quiz_${articleId}`, questions);
}

function getTagsStore(): Tag[] {
  return getItem<Tag[]>('tags') || [];
}

function setTagsStore(tags: Tag[]): void {
  setItem('tags', tags);
}

function getArticleTagsStore(): ArticleTag[] {
  return getItem<ArticleTag[]>('article_tags') || [];
}

function setArticleTagsStore(articleTags: ArticleTag[]): void {
  setItem('article_tags', articleTags);
}

function getSubjectsStore(): Subject[] {
  return getItem<Subject[]>('subjects') || [];
}

function setSubjectsStore(subjects: Subject[]): void {
  setItem('subjects', subjects);
}

export async function getArticles(): Promise<ArticleWithProgress[]> {
  const articles = getArticlesStore();
  const progressStore = getProgressStore();
  const articleTags = getArticleTagsStore();

  return articles.map(article => {
    const progress = progressStore[getProgressKey(article.id, 'card')];
    const cards = getCardsStore(article.id);
    const dialogueMessages = getDialogueMessagesStore(article.id);
    const galgameMessages = getGalgameMessagesStore(article.id);
    const quizQuestions = getQuizQuestionsStore(article.id);
    const tagIds = articleTags.filter(tag => tag.article_id === article.id).map(tag => tag.tag_id);
    return {
      ...article,
      tagIds,
      progress,
      cardCount: cards.length,
      messageCount: dialogueMessages.length,
      galgameMessageCount: galgameMessages.length,
      quizCount: quizQuestions.length,
    };
  });
}

export async function getArticle(id: string): Promise<Article | null> {
  const articles = getArticlesStore();
  const article = articles.find(a => a.id === id) || null;
  if (!article) return null;
  const tagIds = getArticleTagsStore()
    .filter(tag => tag.article_id === id)
    .map(tag => tag.tag_id);
  return { ...article, tagIds };
}

export async function createArticle(
  title: string,
  content: string,
  mode: ArticleMode = 'source',
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
  const articles = getArticlesStore();
  setArticlesStore(articles.filter(a => a.id !== id));

  removeItem(`cards_${id}`);
  removeItem(`dialogue_${id}`);
  removeItem(`galgame_${id}`);
  removeItem(`quiz_${id}`);

  const progressStore = getProgressStore();
  for (const key of Object.keys(progressStore)) {
    if (key.startsWith(`${id}:`)) delete progressStore[key];
  }
  setProgressStore(progressStore);

  const rewards = getRewardsStore();
  setRewardsStore(rewards.filter(r => r.article_id !== id));

  const articleTags = getArticleTagsStore();
  setArticleTagsStore(articleTags.filter(tag => tag.article_id !== id));
}

export async function getSubjects(): Promise<Subject[]> {
  return getSubjectsStore().sort((a, b) => a.name.localeCompare(b.name));
}

export async function createSubject(name: string): Promise<Subject> {
  const normalized = name.trim();
  const subjects = getSubjectsStore();
  const existing = subjects.find(subject => subject.name.toLowerCase() === normalized.toLowerCase());
  if (existing) return existing;
  const subject: Subject = {
    id: generateId(),
    name: normalized,
    created_at: new Date().toISOString(),
  };
  subjects.push(subject);
  setSubjectsStore(subjects);
  return subject;
}

export async function getTags(): Promise<Tag[]> {
  return getTagsStore();
}

export async function createTag(name: string, parentId: string | null): Promise<Tag> {
  const tag: Tag = {
    id: generateId(),
    name,
    parent_id: parentId,
    created_at: new Date().toISOString(),
  };
  const tags = getTagsStore();
  tags.push(tag);
  setTagsStore(tags);
  return tag;
}

export async function setArticleTags(articleId: string, tagIds: string[]): Promise<void> {
  const articleTags = getArticleTagsStore().filter(tag => tag.article_id !== articleId);
  const next = [
    ...articleTags,
    ...tagIds.map(tagId => ({
      id: generateId(),
      article_id: articleId,
      tag_id: tagId,
      created_at: new Date().toISOString(),
    })),
  ];
  setArticleTagsStore(next);
}

export async function getArticleTagsForArticles(articleIds: string[]): Promise<Map<string, string[]>> {
  const articleTags = getArticleTagsStore();
  const result = new Map<string, string[]>();
  for (const articleId of articleIds) {
    result.set(articleId, []);
  }
  for (const tag of articleTags) {
    if (!result.has(tag.article_id)) continue;
    const list = result.get(tag.article_id) || [];
    list.push(tag.tag_id);
    result.set(tag.article_id, list);
  }
  return result;
}

export async function getCards(articleId: string): Promise<Card[]> {
  return getCardsStore(articleId);
}

export async function createCards(
  articleId: string,
  cards: Omit<Card, 'id' | 'article_id' | 'created_at' | 'sequence_order'>[]
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

export async function getProgress(
  articleId: string,
  mode: LearningMode = 'card'
): Promise<LearningProgress | null> {
  const progressStore = getProgressStore();
  return progressStore[getProgressKey(articleId, mode)] || null;
}

export async function upsertProgress(
  articleId: string,
  currentIndex: number,
  totalCount: number,
  mode: LearningMode = 'card'
): Promise<LearningProgress> {
  const progressStore = getProgressStore();
  const progressKey = getProgressKey(articleId, mode);
  const existing = progressStore[progressKey];

  const progress: LearningProgress = {
    id: existing?.id || generateId(),
    article_id: articleId,
    mode,
    current_index: currentIndex,
    completed_count: currentIndex + 1,
    total_count: totalCount,
    last_read_at: new Date().toISOString(),
  };

  progressStore[progressKey] = progress;
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

export async function getQuizQuestions(articleId: string): Promise<QuizQuestion[]> {
  return getQuizQuestionsStore(articleId);
}

export async function createQuizQuestions(
  articleId: string,
  questions: QuizGenerationResult[]
): Promise<QuizQuestion[]> {
  const newQuestions: QuizQuestion[] = questions.map((question, index) => ({
    ...question,
    id: generateId(),
    article_id: articleId,
    sequence_order: index,
    created_at: new Date().toISOString(),
  }));

  setQuizQuestionsStore(articleId, newQuestions);
  return newQuestions;
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
    screen_effect: 'none',
    knowledge_point: msg.knowledge_point,
    position: msg.position,
    created_at: new Date().toISOString(),
  }));

  setGalgameMessagesStore(articleId, newMessages);
  return newMessages;
}

export function clearAllGuestData(): void {
  clearGuestData();
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
