export {
  ALLOWED_AI_MODELS,
  DEFAULT_AI_MODEL,
} from '../../supabase/functions/_shared/aiModels.ts';
import {
  DEFAULT_AI_MODEL,
  isAllowedAIModel,
} from '../../supabase/functions/_shared/aiModels.ts';

const STORAGE_KEY = 'ai_model_preference';
const LEGACY_STORAGE_KEY = 'openai_config';

export interface StringStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem?(key: string): void;
}

function getBrowserStore(): StringStore | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

function readModel(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as { model?: unknown };
    return typeof parsed.model === 'string' && parsed.model.trim()
      ? parsed.model.trim()
      : null;
  } catch {
    return null;
  }
}

export function resolveAIAvailability(
  platformFlag: string | undefined,
  localProxyConfigured: boolean
): boolean {
  return platformFlag?.trim().toLowerCase() === 'true' || localProxyConfigured;
}

export function loadAIModel(store: StringStore | undefined = getBrowserStore()): string {
  if (!store) return DEFAULT_AI_MODEL;

  const configured = readModel(store.getItem(STORAGE_KEY));
  const legacyModel = readModel(store.getItem(LEGACY_STORAGE_KEY));
  store.removeItem?.(LEGACY_STORAGE_KEY);

  if (configured && isAllowedAIModel(configured)) return configured;
  if (legacyModel && isAllowedAIModel(legacyModel)) {
    saveAIModel(legacyModel, store);
    return legacyModel;
  }

  return DEFAULT_AI_MODEL;
}

export function saveAIModel(
  model: string,
  store: StringStore | undefined = getBrowserStore()
): void {
  if (!store) return;
  const normalizedModel = model.trim();
  store.setItem(
    STORAGE_KEY,
    JSON.stringify({ model: isAllowedAIModel(normalizedModel) ? normalizedModel : DEFAULT_AI_MODEL }),
  );
}
