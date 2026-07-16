export const DEFAULT_AI_MODEL = 'qwen/qwen3.7-plus';

export const ALLOWED_AI_MODELS = [
  'openai/gpt-5.6-sol',
  'openai/gpt-5.6-luna',
  'bytedance/doubao-seed-2-1-pro',
  'bytedance/doubao-seed-2-1-turbo',
  'qwen/qwen3.7-plus',
  'qwen/qwen3.7-max',
  'z-ai/glm-5.2',
  'minimax/minimax-m3',
  'deepseek/deepseek-v4-pro',
  'deepseek/deepseek-v4-flash',
  'moonshotai/kimi-k2.7-code',
] as const;

export function isAllowedAIModel(model: string): boolean {
  return ALLOWED_AI_MODELS.some(allowed => allowed === model);
}
