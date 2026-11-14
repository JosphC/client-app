import type { ZodType, ZodTypeDef } from 'zod';
import { env } from '../../core/config/env';
import { ensureAccessToken, refreshTokens } from './auth';
import { ApiError, send, toApiError, type SendOptions } from './http';

/**
 * Apel autentificat: Bearer din sesiune (anonim creat la nevoie); la 401 face UN refresh și reîncearcă o dată.
 * Doar pe serverul de test, `EXPO_PUBLIC_TEST_USER_ID` trimite `X-User-Id` în loc de token.
 */
export async function authedFetch(path: string, opts: SendOptions = {}): Promise<Response> {
  if (env.testUserId) {
    return send(path, { ...opts, headers: { ...opts.headers, 'X-User-Id': env.testUserId } });
  }
  const attempt = (token: string) => send(path, { ...opts, headers: { ...opts.headers, Authorization: `Bearer ${token}` } });
  const res = await attempt(await ensureAccessToken());
  if (res.status !== 401) return res;
  return attempt((await refreshTokens()).accessToken);
}

export interface RequestOptions extends SendOptions {
  /** Obligatoriu pe `confirm` și `renew`: aceeași cheie la reîncercare, ca să nu se plătească de două ori. */
  idempotencyKey?: string;
}

/** JSON validat cu zod; orice non-2xx devine `ApiError`. `schema` lipsă = răspuns fără corp (204). */
export async function request<T = void>(path: string, opts: RequestOptions = {}, schema?: ZodType<T, ZodTypeDef, unknown>): Promise<T> {
  const headers = { ...opts.headers, ...(opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}) };
  const res = await authedFetch(path, { ...opts, headers });
  if (!res.ok) throw await toApiError(res);
  if (!schema) return undefined as T;
  const parsed = schema.safeParse(await res.json());
  if (!parsed.success) throw new ApiError(res.status, 'SERVER_ERROR', `Unexpected response for ${path}`);
  return parsed.data;
}

/** Cheie de idempotență (uuid v4) pentru o singură încercare de plată. */
export function newIdempotencyKey(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
