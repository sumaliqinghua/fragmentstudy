export type FalAspectRatio = '21:9' | '16:9' | '3:2' | '4:3' | '5:4' | '1:1' | '4:5' | '3:4' | '2:3' | '9:16';
export type FalOutputFormat = 'jpeg' | 'png' | 'webp';
export type FalResolution = '1K' | '2K' | '4K';

export interface FalImage {
  url: string;
  content_type?: string;
  file_name?: string;
  file_size?: number;
  width?: number;
  height?: number;
  file_data?: string;
}

export interface FalImageResult {
  images: FalImage[];
  description?: string;
}

export interface FalRequestOptions {
  apiKey?: string;
  modelId?: string;
  endpoint?: string;
  signal?: AbortSignal;
}

export interface FalTextToImageOptions extends FalRequestOptions {
  numImages?: number;
  aspectRatio?: FalAspectRatio;
  outputFormat?: FalOutputFormat;
  resolution?: FalResolution;
  syncMode?: boolean;
  enableWebSearch?: boolean;
  limitGenerations?: boolean;
  seed?: number;
  extraInput?: Record<string, unknown>;
}

export interface FalImageToImageOptions extends FalTextToImageOptions {
  image?: string | Blob;
  imageUrl?: string;
  imageDataUrl?: string;
  imageField?: string;
}

const DEFAULT_MODEL_ID = 'fal-ai/nano-banana-pro';
const DEFAULT_ENDPOINT = 'https://fal.run';

function resolveApiKey(explicitKey?: string): string {
  const env = import.meta.env as Record<string, string | undefined>;
  const apiKey = explicitKey || env.VITE_FAL_KEY || env.FAL_KEY;
  if (!apiKey) {
    throw new Error('FAL_KEY is missing from environment variables');
  }
  return apiKey;
}

function compactObject<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as Partial<T>;
}

async function requestFal<TResponse>(input: Record<string, unknown>, options: FalRequestOptions = {}): Promise<TResponse> {
  const apiKey = resolveApiKey(options.apiKey);
  const modelId = options.modelId || DEFAULT_MODEL_ID;
  const endpoint = options.endpoint || DEFAULT_ENDPOINT;
  const url = `${endpoint}/${modelId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Key ${apiKey}`,
    },
    body: JSON.stringify(input),
    signal: options.signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`FAL request failed: ${response.status} ${errorText}`);
  }

  return response.json() as Promise<TResponse>;
}

function buildTextToImageInput(prompt: string, options: FalTextToImageOptions = {}): Record<string, unknown> {
  return compactObject({
    prompt,
    num_images: options.numImages,
    aspect_ratio: options.aspectRatio,
    output_format: options.outputFormat,
    resolution: options.resolution,
    sync_mode: options.syncMode,
    enable_web_search: options.enableWebSearch,
    limit_generations: options.limitGenerations,
    seed: options.seed,
    ...options.extraInput,
  });
}

async function resolveImageSource(options: FalImageToImageOptions): Promise<string> {
  if (options.imageDataUrl) {
    return options.imageDataUrl;
  }

  if (options.imageUrl) {
    return options.imageUrl;
  }

  if (typeof options.image === 'string') {
    return options.image;
  }

  if (options.image instanceof Blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('Failed to read image file'));
      reader.readAsDataURL(options.image as Blob);
    });
  }

  throw new Error('Image source is required for image-to-image generation');
}

export async function generateTextToImage(prompt: string, options: FalTextToImageOptions = {}): Promise<FalImageResult> {
  const input = buildTextToImageInput(prompt, options);
  return requestFal<FalImageResult>(input, options);
}

export async function generateImageToImage(
  prompt: string,
  options: FalImageToImageOptions
): Promise<FalImageResult> {
  const imageField = options.imageField || 'image_url';
  const imageValue = await resolveImageSource(options);

  const input = buildTextToImageInput(prompt, options);
  input[imageField] = imageValue;

  return requestFal<FalImageResult>(input, options);
}

export async function requestFalModel<TResponse>(
  input: Record<string, unknown>,
  options: FalRequestOptions = {}
): Promise<TResponse> {
  return requestFal<TResponse>(input, options);
}
