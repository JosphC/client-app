import { env } from '../../../core/config/env';
import { authedFetch } from '../../api/authedRequest';
import { SightingSchema, type Sighting } from '../../api/schemas/sighting';

/** Răspunsul serverului: codul HTTP și, la refuz, începutul corpului (motivul), pentru jurnalul de test. */
export interface PostResult {
  status: number;
  detail?: string;
}

export interface SightingTarget {
  baseUrl: string;
  userId: string | null;
  authToken: string | null;
}

const POST_TIMEOUT_MS = 8000;

/** Unde se trimit sighting-urile: adresa dedicată (EXPO_PUBLIC_SIGHTINGS_URL) sau API-ul obișnuit. */
export function sightingTarget(): SightingTarget {
  return {
    baseUrl: env.sightingsUrl ?? env.apiBaseUrl,
    // Serverul de test ia utilizatorul din X-User-Id; fără el răspunde 401.
    userId: env.testUserId ?? (env.sightingsUrl ? 'echopass-phone' : null),
    authToken: env.authToken,
  };
}

/** POST {baseUrl}/api/v1/sightings → codul HTTP (200/400/401/422). Eroarea de rețea / timeout-ul se propagă. */
export async function postSighting(sighting: Sighting, target: SightingTarget = sightingTarget()): Promise<PostResult> {
  const body = SightingSchema.parse(sighting);
  // Fără identitate explicită (X-User-Id / token fix): login-ul real al aplicației, Bearer + refresh la 401.
  if (!target.userId && !target.authToken) return postWithSession(body);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (target.authToken) headers.Authorization = target.authToken;
  if (target.userId) headers['X-User-Id'] = target.userId;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), POST_TIMEOUT_MS);
  try {
    const res = await fetch(`${target.baseUrl}/api/v1/sightings`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    return toResult(res);
  } finally {
    clearTimeout(timer);
  }
}

async function toResult(res: Response): Promise<PostResult> {
  const detail = res.status === 200 ? undefined : (await res.text().catch(() => '')).slice(0, 160);
  return { status: res.status, detail };
}

/** 422 are corp propriu (`{ ok:false, reason }`), nu forma standard de eroare: îl întoarcem ca rezultat, nu ca excepție. */
async function postWithSession(body: Sighting): Promise<PostResult> {
  return toResult(await authedFetch('/sightings', { method: 'POST', body, timeoutMs: POST_TIMEOUT_MS }));
}
