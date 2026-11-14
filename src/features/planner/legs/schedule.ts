import { loadStations, type LatLng, type Station } from '../../map';
import { getTripStopSequence } from '../../../services/repositories/gtfs/timetable';
import {
  findAnyForwardTrip,
  findForwardRides,
  lineRunsForwardOn,
  stopHasLineTrips,
} from '../../../services/repositories/gtfs/tripSearch';
import { nearestLineStations } from './geo';

export interface AlightPick {
  alight: Station;
  scheduled: ScheduledLegInfo | null;
}

/**
 * Alighting stop for a ride: the nearest stop of the line that the bus
 * actually serves in our travel direction. The geographically nearest stop
 * is often across the street on the opposite direction (e.g. E6 "Scalini"
 * vs "Campeador") — those are skipped via the timetable, falling back to
 * slightly farther but reachable stops.
 */
export function pickAlightStation(
  line: string,
  destPoint: LatLng,
  fromStation: Station,
  nowMs: number,
  fromMs: number = nowMs,
): AlightPick | null {
  let fallback: Station | null = null;
  for (const candidate of nearestLineStations(line, destPoint, 3)) {
    if (candidate.id === fromStation.id) continue;
    const scheduled = scheduledDirectRide(fromStation, candidate, line, nowMs, fromMs);
    if (scheduled) return { alight: candidate, scheduled };
    if (fallback === null && scheduledDirection(fromStation, candidate, line, nowMs) !== false) {
      fallback = candidate;
    }
  }
  if (!fallback) return null;
  return { alight: fallback, scheduled: null };
}

export interface ScheduledLegInfo {
  waitMin: number;
  rideMin: number;
  headsign: string;
  tripIdx: number;
  boardSec: number;
  alightSec: number;
}

/** Real scheduled ride board→alight (direction validated), or null. */
export function scheduledDirectRide(
  board: Station,
  alight: Station,
  line: string,
  nowMs: number,
  fromMs: number = nowMs,
): ScheduledLegInfo | null {
  const rides = findForwardRides(board.id, alight.id, line, fromMs, 120, 1);
  if (rides.length === 0) return null;
  const ride = rides[0];
  return {
    waitMin: Math.max(0, Math.round((ride.departMs - fromMs) / 60_000)),
    rideMin: ride.rideMin,
    headsign: ride.headsign,
    tripIdx: ride.tripIdx,
    boardSec: ride.boardSec,
    alightSec: ride.alightSec,
  };
}

export interface RideTiming {
  rideMin: number;
  headsign: string;
  tripIdx: number;
  boardSec: number;
  alightSec: number;
  /** Minutes until the next bus, or null off-hours (wait is then estimated). */
  upcomingWaitMin: number | null;
}

/**
 * Best available timing for a ride: the next scheduled bus when one runs soon,
 * otherwise any scheduled trip of the line (ride time, headsign and geometry
 * do not depend on the hour). Null only when the timetable knows nothing.
 */
export function timeRide(
  board: Station,
  alight: Station,
  line: string,
  nowMs: number,
  fromMs: number = nowMs,
): RideTiming | null {
  const upcoming = scheduledDirectRide(board, alight, line, nowMs, fromMs);
  if (upcoming) return { ...upcoming, upcomingWaitMin: upcoming.waitMin };
  const pattern = findAnyForwardTrip(board.id, alight.id, line);
  if (!pattern) return null;
  return { ...pattern, upcomingWaitMin: null };
}

/**
 * Direction check that works even when no bus runs right now (e.g. at night):
 * does the line ever serve board→alight in this order on the active service?
 * Returns null when the timetable has no (or only partial) data for the line
 * at these stops (unknown — caller should fall back to heuristics, not reject).
 */
export function scheduledDirection(board: Station, alight: Station, line: string, nowMs: number): boolean | null {
  if (!stopHasLineTrips(board.id, line) || !stopHasLineTrips(alight.id, line)) return null;
  return lineRunsForwardOn(board.id, alight.id, line, nowMs);
}

/** Ordered intermediate stations of a scheduled trip between two stop times. */
export function tripViaStations(tripIdx: number, boardSec: number, alightSec: number): Station[] {
  const seq = getTripStopSequence(tripIdx);
  const byId = new Map(loadStations().map((s) => [s.id, s]));
  const out: Station[] = [];
  const seen = new Set<string>();
  for (const p of seq) {
    if (p.sec <= boardSec || p.sec >= alightSec) continue;
    if (seen.has(p.stopId)) continue;
    seen.add(p.stopId);
    const station = byId.get(p.stopId);
    if (station) out.push(station);
  }
  return out;
}
