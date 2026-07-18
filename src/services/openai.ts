import type { CardSplitResult, AIExplanationRequest, DialogueGenerationResult, GalgameGenerationResult, QuizGenerationResult } from '../types';
import { buildPlatformAIRequest } from './aiRequest';
import {
  loadAIModel,
  resolveAIAvailability,
  saveAIModel,
} from './aiConfig';
import { streamOpenAIContent } from './aiStream';
import { isSupabaseConfigured, supabase, supabaseApiUrl } from './supabase';

interface OpenAIConfig {
  model: string;
}

export class AIResponseParseError extends Error {
  rawText: string;

  constructor(message: string, rawText: string) {
    super(message);
    this.name = 'AIResponseParseError';
    this.rawText = rawText;
  }
}

function getProxyUrl(): string {
  if (import.meta.env.DEV && import.meta.env.VITE_LOCAL_AI_CONFIGURED) {
    return '/openai-proxy';
  }
  return `${supabaseApiUrl}/functions/v1/openai-proxy`;
}

export function getOpenAIConfig(): OpenAIConfig {
  return { model: loadAIModel() };
}

export function saveOpenAIConfig(config: OpenAIConfig): void {
  saveAIModel(config.model);
}

export function isConfigured(): boolean {
  return resolveAIAvailability(
    import.meta.env.VITE_PLATFORM_AI_ENABLED,
    Boolean(import.meta.env.VITE_LOCAL_AI_CONFIGURED)
  );
}

type OpenAIResponseFormat = {
  type: 'json_schema';
  json_schema: {
    name: string;
    schema: {
      type: string;
      properties?: Record<string, unknown>;
      items?: Record<string, unknown>;
      required?: string[];
      additionalProperties?: boolean;
    };
  };
};

async function callOpenAI(
  messages: { role: string; content: string }[],
  stream = false,
  responseFormat?: OpenAIResponseFormat | null
): Promise<Response> {
  if (!isConfigured()) {
    throw new Error('AI 服务暂未配置');
  }
  if (!isSupabaseConfigured) {
    throw new Error('请先配置 Supabase 并登录后使用 AI 生成功能');
  }

  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !session?.access_token) {
    throw new Error('请先登录后使用 AI 生成功能');
  }

  const defaultArrayFormat: OpenAIResponseFormat | undefined = stream
    ? undefined
    : {
        type: 'json_schema',
        json_schema: {
          name: 'json_array',
          schema: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: true,
            },
          },
        },
      };
  const finalResponseFormat = responseFormat === null ? undefined : (responseFormat ?? defaultArrayFormat);

  const request = buildPlatformAIRequest({
    accessToken: session.access_token,
    model: getOpenAIConfig().model,
    messages,
    stream,
    temperature: 0.7,
    responseFormat: finalResponseFormat,
  });

  const response = await fetch(getProxyUrl(), {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify(request.body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { error?: string | { message?: string } };
    const message = typeof error.error === 'string' ? error.error : error.error?.message;
    throw new Error(message || `API 请求失败: ${response.status}`);
  }

  return response;
}

function extractJsonPayload(resultText: string): string {
  const withoutThink = resultText.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
  const fencedMatch = withoutThink.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch) {
    return fencedMatch[1].trim();
  }
  return withoutThink;
}

function parseJsonArray<T>(resultText: string): T[] {
  const cleanedText = extractJsonPayload(resultText);
  const jsonMatch = cleanedText.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new AIResponseParseError('AI 返回格式错误，请重试', cleanedText || resultText);
  }

  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    throw new AIResponseParseError('AI 返回的 JSON 无法解析，请复制后手动修正', cleanedText || resultText);
  }
}


