import { transitMidnightMs, transitParts } from '../../../core/utils/timezone';
import { activeServices, getTripStopSequence, loadTimetable } from './timetable';

/**
 * RAPTOR network built once from the bundled GTFS (the same model Moovit and
 * Transit route on): trips grouped into patterns (one route, one exact stop
 * sequence), the patterns serving each stop, and walking footpaths between
 * nearby stops. Times are seconds of the service day (may exceed 86 400).
 */
export interface RaptorPattern {
  route: number;
  stops: number[];
  /** Trip indexes, sorted by departure at the first stop. */
  trips: number[];
  /** times[i][pos]: departure of trips[i] at stops[pos], service-day seconds. */
  times: number[][];
  /** True when no trip overtakes another (binary search is then exact). */
  fifo: boolean;
}

export interface RaptorNetwork {
  stopIds: string[];
  stopIndex: Map<string, number>;
  lat: number[];
  lng: number[];
  patterns: RaptorPattern[];
  stopPatterns: { p: number; pos: number }[][];
  footpaths: { to: number; sec: number }[][];
}

/** Straight-line walking, same assumptions as the planner's walk legs (4.5 km/h, ×1.3 detours). */
export const WALK_KMH = 4.5;
export const WALK_ROAD_FACTOR = 1.3;
/** Walking transfers between different stops (Moovit/Transit use ~400 m). */
export const FOOTPATH_KM = 0.4;

export function walkSec(km: number): number {
  return Math.round(((km * WALK_ROAD_FACTOR) / WALK_KMH) * 3600);
}

export function distKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number): number => (d * Math.PI) / 180;
  const s1 = Math.sin(toRad(bLat - aLat) / 2);
  const s2 = Math.sin(toRad(bLng - aLng) / 2);
  const h = s1 * s1 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * s2 * s2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

let cached: RaptorNetwork | null = null;

export function getRaptorNetwork(): RaptorNetwork {
  if (cached) return cached;
  const tt = loadTimetable();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const stations = require('../../../assets/stations.json') as { id: string; lat: number; lng: number }[];
  const stopIds: string[] = [];
  const stopIndex = new Map<string, number>();
  const lat: number[] = [];
  const lng: number[] = [];
  for (const s of stations) {
    const id = String(s.id);
    if (!tt.deps[id] || stopIndex.has(id)) continue;
    stopIndex.set(id, stopIds.length);
    stopIds.push(id);
    lat.push(s.lat);
    lng.push(s.lng);
  }

  const groups = new Map<string, RaptorPattern>();
  tt.trips.forEach((trip, tripIdx) => {
    const seq = getTripStopSequence(tripIdx).filter((e) => stopIndex.has(e.stopId));
    if (seq.length < 2) return;
    const stops = seq.map((e) => stopIndex.get(e.stopId) as number);
    const key = `${trip[0]}|${stops.join(',')}`;
    let pattern = groups.get(key);
    if (!pattern) {
      pattern = { route: trip[0] as number, stops, trips: [], times: [], fifo: true };
      groups.set(key, pattern);
    }
    pattern.trips.push(tripIdx);
    pattern.times.push(seq.map((e) => e.sec));
  });

  const patterns = [...groups.values()];
  for (const p of patterns) {
    const order = p.trips.map((_, i) => i).sort((a, b) => (p.times[a]?.[0] ?? 0) - (p.times[b]?.[0] ?? 0));
    p.trips = order.map((i) => p.trips[i] as number);
    p.times = order.map((i) => p.times[i] as number[]);
    for (let i = 1; i < p.times.length && p.fifo; i++) {
      const prev = p.times[i - 1] as number[];
      const cur = p.times[i] as number[];
      if (cur.some((sec, pos) => sec < (prev[pos] ?? 0))) p.fifo = false;
    }
  }

  const stopPatterns: { p: number; pos: number }[][] = stopIds.map(() => []);
  patterns.forEach((pattern, p) => pattern.stops.forEach((s, pos) => stopPatterns[s]?.push({ p, pos })));

  // Sweep by latitude: only stops inside the 400 m band are measured (not all n² pairs).
  const footpaths: { to: number; sec: number }[][] = stopIds.map(() => []);
  const byLat = stopIds.map((_, i) => i).sort((a, b) => (lat[a] as number) - (lat[b] as number));
  const dLat = FOOTPATH_KM / 111;
  for (let x = 0; x < byLat.length; x++) {
    const a = byLat[x] as number;
    for (let y = x + 1; y < byLat.length; y++) {
      const b = byLat[y] as number;
      if ((lat[b] as number) - (lat[a] as number) > dLat) break;
      const km = distKm(lat[a] as number, lng[a] as number, lat[b] as number, lng[b] as number);
      if (km > FOOTPATH_KM) continue;
      const sec = Math.max(60, walkSec(km));
      footpaths[a]?.push({ to: b, sec });
      footpaths[b]?.push({ to: a, sec });
    }
  }

  cached = { stopIds, stopIndex, lat, lng, patterns, stopPatterns, footpaths };
  return cached;
}

export interface ServiceDay {
  /** Added to scheduled seconds to express them relative to the query's midnight. */
  offset: number;
  active: Set<number>;
}

/** Yesterday (after-midnight trips), today and tomorrow (night queries), on Timișoara's clock. */
export function serviceDays(atMs: number): { midnightMs: number; days: ServiceDay[] } {
  const tt = loadTimetable();
  const midnightMs = transitMidnightMs(atMs);
  const days = [-1, 0, 1].map((d) => {
    const p = transitParts(midnightMs + d * 86_400_000 + 3_600_000);
    return { offset: d * 86_400, active: activeServices(tt, p.year * 10000 + p.month * 100 + p.day, p.weekdayIdx) };
  });
  return { midnightMs, days };
}

/** Service index of a trip (for calendar checks). */
export function tripService(tripIdx: number): number {
  return (loadTimetable().trips[tripIdx]?.[2] as number | undefined) ?? -1;
}
