export type ArticleMode = 'source' | 'card' | 'dialogue' | 'galgame';
export type SourceType = 'text' | 'pdf' | 'url' | 'ai';
export type LearningMode = 'card' | 'dialogue' | 'galgame';

export interface Article {
  id: string;
  title: string;
  original_content: string;
  mode: ArticleMode;
  characters?: string;
  subject_id?: string | null;
  source_type?: SourceType;
  source_url?: string | null;
  tagIds?: string[];
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
  mode: LearningMode;
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

export interface ArticleWithProgress extends Article {
  progress?: LearningProgress;
  cardCount?: number;
}

export interface ArticleSourceMetadata {
  subjectId?: string | null;
  sourceType?: SourceType;
  sourceUrl?: string | null;
}

export interface CardSplitResult {
  content: string;
  semantic_label: string;
  context_summary: string;
}

export type PathNodeKind = 'stop' | 'chest';
export type PathNodeStatus = 'done' | 'current' | 'locked' | 'opened';

export interface PathNode {
  id: string;
  kind: PathNodeKind;
  status: PathNodeStatus;
  label: string;
  actionLabel?: string;
  number?: number;
  /** Inclusive card index range for this stop */
  cardStart?: number;
  cardEnd?: number;
}
