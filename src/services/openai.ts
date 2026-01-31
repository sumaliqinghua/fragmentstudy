import type { CardSplitResult, AIExplanationRequest, DialogueGenerationResult, GalgameGenerationResult, QuizGenerationResult } from '../types';

const STORAGE_KEY = 'openai_config';

interface OpenAIConfig {
  apiKey: string;
  apiEndpoint: string;
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
  if (import.meta.env.DEV) {
    return '/openai-proxy';
  }
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/openai-proxy`;
}

export function getOpenAIConfig(): OpenAIConfig {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    return JSON.parse(stored);
  }
  return {
    apiKey: '',
    apiEndpoint: 'https://api.qnaigc.com/v1',
    model: 'minimax/minimax-m2.1',
  };
}

export function saveOpenAIConfig(config: OpenAIConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function isConfigured(): boolean {
  const config = getOpenAIConfig();
  return !!config.apiKey && !!config.apiEndpoint;
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
  responseFormat?: OpenAIResponseFormat
): Promise<Response> {
  const config = getOpenAIConfig();

  if (!config.apiKey) {
    throw new Error('请先配置 API Key');
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
  const finalResponseFormat = responseFormat ?? defaultArrayFormat;

  const response = await fetch(getProxyUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      apiKey: config.apiKey,
      apiEndpoint: config.apiEndpoint,
      model: config.model,
      messages,
      stream,
      ...(finalResponseFormat ? { response_format: finalResponseFormat } : {}),
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error?.message || `API 请求失败: ${response.status}`);
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
  } catch (error) {
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
  ]);

  const data = await response.json();
  const resultText = data.choices[0]?.message?.content || '[]';

  return parseJsonArray<CardSplitResult>(resultText);
}

const questionTypePrompts: Record<string, string> = {
  story: '请用一个生动的故事或类比来解释这个知识点，帮助我更好地理解和记忆。',
  beginner: '请用最简单、最通俗的语言解释这个内容，假设我是完全没有相关背景知识的初学者。',
  connect: '请结合我之前学习的内容，解释当前这张卡片的知识点，说明它们之间的关联和承接关系。',
};

export async function* explainCard(request: AIExplanationRequest): AsyncGenerator<string> {
  const { cardContent, previousCards, questionType, customQuestion } = request;

  let userQuestion = questionTypePrompts[questionType] || customQuestion || '请解释这张卡片的内容';

  let contextInfo = '';
  if (previousCards.length > 0 && questionType === 'connect') {
    contextInfo = `\n\n前面学习过的卡片内容摘要：\n${previousCards.slice(-3).map((c, i) => `${i + 1}. ${c}`).join('\n')}`;
  }

  const systemPrompt = `你是一个耐心、专业的学习助手。你的任务是帮助用户理解学习卡片中的内容。
请根据用户的问题类型，给出清晰、易懂的解释。回答应该简洁但完整，避免过于冗长。`;

  const config = getOpenAIConfig();

  const response = await fetch(getProxyUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      apiKey: config.apiKey,
      apiEndpoint: config.apiEndpoint,
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `当前学习的卡片内容：\n${cardContent}${contextInfo}\n\n我的问题：${userQuestion}` },
      ],
      stream: true,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`API 请求失败: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法读取响应');

  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.trim().startsWith('data:'));

    for (const line of lines) {
      const data = line.replace('data:', '').trim();
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      } catch {
        continue;
      }
    }
  }
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

  const result = parseJsonArray<DialogueGenerationResult>(resultText);
  const missingSeed = result.find((item) => !item.avatar_seed || item.avatar_seed.trim().length === 0);
  if (missingSeed) {
    throw new AIResponseParseError('AI 返回缺少 avatar_seed，请重试', resultText);
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

  const config = getOpenAIConfig();

  const response = await fetch(getProxyUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      apiKey: config.apiKey,
      apiEndpoint: config.apiEndpoint,
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `对话上下文：\n${contextText}\n\n我的问题：${question}` },
      ],
      stream: true,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`API 请求失败: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法读取响应');

  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.trim().startsWith('data:'));

    for (const line of lines) {
      const data = line.replace('data:', '').trim();
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      } catch {
        continue;
      }
    }
  }
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

  const config = getOpenAIConfig();

  const response = await fetch(getProxyUrl(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      apiKey: config.apiKey,
      apiEndpoint: config.apiEndpoint,
      model: config.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `选中的文字：\n"${selectedText}"${contextSection}\n\n我的问题：${question}` },
      ],
      stream: true,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    throw new Error(`API 请求失败: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('无法读取响应');

  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.trim().startsWith('data:'));

    for (const line of lines) {
      const data = line.replace('data:', '').trim();
      if (data === '[DONE]') continue;

      try {
        const parsed = JSON.parse(data);
        const content = parsed.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      } catch {
        continue;
      }
    }
  }
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

  const result = parseJsonArray<GalgameGenerationResult>(resultText);
  const missingSeed = result.find((item) => !item.avatar_seed || item.avatar_seed.trim().length === 0);
  if (missingSeed) {
    throw new AIResponseParseError('AI 返回缺少 avatar_seed，请重试', resultText);
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
