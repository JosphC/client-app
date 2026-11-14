import { env } from '../../../core/config/env';
import { SightingSchema, type Sighting } from '../../../services/api/schemas/sighting';
import { postSighting, type PostResult } from '../../../services/repositories/real/sightingRepo';
import type { BlePoll } from '../types';
import { bleLog } from './log';

/** Peste această vechime serverul respinge oricum sighting-ul (docs/phone.md). */
export const SIGHTING_MAX_AGE_MS = 120_000;

export type SightingPost = (s: Sighting) => Promise<number | PostResult>;

/** Mock mode: nu iese nimic în rețea; sighting-urile rămân inspectabile (UI de test, teste). */
export const mockSightings: Sighting[] = [];
const SLOT_SECONDS = 30;
const MAX_SLOT_AGE_SLOTS = Math.ceil(SIGHTING_MAX_AGE_MS / 1000 / SLOT_SECONDS);

/** Serverul mock răspunde ca cel de test: 200 dacă slotul e proaspăt, 422 dacă e prea vechi / din viitor. */
export function mockSightingStatus(s: Sighting, nowMs: number = Date.now()): number {
  const currentSlot = Math.floor(nowMs / 1000 / SLOT_SECONDS);
  return currentSlot - s.slot > MAX_SLOT_AGE_SLOTS || s.slot - currentSlot > 1 ? 422 : 200;
}

const postMock: SightingPost = async (s) => {
  const status = mockSightingStatus(s);
  if (status === 200) mockSightings.push(s);
  return status;
};

/** Sighting din poll-ul BLE, sau null dacă lipsește tokenul / id-ul nu e numeric. Nu trimite niciodată fără token. */
export function toSighting(poll: BlePoll): Sighting | null {
  if (!poll.proof || poll.rssi === null || !/^\d+$/.test(poll.deviceId)) return null;
  const parsed = SightingSchema.safeParse({
    bus_id: Number(poll.deviceId),
    slot: poll.proof.slot,
    token: poll.proof.token,
    rssi: Math.round(poll.rssi),
    clock_synced: poll.proof.clockSynced,
  });
  return parsed.success ? parsed.data : null;
}

export interface SightingSender {
  submit(poll: BlePoll): void;
}

interface Options {
  post?: SightingPost;
  now?: () => number;
  onUnauthorized?: () => void;
}

/**
 * Un request per autobuz și per slot. 200 → gata; 422/400 → abandonat (fără retry);
 * 401 → cere login; eroare de rețea → reîncearcă la următorul poll cât timp e sub 2 minute.
 */
export function createSightingSender(opts: Options = {}): SightingSender {
  // Adresa dedicată (EXPO_PUBLIC_SIGHTINGS_URL) trimite real chiar cu USE_MOCKS=true; altfel mock sau API-ul real.
  const post = opts.post ?? (env.sightingsUrl || !env.useMocks ? postSighting : postMock);
  const now = opts.now ?? Date.now;
  const lastSlot = new Map<number, number>();
  const pending = new Map<number, { sighting: Sighting; atMs: number }>();

  const inflight = new Set<string>();

  async function send(sighting: Sighting, atMs: number): Promise<void> {
    const key = `${sighting.bus_id}:${sighting.slot}`;
    if (inflight.has(key)) return;
    inflight.add(key);
    try {
      const result = await post(sighting);
      const status = typeof result === 'number' ? result : result.status;
      bleLog.sighting(sighting, status, typeof result === 'number' ? undefined : result.detail);
      if (status === 401) opts.onUnauthorized?.();
      pending.delete(sighting.bus_id);
    } catch (e) {
      bleLog.sighting(sighting, 'offline', e instanceof Error ? e.message : String(e));
      pending.set(sighting.bus_id, { sighting, atMs });
    } finally {
      inflight.delete(key);
    }
  }

  return {
    submit(poll) {
      const sighting = toSighting(poll);
      const t = now();
      for (const [bus, p] of pending) {
        if (t - p.atMs > SIGHTING_MAX_AGE_MS) pending.delete(bus);
        else if (!sighting || bus !== sighting.bus_id) void send(p.sighting, p.atMs);
      }
      if (!sighting) return;
      const seen = lastSlot.get(sighting.bus_id);
      if (seen !== undefined && sighting.slot <= seen) {
        // Același slot, cu token: dacă request-ul a eșuat (offline), reîncearcă acum.
        const p = pending.get(sighting.bus_id);
        if (p && p.sighting.slot === sighting.slot) void send(p.sighting, p.atMs);
        return;
      }
      lastSlot.set(sighting.bus_id, sighting.slot);
      void send(sighting, t);
    },
  };
}
