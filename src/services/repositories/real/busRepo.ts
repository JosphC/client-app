import type { Bus, BusPosition } from '../../api/schemas/bus';
import { createBusMock } from '../mock/busMock';
import type { BusRepo } from '../types';
import { loadServerFleet } from './serverBuses';
import { fetchStptVehicles } from './stpt/client';
import { mapVehicles } from './stpt/mapper';

/** STPT publishes fresh positions ~every 20s: a snapshot younger than this is reused as is. */
export const STPT_TTL_MS = 25_000;

interface Snapshot {
  buses: Bus[];
  positions: BusPosition[];
}

/**
 * Live STPT positions with mock fallback: any network/schema error returns mocks (or the last good snapshot).
 * STPT is cached for STPT_TTL_MS and refreshed in the background once stale, so the fast poll of the
 * EchoPass server's test buses (e.g. 101 / E2) never waits on STPT nor hammers it.
 * Server buses go first so the marker budget never drops them.
 */
export function createStptBusRepo(): BusRepo {
  const fallback = createBusMock();
  let snap: { at: number; data: Snapshot } | null = null;
  let inFlight: Promise<Snapshot> | null = null;

  function refresh(): Promise<Snapshot> {
    if (!inFlight) {
      inFlight = fetchStptVehicles()
        .then((vehicles) => {
          const data = mapVehicles(vehicles);
          snap = { at: Date.now(), data };
          return data;
        })
        .catch(async () => {
          if (snap) return snap.data;
          return { buses: await fallback.getBuses(), positions: await fallback.getPositions() };
        })
        .finally(() => {
          inFlight = null;
        });
    }
    return inFlight;
  }

  function stpt(): Promise<Snapshot> {
    if (!snap) return refresh();
    if (Date.now() - snap.at >= STPT_TTL_MS) void refresh();
    return Promise.resolve(snap.data);
  }

  return {
    getBuses: async () => {
      const [server, live] = await Promise.all([loadServerFleet(), stpt()]);
      return [...server.buses, ...live.buses];
    },
    getPositions: async () => {
      const [server, live] = await Promise.all([loadServerFleet(), stpt()]);
      return [...server.positions, ...live.positions];
    },
  };
}