export async function splitArticle(content: string): Promise<CardSplitResult[]> {
  const systemPrompt = `你是一个专业的教育内容拆分专家。你的任务是将长文章按语义结构拆分成适合碎片化学习的卡片。

拆分原则：
1. 按语义单元拆分，而非按字数。每张卡片应该是一个完整的知识点、概念、例子或论点。
2. 卡片长度适中，便于快速阅读和理解（通常50-200字）。
3. 保持上下文连贯性，必要时可以有适当的过渡语。
4. 为每张卡片标注语义类型（如：概念定义、举例说明、核心论点、背景介绍、总结归纳等）。
5. 提供简短的上下文摘要，说明这张卡片与前后内容的关联。

请以 JSON 数组格式返回，每个元素包含：
- content: 卡片内容
- semantic_label: 语义类型标签
- context_summary: 上下文摘要（简短说明与前后的关联）

只返回 JSON 数组，不要其他内容。`;

  const response = await callOpenAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `请将以下文章拆分成学习卡片：\n\n${content}` },
  ], false, null);

  const data = await response.json();
  const resultText = data.choices[0]?.message?.content || '[]';

  const rawCards = parseJsonArray<Partial<CardSplitResult> & {
    text?: string;
    label?: string;
    context?: string;
  }>(resultText);
  const cards = rawCards
    .map(card => ({
      content: String(card.content || card.text || '').trim(),
      semantic_label: String(card.semantic_label || card.label || '知识片段').trim(),
      context_summary: String(card.context_summary || card.context || '来自当前资料').trim(),
    }))
    .filter(card => card.content.length > 0);
  if (cards.length === 0) {
    throw new AIResponseParseError('AI 没有返回有效卡片内容，请重试', resultText);
  }
  return cards;
}

const questionTypePrompts: Record<string, string> = {
  story: '请用一个生动的故事或类比来解释这个知识点，帮助我更好地理解和记忆。',
  beginner: '请用最简单、最通俗的语言解释这个内容，假设我是完全没有相关背景知识的初学者。',
  connect: '请结合我之前学习的内容，解释当前这张卡片的知识点，说明它们之间的关联和承接关系。',
};

export async function* explainCard(request: AIExplanationRequest): AsyncGenerator<string> {
  const { cardContent, previousCards, questionType, customQuestion } = request;

  const userQuestion = questionTypePrompts[questionType] || customQuestion || '请解释这张卡片的内容';

  let contextInfo = '';
  if (previousCards.length > 0 && questionType === 'connect') {
    contextInfo = `\n\n前面学习过的卡片内容摘要：\n${previousCards.slice(-3).map((c, i) => `${i + 1}. ${c}`).join('\n')}`;
  }

  const systemPrompt = `你是一个耐心、专业的学习助手。你的任务是帮助用户理解学习卡片中的内容。
请根据用户的问题类型，给出清晰、易懂的解释。回答应该简洁但完整，避免过于冗长。`;

  const response = await callOpenAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `当前学习的卡片内容：\n${cardContent}${contextInfo}\n\n我的问题：${userQuestion}` },
  ], true);

  yield* streamOpenAIContent(response);
}

function getCharacterNames(characters: string): string[] {
  return characters
    .split(/(?:和|与|、|，|,|\n|\/)/)
    .map(name => name.trim())
    .filter(Boolean);
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function getDialogueSide(value: unknown, characterName: string, names: string[], index: number): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'right', '右', '右侧'].includes(normalized)) return true;
    if (['false', 'left', '左', '左侧'].includes(normalized)) return false;
  }
  return names[1] ? characterName === names[1] : index % 2 === 1;
}

function flattenGeneratedMessages(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 4) return [];
  if (Array.isArray(value)) {
    return value.flatMap(item => flattenGeneratedMessages(item, depth + 1));
  }
  if (!value || typeof value !== 'object') return [];

  const item = value as Record<string, unknown>;
  if (getString(item.content ?? item.text ?? item.message ?? item.dialogue)) {
    return [item];
  }
  const nestedKeys = ['characters', 'messages', 'dialogues', 'lines', 'scenes', 'items', 'rows'];
  for (const key of nestedKeys) {
    if (Array.isArray(item[key])) {
      const nested = flattenGeneratedMessages(item[key], depth + 1);
      if (nested.length > 0) return nested;
    }
  }
  return [];
}

