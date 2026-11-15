import { z } from 'zod';
import { env } from '../../../core/config/env';
import { nearestStation } from '../../../features/map/arrivals';
import { send } from '../../api/http';
import type { Bus, BusPosition } from '../../api/schemas/bus';

/**
 * Autobuzele de test ale serverului EchoPass (ex. 101 pe linia E2): poziția GPS a beaconului și
 * numărul de persoane numărate de cameră. Endpoint-urile sunt cele de display (`DISPLAY_TOKEN`),
 * deci merg doar când `EXPO_PUBLIC_DISPLAY_TOKEN` e setat — DOAR pentru test/demo.
 */

const positionSchema = z.object({
  bus_id: z.number().int(),
  lat: z.number().min(-90).max(90).nullable(),
  lon: z.number().min(-180).max(180).nullable(),
  speed_kmh: z.number().min(0).nullable().optional(),
  received_at: z.string().min(1),
});

const headcountSchema = z.object({
  bus_id: z.number().int(),
  people_counted: z.number().int().min(0).nullable(),
});

export interface ServerBusConfig {
  busId: number;
  line: string;
}

/** `"101:E2,102:E7"` → [{ busId: 101, line: 'E2' }, …]; intrările greșite sunt ignorate. */
export function parseServerBuses(raw: string | null): ServerBusConfig[] {
  if (!raw) return [];
  return raw.split(',').flatMap((part) => {
    const [id, line] = part.split(':').map((s) => s.trim());
    const busId = Number(id);
    return Number.isInteger(busId) && busId > 0 && line ? [{ busId, line }] : [];
  });
}

export function serverBusId(busId: number): string {
  return `server-${busId}`;
}

async function getJson(path: string): Promise<unknown> {
  const res = await send(path, { headers: { Authorization: `Bearer ${env.displayToken ?? ''}` }, timeoutMs: 8_000 });
  if (!res.ok) throw new Error(`server ${res.status} on ${path}`);
  return (await res.json()) as unknown;
}

async function fetchOne(cfg: ServerBusConfig): Promise<{ bus: Bus; position: BusPosition } | null> {
  const [posRes, countRes] = await Promise.allSettled([
    getJson(`/buses/${cfg.busId}/position`).then((j) => positionSchema.parse(j)),
    getJson(`/buses/${cfg.busId}/headcount`).then((j) => headcountSchema.parse(j)),
  ]);
  if (posRes.status !== 'fulfilled') return null;
  const { lat, lon, speed_kmh: speed, received_at: receivedAt } = posRes.value;
  if (lat === null || lon === null) return null;
  const id = serverBusId(cfg.busId);
  const headcount = countRes.status === 'fulfilled' ? countRes.value.people_counted : null;
  const updated = new Date(receivedAt);
  return {
    bus: { id, line: cfg.line, destination: `#${cfg.busId}`, crowd: 1, delayMin: 0, delayReason: null, headcount },
    position: {
      busId: id,
      lat,
      lng: lon,
      nextStop: nearestStation({ lat, lng: lon }).name,
      arrivesInMin: 0,
      updatedAt: Number.isNaN(updated.getTime()) ? new Date().toISOString() : updated.toISOString(),
      ...(speed === null || speed === undefined ? {} : { speedKmh: speed }),
    },
  };
}

export interface ServerFleet {
  buses: Bus[];
  positions: BusPosition[];
}

let inFlight: Promise<ServerFleet> | null = null;

/** Un singur fetch comun pentru buses + positions; fără token sau la orice eroare → listă goală. */
export function loadServerFleet(): Promise<ServerFleet> {
  const configs = parseServerBuses(env.serverBuses);
  if (!env.displayToken || configs.length === 0) return Promise.resolve({ buses: [], positions: [] });
  if (!inFlight) {
    inFlight = Promise.all(configs.map((c) => fetchOne(c).catch(() => null)))
      .then((items) => {
        const ok = items.filter((x): x is { bus: Bus; position: BusPosition } => x !== null);
        return { buses: ok.map((x) => x.bus), positions: ok.map((x) => x.position) };
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}
