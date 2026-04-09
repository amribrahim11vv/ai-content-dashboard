export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

export function safeClientError(err: unknown, fallback = "Generation failed. Please retry."): string {
  if (err instanceof HttpError) return err.message;
  return fallback;
}
