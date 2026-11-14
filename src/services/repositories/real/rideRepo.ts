import { authedFetch, newIdempotencyKey, request } from '../../api/authedRequest';
import { toApiError } from '../../api/http';
import { rideSchema, type ConfirmInput, type Ride } from '../../api/schemas/ride';

let lastEtag: string | null = null;
let lastRide: Ride | null = null;

/** Cursa curentă; la `304` întoarce ultimul răspuns cunoscut (ETag / If-None-Match). */
export async function getCurrentRide(): Promise<Ride> {
  const headers: Record<string, string> = lastEtag && lastRide ? { 'If-None-Match': lastEtag } : {};
  const res = await authedFetch('/rides/current', { headers });
  if (res.status === 304 && lastRide) return lastRide;
  if (!res.ok) throw await toApiError(res);
  lastRide = rideSchema.parse(await res.json());
  lastEtag = res.headers.get('ETag');
  return lastRide;
}

/** Test-only / la logout: uită ETag-ul, ca următorul utilizator să nu primească cursa altuia. */
export function resetRideCache(): void {
  lastEtag = null;
  lastRide = null;
}

const keys = new Map<string, string>();

/**
 * O singură încercare de plată = o singură cheie: aceeași cheie pentru același corp, deci o repetare după
 * o eroare de rețea nu plătește de două ori (api-app.md §0). Corp nou (altă sursă / alți pasageri) = cheie nouă.
 */
export function confirmRide(sessionId: string, input: ConfirmInput): Promise<Ride> {
  const sig = `${sessionId}|${input.passengers}|${input.sourceId ?? ''}|${input.busId ?? ''}`;
  let key = keys.get(sig);
  if (!key) {
    key = newIdempotencyKey();
    keys.set(sig, key);
  }
  return request(`/rides/${sessionId}/confirm`, { method: 'POST', body: input, idempotencyKey: key }, rideSchema);
}

export function declineRide(sessionId: string): Promise<Ride> {
  return request(`/rides/${sessionId}/decline`, { method: 'POST' }, rideSchema);
}

/** Butonul „Sunt în autobuz": `422` dacă nu a auzit niciun autobuz în ultimele 2 minute. */
export function startManualRide(): Promise<Ride> {
  return request('/rides/manual', { method: 'POST' }, rideSchema);
}
