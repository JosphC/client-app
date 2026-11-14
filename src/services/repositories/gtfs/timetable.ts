import { transitMidnightMs, transitParts } from '../../../core/utils/timezone';
export interface TimetableRoute {
  id: string;
  shortName: string;
  longName: string;
  color: string | null;
  textColor: string | null;
  mode: 'bus' | 'tram' | 'trolley';
}

export interface Timetable {
  headsigns: string[];
  services: [number[], number, number][];
  exceptions: Record<string, { add: number[]; remove: number[] }>;
  trips: [number, number, number][];
  deps: Record<string, number[]>;
}

export interface ScheduledDeparture {
  timeMs: number;
  route: TimetableRoute;
  headsign: string;
  tripKey: string;
}

let cached: Timetable | null = null;
let routesCache: TimetableRoute[] | null = null;

export function loadTimetable(): Timetable {
  if (!cached) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    cached = require('../../../assets/timetable.json') as Timetable;
  }
  return cached;
}

function loadRoutes(): TimetableRoute[] {
  if (!routesCache) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    routesCache = require('../../../assets/routes.json') as TimetableRoute[];
  }
  return routesCache;
}

export function getRouteCatalog(): TimetableRoute[] {
  return loadRoutes();
}

export function findRoute(shortName: string): TimetableRoute | null {
  return loadRoutes().find((r) => r.shortName === shortName) ?? null;
}

/** Service day of an instant on Timișoara's clock, whatever the phone's time zone. */
function dayParts(atMs: number): { dateInt: number; weekdayIdx: number; midnightMs: number } {
  const p = transitParts(atMs);
  return { dateInt: p.year * 10000 + p.month * 100 + p.day, weekdayIdx: p.weekdayIdx, midnightMs: transitMidnightMs(atMs) };
}

export function activeServices(tt: Timetable, dateInt: number, weekdayIdx: number): Set<number> {
  const active = new Set<number>();
  tt.services.forEach(([mask, start, end], i) => {
    if (dateInt >= start && dateInt <= end && mask[weekdayIdx] === 1) active.add(i);
  });
  const ex = tt.exceptions[String(dateInt)];
  if (ex) {
    for (const i of ex.remove) active.delete(i);
    for (const i of ex.add) active.add(i);
  }
  return active;
}

function decodeDeps(flat: number[]): [number, number][] {
  const out: [number, number][] = [];
  if (flat.length < 2) return out;
  let sec = flat[0] as number;
  out.push([sec, flat[1] as number]);
  for (let i = 2; i + 1 < flat.length; i += 2) {
    sec += flat[i] as number;
    out.push([sec, flat[i + 1] as number]);
  }
  return out;
}

/**
 * Static GTFS departures for a stop inside [fromMs, fromMs + window].
 * Evaluates the service calendar (weekday masks, ranges, exceptions),
 * including times past midnight. Sorted by departure time.
 */
export function getScheduledDepartures(
  stopId: string,
  fromMs: number,
  windowMin: number,
  limit: number,
): ScheduledDeparture[] {
  const tt = loadTimetable();
  const flat = tt.deps[stopId];
  if (!flat || flat.length === 0) return [];
  const routes = loadRoutes();
  const endMs = fromMs + Math.max(1, windowMin) * 60_000;
  const out: ScheduledDeparture[] = [];
  const days = Math.min(3, 1 + Math.ceil((endMs - dayParts(fromMs).midnightMs) / 86_400_000));

  for (let day = 0; day < days; day++) {
    const base = dayParts(fromMs).midnightMs + day * 86_400_000;
    const { dateInt, weekdayIdx } = dayParts(base + 60_000);
    const active = activeServices(tt, dateInt, weekdayIdx);
    if (active.size === 0) continue;
    for (const [sec, tripIdx] of decodeDeps(flat)) {
      const trip = tt.trips[tripIdx];
      if (!trip || !active.has(trip[2] as number)) continue;
      const timeMs = base + (sec as number) * 1000;
      if (timeMs < fromMs || timeMs > endMs) continue;
      const route = routes[trip[0] as number];
      if (!route) continue;
      const headsign = tt.headsigns[trip[1] as number] || route.longName || route.shortName;
      out.push({
        timeMs,
        route,
        headsign,
        tripKey: `${tripIdx}-${stopId}-${dateInt}`,
      });
    }
  }

  out.sort((a, b) => a.timeMs - b.timeMs);
  return out.slice(0, Math.max(1, limit));
}


const stopTimesCache = new Map<string, [number, number][]>();

/** Decoded (sec-of-service-day, tripIdx) pairs for a stop, chronological. */
export function getStopTripTimes(stopId: string): [number, number][] {
  const hit = stopTimesCache.get(stopId);
  if (hit) return hit;
  const flat = loadTimetable().deps[stopId];
  const decoded = flat ? decodeDeps(flat) : [];
  stopTimesCache.set(stopId, decoded);
  return decoded;
}

export function getTripRouteShortName(tripIdx: number): string | null {
  const trip = loadTimetable().trips[tripIdx];
  if (!trip) return null;
  return loadRoutes()[trip[0] as number]?.shortName ?? null;
}

export function getTripHeadsign(tripIdx: number): string {
  const tt = loadTimetable();
  const trip = tt.trips[tripIdx];
  if (!trip) return '';
  const routes = loadRoutes();
  return tt.headsigns[trip[1] as number] || routes[trip[0] as number]?.longName || '';
}

export function serviceDayFor(boardSec: number, fromMs: number): { midnightMs: number; dateInt: number; weekdayIdx: number } {
  // Trips past midnight belong to the previous calendar day's service.
  const base = dayParts(fromMs).midnightMs + (boardSec >= 86_400 ? -86_400_000 : 0);
  const parts = dayParts(base + 60_000);
  return { midnightMs: base, dateInt: parts.dateInt, weekdayIdx: parts.weekdayIdx };
}

export function isTripActiveOn(tripIdx: number, boardSec: number, fromMs: number): boolean {
  const tt = loadTimetable();
  const trip = tt.trips[tripIdx];
  if (!trip) return false;
  const day = serviceDayFor(boardSec, fromMs);
  return activeServices(tt, day.dateInt, day.weekdayIdx).has(trip[2] as number);
}


let tripStopsCache: Map<number, { stopId: string; sec: number }[]> | null = null;

/** Ordered (stop, time) sequence of a trip, built once and cached. */
export function getTripStopSequence(tripIdx: number): { stopId: string; sec: number }[] {
  if (!tripStopsCache) {
    tripStopsCache = new Map();
    const deps = loadTimetable().deps;
    for (const [stopId, flat] of Object.entries(deps)) {
      for (const [sec, t] of decodeDeps(flat)) {
        const arr = tripStopsCache.get(t);
        if (arr) arr.push({ stopId, sec });
        else tripStopsCache.set(t, [{ stopId, sec }]);
      }
    }
    for (const arr of tripStopsCache.values()) arr.sort((a, b) => a.sec - b.sec);
  }
  return tripStopsCache.get(tripIdx) ?? [];
}
