export type ArticleMode = 'source' | 'card' | 'dialogue' | 'galgame';

export type ScreenEffect = 'none' | 'shake' | 'flash' | 'pulse';
export type CharacterPosition = 'left' | 'right' | 'center';

export interface Article {
  id: string;
  title: string;
  original_content: string;
  mode: ArticleMode;
  characters?: string;
  created_at: string;
}

export interface Card {
  id: string;
  article_id: string;
  content: string;
  sequence_order: number;
  semantic_label: string;
  context_summary: string;
  created_at: string;
}

export interface LearningProgress {
  id: string;
  article_id: string;
  current_index: number;
  completed_count: number;
  total_count: number;
  last_read_at: string;
}

export interface Reward {
  id: string;
  article_id: string;
  milestone: 30 | 60 | 80;
  points: number;
  claimed_at: string;
}

export interface Bookmark {
  id: string;
  card_id: string;
  created_at: string;
}

export interface ArticleWithProgress extends Article {
  progress?: LearningProgress;
  cardCount?: number;
  messageCount?: number;
  galgameMessageCount?: number;
  quizCount?: number;
}

export interface DialogueMessage {
  id: string;
  article_id: string;
  character_name: string;
  avatar_seed: string;
  content: string;
  sequence_order: number;
  is_right_side: boolean;
  knowledge_point?: string;
  created_at: string;
}

export interface DialogueQA {
  id: string;
  message_id: string;
  article_id: string;
  question: string;
  answer: string;
  context_up_to: number;
  created_at: string;
}

export interface DialogueGenerationResult {
  character_name: string;
  avatar_seed: string;
  content: string;
  is_right_side: boolean;
  knowledge_point?: string;
}

export interface CardSplitResult {
  content: string;
  semantic_label: string;
  context_summary: string;
}

export interface AIExplanationRequest {
  cardContent: string;
  previousCards: string[];
  questionType: 'story' | 'beginner' | 'connect' | 'custom';
  customQuestion?: string;
}

export interface AIConversation {
  id: string;
  card_id: string;
  question_type: string;
  question: string;
  answer: string;
  created_at: string;
}

export interface Highlight {
  id: string;
  card_id: string;
  text: string;
  start_offset: number;
  end_offset: number;
  style: 'highlight' | 'underline' | 'bold';
  color: string;
  created_at: string;
}

export interface CardNote {
  id: string;
  card_id: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface GalgameMessage {
  id: string;
  article_id: string;
  character_name: string;
  avatar_seed: string;
  content: string;
  sequence_order: number;
  emotion_emoji?: string;
  screen_effect: ScreenEffect;
  knowledge_point?: string;
  position: CharacterPosition;
  created_at: string;
}

export interface GalgameGenerationResult {
  character_name: string;
  avatar_seed: string;
  content: string;
  emotion_emoji?: string;
  screen_effect?: ScreenEffect;
  knowledge_point?: string;
  position: CharacterPosition;
}

export interface GalgameCharacter {
  name: string;
  description: string;
  avatarSeed: string;
}

export interface ArticleTextAnnotation {
  id: string;
  article_id: string;
  text: string;
  start_offset: number;
  end_offset: number;
  style: 'highlight' | 'underline' | 'bold';
  color: string;
  created_at: string;
}

export interface ArticleTextQA {
  id: string;
  article_id: string;
  selected_text: string;
  start_offset: number;
  end_offset: number;
  question: string;
  answer: string;
  include_full_article: boolean;
  created_at: string;
}

export interface QuizQuestion {
  id: string;
  article_id: string;
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  sequence_order: number;
  created_at: string;
}

export interface QuizGenerationResult {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}
