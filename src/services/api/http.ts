import { env } from '../../core/config/env';

export type ApiErrorCode =
  | 'AUTH_INVALID'
  | 'ACCOUNT_REQUIRED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'PAYMENT_DECLINED'
  | 'NO_PAYMENT_METHOD'
  | 'SESSION_EXPIRED'
  | 'IDEMPOTENCY_CONFLICT'
  | 'IDENTITY_IN_USE'
  | 'RATE_LIMITED'
  | 'SERVER_ERROR'
  | 'NETWORK';

/** Eroare în forma unică a serverului (`{ error: { code, message, reason? } }`); aplicația decide după `code`. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode | string,
    message: string,
    readonly reason?: string,
    readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface SendOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

export function apiUrl(path: string): string {
  return `${env.apiBaseUrl.replace(/\/+$/, '')}/api/v1${path}`;
}

/** Un singur fetch, fără autentificare. Erorile de rețea / timeout se întorc ca `ApiError('NETWORK')`. */
export async function send(path: string, opts: SendOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json', ...opts.headers };
  if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    return await fetch(apiUrl(path), {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      signal: ctrl.signal,
    });
  } catch (e) {
    throw new ApiError(0, 'NETWORK', e instanceof Error ? e.message : 'network error');
  } finally {
    clearTimeout(timer);
  }
}

/** Transformă un răspuns non-2xx în `ApiError` (corpul poate lipsi sau să nu fie JSON). */
export async function toApiError(res: Response): Promise<ApiError> {
  let code: string = res.status === 429 ? 'RATE_LIMITED' : 'SERVER_ERROR';
  let message = `HTTP ${res.status}`;
  let reason: string | undefined;
  try {
    const json = (await res.json()) as { error?: { code?: string; message?: string; reason?: string } };
    if (json.error) {
      code = json.error.code ?? code;
      message = json.error.message ?? message;
      reason = json.error.reason;
    }
  } catch {
    // corp gol sau non-JSON: rămân valorile implicite
  }
  const retry = Number(res.headers?.get?.('Retry-After'));
  return new ApiError(res.status, code, message, reason, Number.isFinite(retry) && retry > 0 ? retry : undefined);
}
