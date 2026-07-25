export class FunctionAuthError extends Error {
  readonly status: number;

  constructor(message: string, status = 401) {
    super(message);
    this.name = 'FunctionAuthError';
    this.status = status;
  }
}

export function extractUserBearerToken(header: string | null): string {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  if (!match) throw new FunctionAuthError('请先登录后导入网页');
  return match[1];
}
