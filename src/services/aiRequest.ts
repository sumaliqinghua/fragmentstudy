export interface AIMessage {
  role: string;
  content: string;
}

export interface PlatformAIRequestInput {
  accessToken: string;
  model: string;
  messages: AIMessage[];
  stream: boolean;
  temperature: number;
  responseFormat?: Record<string, unknown>;
}

export interface PlatformAIRequestBody {
  model: string;
  messages: AIMessage[];
  stream: boolean;
  temperature: number;
  response_format?: Record<string, unknown>;
}

export function buildPlatformAIRequest(input: PlatformAIRequestInput): {
  headers: { 'Content-Type': string; Authorization: string };
  body: PlatformAIRequestBody;
} {
  return {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${input.accessToken}`,
    },
    body: {
      model: input.model,
      messages: input.messages,
      stream: input.stream,
      temperature: input.temperature,
      ...(input.responseFormat ? { response_format: input.responseFormat } : {}),
    },
  };
}