export async function convertToDialogue(content: string, characters: string): Promise<DialogueGenerationResult[]> {
  const systemPrompt = `你是一个创意内容转换专家。你的任务是将教育内容转换成角色对话的形式，类似欧姆社学习漫画的风格。

用户会提供角色设定，你需要根据这些角色的特点来生成对话。对话应该：
1. 保持知识点的完整性和准确性
2. 让角色用符合其性格的语气和措辞来讲解
3. 通过问答互动的方式让内容更容易理解
4. 适当加入角色的口头禅或标志性表达
5. 生成足够的对话轮次来覆盖所有知识点

关于角色分配：
- 选择一个角色作为"讲解者"，负责解释知识点，消息显示在左侧
- 选择另一个角色作为"学习者"，负责提问和确认理解，消息显示在右侧
- 如果只有一个角色，让他自言自语式地讲解，偶尔自问自答

请以 JSON 数组格式返回，每个元素包含：
- character_name: 角色名称
- avatar_seed: 角色头像/配色种子（字符串，确保同一角色稳定一致）
- content: 对话内容
- is_right_side: 是否显示在右侧（学习者/提问者为 true，讲解者为 false）
- knowledge_point: 这段对话涉及的知识点简述（可选）

只返回 JSON 数组，不要其他内容。`;

  const response = await callOpenAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `角色设定：${characters}\n\n请将以下内容转换为角色对话：\n\n${content}` },
  ]);

  const data = await response.json();
  const resultText = data.choices[0]?.message?.content || '[]';

  const names = getCharacterNames(characters);
  const rawResult = flattenGeneratedMessages(parseJsonArray<unknown>(resultText));
  const result = rawResult
    .map((item, index) => {
      const characterName = getString(
        item.character_name ?? item.character ?? item.speaker ?? item.name
      ) || names[index % Math.max(1, names.length)] || `角色 ${index + 1}`;
      const messageContent = getString(item.content ?? item.text ?? item.message ?? item.dialogue);
      return {
        character_name: characterName,
        avatar_seed: getString(item.avatar_seed ?? item.avatarSeed ?? item.avatar) || characterName,
        content: messageContent,
        is_right_side: getDialogueSide(
          item.is_right_side ?? item.isRightSide ?? item.side ?? item.position,
          characterName,
          names,
          index
        ),
        knowledge_point: getString(item.knowledge_point ?? item.knowledgePoint ?? item.knowledge) || undefined,
      } satisfies DialogueGenerationResult;
    })
    .filter(item => item.content.length > 0);
  if (result.length === 0) {
    throw new AIResponseParseError('AI 没有返回有效对话内容，请重试', resultText);
  }
  return result;
}

export async function* answerDialogueQuestion(
  question: string,
  contextMessages: { character_name: string; content: string }[]
): AsyncGenerator<string> {
  const contextText = contextMessages
    .map(m => `${m.character_name}: ${m.content}`)
    .join('\n');

  const systemPrompt = `你是一个学习助手。用户正在通过对话形式学习知识，他们对某段对话有疑问。
请根据对话上下文，用简洁清晰的语言回答用户的问题。`;

  const response = await callOpenAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `对话上下文：\n${contextText}\n\n我的问题：${question}` },
  ], true);

  yield* streamOpenAIContent(response);
}

export async function* answerArticleTextQuestion(
  selectedText: string,
  question: string,
  articleContent?: string
): AsyncGenerator<string> {
  const contextSection = articleContent
    ? `\n\n完整文章内容（作为参考上下文）：\n${articleContent}`
    : '';

  const systemPrompt = `你是一个耐心、专业的学习助手。用户正在阅读一篇文章，并对其中的一段文字有疑问。
请根据选中的文字和用户的问题，给出清晰、易懂的解释。如果提供了完整文章内容，可以结合上下文来回答。
回答应该简洁但完整，避免过于冗长。`;

  const response = await callOpenAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `选中的文字：\n"${selectedText}"${contextSection}\n\n我的问题：${question}` },
  ], true);

  yield* streamOpenAIContent(response);
}

