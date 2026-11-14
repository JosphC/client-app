import { z } from 'zod';
import { env } from '../../core/config/env';
import { linkAccount, logout, signInAccount } from '../../services/api/auth';
import { request } from '../../services/api/authedRequest';
import { ApiError } from '../../services/api/http';
import { readSession } from '../../services/api/session';
import { resetRideCache } from '../../services/repositories/real/rideRepo';
import type { AuthUser } from './authService';

const meSchema = z.object({
  id: z.string().min(1),
  tier: z.enum(['anonymous', 'account']),
  name: z.string().optional(),
  email: z.string().optional(),
});

/** Sunt conectat la serverul real (nu la mock-ul local)? */
export const usesServerAuth = (): boolean => !env.useMocks;

export class IdTokenUnavailableError extends Error {
  constructor() {
    super('No Google/Apple idToken source configured');
    this.name = 'IdTokenUnavailableError';
  }
}

/** Google SDK nu e integrat încă: până atunci doar `EXPO_PUBLIC_TEST_ID_TOKEN` (ex. `test:alice`) pe serverul de test. */
async function googleIdToken(): Promise<string> {
  if (env.testIdToken) return env.testIdToken;
  throw new IdTokenUnavailableError();
}

/**
 * Anonimul devine cont și își păstrează datele (`/auth/link`); dacă identitatea aparține deja unui cont,
 * intră în acel cont (`/auth/signin`, datele anonimului se pierd, vezi api-app.md 1.4).
 */
export async function signInWithGoogleOnServer(): Promise<AuthUser> {
  const idToken = await googleIdToken();
  try {
    await linkAccount('google', idToken);
  } catch (e) {
    if (!(e instanceof ApiError) || e.code !== 'IDENTITY_IN_USE') throw e;
    await signInAccount('google', idToken);
  }
  resetRideCache();
  const me = await request('/me', {}, meSchema);
  return { id: me.id, name: me.name ?? '', email: me.email ?? '' };
}

/** Doar un cont se deconectează pe server; un anonim ar fi șters cu tot ce are (api-app.md 1.5). */
export async function signOutOnServer(): Promise<void> {
  resetRideCache();
  if ((await readSession())?.tier === 'account') await logout();
}
