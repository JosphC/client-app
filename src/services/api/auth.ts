import AsyncStorage from '@react-native-async-storage/async-storage';
import { z } from 'zod';
import { ApiError, send, toApiError } from './http';
import { clearSession, readSession, writeSession, type Session, type UserTier } from './session';

const tokensSchema = z.object({
  userId: z.string().min(1),
  tier: z.enum(['anonymous', 'account']).optional(),
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresIn: z.number().int().positive().optional(),
});

export type IdProvider = 'google' | 'apple';

/** Cu atât înainte de expirare considerăm tokenul deja expirat (ceasul telefonului nu e perfect). */
const SKEW_MS = 30_000;
const DEFAULT_TTL_S = 900;
const DEVICE_KEY = 'echopass-device-id';

let deviceId: string | null = null;
let starting: Promise<Session> | null = null;
let refreshing: Promise<Session> | null = null;

/** Id stabil al telefonului (nu e secret și nu loghează pe nimeni; serverul îl folosește doar ca etichetă). */
export async function getDeviceId(): Promise<string> {
  if (deviceId) return deviceId;
  try {
    deviceId = await AsyncStorage.getItem(DEVICE_KEY);
  } catch {
    deviceId = null;
  }
  if (!deviceId) {
    deviceId = `ep-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    try {
      await AsyncStorage.setItem(DEVICE_KEY, deviceId);
    } catch {
      // rămâne doar în memorie până la următoarea pornire
    }
  }
  return deviceId;
}

async function parseTokens(res: Response, fallbackTier: UserTier): Promise<Session> {
  if (!res.ok) throw await toApiError(res);
  const data = tokensSchema.parse(await res.json());
  return {
    userId: data.userId,
    tier: data.tier ?? fallbackTier,
    accessToken: data.accessToken,
    refreshToken: data.refreshToken,
    accessExpiresAtMs: Date.now() + (data.expiresIn ?? DEFAULT_TTL_S) * 1000,
  };
}

/** Primul apel al unei instalări noi: creează un utilizator anonim. Un singur zbor, ca să nu apară utilizatori dubli. */
export function startAnonymous(): Promise<Session> {
  starting ??= (async () => {
    const res = await send('/auth/anonymous', { method: 'POST', body: { deviceId: await getDeviceId() } });
    const session = await parseTokens(res, 'anonymous');
    await writeSession(session);
    return session;
  })().finally(() => {
    starting = null;
  });
  return starting;
}

/**
 * Refresh-ul are voie o dată pe token: un singur zbor, iar noul refresh token se scrie pe disc ÎNAINTE
 * să fie folosit (altfel o reutilizare blochează toate login-urile telefonului, vezi api-app.md 1.2).
 */
export function refreshTokens(): Promise<Session> {
  refreshing ??= (async () => {
    const current = await readSession();
    if (!current) return startAnonymous();
    try {
      const res = await send('/auth/refresh', { method: 'POST', body: { refreshToken: current.refreshToken } });
      const next: Session = { ...(await parseTokens(res, current.tier)), tier: current.tier };
      await writeSession(next);
      return next;
    } catch (e) {
      if (!(e instanceof ApiError) || e.code !== 'AUTH_INVALID') throw e;
      await clearSession();
      // Anonimul nu mai poate reintra oricum; un cont trebuie să se autentifice din nou (propagăm 401).
      if (current.tier === 'anonymous') return startAnonymous();
      throw e;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

/** Access token valid: îl creează (anonim) sau îl reînnoiește când e nevoie. */
export async function ensureAccessToken(): Promise<string> {
  const session = await readSession();
  if (!session) return (await startAnonymous()).accessToken;
  if (session.accessExpiresAtMs - SKEW_MS > Date.now()) return session.accessToken;
  return (await refreshTokens()).accessToken;
}

async function authedPost(path: string, body?: unknown): Promise<Response> {
  const headers: Record<string, string> = {};
  if (await readSession()) headers.Authorization = `Bearer ${await ensureAccessToken()}`;
  return send(path, { method: 'POST', body, headers });
}

/** Anonimul devine cont și își păstrează datele (409 IDENTITY_IN_USE → folosește `signInAccount`). */
export async function linkAccount(provider: IdProvider, idToken: string): Promise<Session> {
  const session: Session = { ...(await parseTokens(await authedPost('/auth/link', { provider, idToken }), 'account')), tier: 'account' };
  await writeSession(session);
  return session;
}

/** Intră într-un cont existent (sau creează unul gol). Anonimul de pe telefon se șterge doar dacă trimitem tokenul lui. */
export async function signInAccount(provider: IdProvider, idToken: string): Promise<Session> {
  const body = { provider, idToken, deviceId: await getDeviceId() };
  const session = await parseTokens(await authedPost('/auth/signin', body), 'account');
  await writeSession(session);
  return session;
}

/** Ieșire. Un anonim e șters cu tot ce are pe server: UI-ul trebuie să avertizeze înainte. */
export async function logout(): Promise<void> {
  try {
    if (await readSession()) {
      const res = await authedPost('/auth/logout');
      if (!res.ok && res.status !== 401) throw await toApiError(res);
    }
  } finally {
    // Token-urile locale se șterg orice ar răspunde serverul (eroare, rețea căzută):
    // altfel UI-ul arată „ieșit" dar sesiunea rămâne validă pe telefon.
    await clearSession();
  }
}