export async function convertToGalgame(content: string, characters: string): Promise<GalgameGenerationResult[]> {
  const systemPrompt = `你是一个视觉小说/Gal Game 剧本专家。你的任务是将教育内容转换成类似逆转裁判、Fate/Stay Night 风格的视觉小说对话。

用户会提供 2-3 个角色设定，你需要生成沉浸式的对话剧本。

对话风格要求：
1. 每句话要短而有力，适合打字机效果逐字显示（通常 10-50 字）
2. 保持知识点的完整性和准确性
3. 让角色用符合其性格的语气和措辞来讲解
4. 通过戏剧性的对话推进知识讲解
5. 在关键情节处加入情绪表达和屏幕特效

情绪 emoji 可选值（用于在角色旁边显示贴图表情）：
- 无表情时填 null
- 汗颜/尴尬: "sweat" (对应 emoji 💧)
- 愤怒: "angry" (对应 emoji 💢)
- 爱心/喜欢: "love" (对应 emoji 💕)
- 惊讶: "shock" (对应 emoji ❗)
- 疑惑: "question" (对应 emoji ❓)
- 开心: "happy" (对应 emoji ✨)
- 思考: "think" (对应 emoji 💭)
- 悲伤: "sad" (对应 emoji 💔)

角色位置：
- "left" - 左侧（通常是讲解者/主角）
- "right" - 右侧（通常是学习者/配角）
- "center" - 中央（独白、重要发言时）

请以 JSON 数组格式返回，每个元素包含：
- character_name: 角色名称
- avatar_seed: 角色头像/配色种子（字符串，确保同一角色稳定一致）
- content: 对话内容（简短有力）
- emotion_emoji: 情绪 emoji 标识（可选，从上述列表选择）
- knowledge_point: 这段对话涉及的知识点简述（可选）
- position: 角色位置（left/right/center）

只返回 JSON 数组，不要其他内容。`;

  const response = await callOpenAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `角色设定：${characters}\n\n请将以下内容转换为视觉小说对话：\n\n${content}` },
  ]);

  const data = await response.json();
  const resultText = data.choices[0]?.message?.content || '[]';

  const names = getCharacterNames(characters);
  const rawResult = flattenGeneratedMessages(parseJsonArray<unknown>(resultText));
  const result = rawResult
    .map((item, index) => {
      const characterName = getString(
        item.character_name ?? item.character ?? item.speaker ?? item.name
      ) || names[index % Math.max(1, names.length)] || `角色 ${index + 1}`;
      const rawPosition = getString(item.position ?? item.side).toLowerCase();
      const position = ['left', 'right', 'center'].includes(rawPosition)
        ? rawPosition as 'left' | 'right' | 'center'
        : names[1] && characterName === names[1]
          ? 'right'
          : 'left';
      const rawScreenEffect = getString(item.screen_effect ?? item.screenEffect).toLowerCase();
      const screenEffect = ['none', 'shake', 'flash', 'pulse'].includes(rawScreenEffect)
        ? rawScreenEffect as NonNullable<GalgameGenerationResult['screen_effect']>
        : undefined;
      return {
        character_name: characterName,
        avatar_seed: getString(item.avatar_seed ?? item.avatarSeed ?? item.avatar) || characterName,
        content: getString(item.content ?? item.text ?? item.message ?? item.dialogue),
        emotion_emoji: getString(item.emotion_emoji ?? item.emotionEmoji ?? item.emotion) || undefined,
        screen_effect: screenEffect,
        knowledge_point: getString(item.knowledge_point ?? item.knowledgePoint ?? item.knowledge) || undefined,
        position,
      } satisfies GalgameGenerationResult;
    })
    .filter(item => item.content.length > 0);
  if (result.length === 0) {
    throw new AIResponseParseError('AI 没有返回有效视觉小说内容，请重试', resultText);
  }
  return result;
}

export async function generateQuizQuestions(content: string): Promise<QuizGenerationResult[]> {
  const systemPrompt = `你是一个教育测验设计专家。你的任务是根据文章内容生成多道单选题，用于检验学习效果。

要求：
1. 每题只有一个正确答案
2. 题干清晰、与文章核心知识点相关
3. 选项数量固定为 4 个
4. 选项内容要有一定区分度，避免明显干扰项
5. 提供简短解析，说明为什么答案正确
6. 题目数量根据文章长度生成 6-12 题

请以 JSON 数组格式返回，每个元素包含：
- question: 题干
- options: 选项数组（长度为 4）
- correct_index: 正确选项索引（0-3）
- explanation: 简短解析

只返回 JSON 数组，不要其他内容。`;

  const response = await callOpenAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `请基于以下文章生成单选题：\n\n${content}` },
  ]);

  const data = await response.json();
  const resultText = data.choices[0]?.message?.content || '[]';

  return parseJsonArray<QuizGenerationResult>(resultText);
}

export async function generateLearningArticle(prompt: string): Promise<string> {
  const systemPrompt = `你是一个学习文章写作助手。请根据用户的问题或内容，生成一篇结构清晰、可读性强的学习文章。

要求：
1. 内容准确、通俗易懂，适合学习复盘
2. 可以使用小标题和列表来组织结构
3. 只返回文章正文文本，不要包含 JSON、代码块或额外说明`;

  const response = await callOpenAI([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `用户输入：${prompt}` },
  ]);

  const data = await response.json();
  const resultText = String(data.choices[0]?.message?.content || '').trim();
  if (!resultText) {
    throw new AIResponseParseError('AI 返回内容为空，请重试', '');
  }
  return resultText;
}
