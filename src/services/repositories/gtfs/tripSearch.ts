import {
  getStopTripTimes,
  getTripHeadsign,
  getTripRouteShortName,
  isTripActiveOn,
  serviceDayFor,
} from './timetable';

/** Curse care servesc urcarea și apoi coborârea, în sensul corect, pe orarul GTFS. */
export interface ScheduledRide {
  tripIdx: number;
  routeShortName: string;
  headsign: string;
  /** Absolute departure time at the boarding stop. */
  departMs: number;
  /** Scheduled onboard time, in minutes. */
  rideMin: number;
  boardSec: number;
  alightSec: number;
}

/** Whether the stop has any scheduled trips of the line (timetable coverage). */
export function stopHasLineTrips(stopId: string, line: string): boolean {
  return getStopTripTimes(stopId).some(([, tripIdx]) => getTripRouteShortName(tripIdx) === line);
}

/**
 * Upcoming rides of `line` (or any line when null) that serve the boarding
 * stop and LATER the alighting stop — i.e. the correct travel direction,
 * with real scheduled times. Sorted by departure.
 */
export function findForwardRides(
  boardId: string,
  alightId: string,
  line: string | null,
  fromMs: number,
  windowMin = 120,
  limit = 3,
): ScheduledRide[] {
  const alightSecs = new Map<number, number[]>();
  for (const [sec, trip] of getStopTripTimes(alightId)) {
    const list = alightSecs.get(trip);
    if (list) list.push(sec);
    else alightSecs.set(trip, [sec]);
  }
  const endMs = fromMs + Math.max(1, windowMin) * 60_000;
  const out: ScheduledRide[] = [];
  for (const [boardSec, trip] of getStopTripTimes(boardId)) {
    if (line && getTripRouteShortName(trip) !== line) continue;
    const later = (alightSecs.get(trip) ?? []).filter((a) => a > boardSec);
    if (later.length === 0) continue;
    const alightSec = Math.min(...later);
    const day = serviceDayFor(boardSec, fromMs);
    const departMs = day.midnightMs + boardSec * 1000;
    if (departMs < fromMs || departMs > endMs) continue;
    if (!isTripActiveOn(trip, boardSec, fromMs)) continue;
    out.push({
      tripIdx: trip,
      routeShortName: getTripRouteShortName(trip) ?? line ?? '',
      headsign: getTripHeadsign(trip),
      departMs,
      rideMin: Math.max(1, Math.round((alightSec - boardSec) / 60)),
      boardSec,
      alightSec,
    });
  }
  out.sort((a, b) => a.departMs - b.departMs);
  return out.slice(0, Math.max(1, limit));
}

/**
 * Direction validity independent of the current time: does `line` ever run
 * from the boarding stop toward the alighting stop on the active service day?
 */
export function lineRunsForwardOn(boardId: string, alightId: string, line: string, fromMs: number): boolean {
  const alightSecs = new Map<number, number[]>();
  for (const [sec, trip] of getStopTripTimes(alightId)) {
    const list = alightSecs.get(trip);
    if (list) list.push(sec);
    else alightSecs.set(trip, [sec]);
  }
  for (const [boardSec, trip] of getStopTripTimes(boardId)) {
    if (getTripRouteShortName(trip) !== line) continue;
    if (!(alightSecs.get(trip) ?? []).some((a) => a > boardSec)) continue;
    if (!isTripActiveOn(trip, boardSec, fromMs)) continue;
    return true;
  }
  return false;
}

export interface ForwardTripPattern {
  tripIdx: number;
  headsign: string;
  rideMin: number;
  boardSec: number;
  alightSec: number;
}

/**
 * Any scheduled trip of `line` serving board→alight in order, ignoring the
 * service calendar and the current time. The ride time, headsign and geometry
 * of a line do not depend on the hour — so off-hours options (no upcoming
 * bus) still show the real ride time and the exact path instead of
 * haversine/OSRM guesses.
 */
export function findAnyForwardTrip(boardId: string, alightId: string, line: string): ForwardTripPattern | null {
  const alightSecs = new Map<number, number[]>();
  for (const [sec, trip] of getStopTripTimes(alightId)) {
    const list = alightSecs.get(trip);
    if (list) list.push(sec);
    else alightSecs.set(trip, [sec]);
  }
  let best: ForwardTripPattern | null = null;
  for (const [boardSec, trip] of getStopTripTimes(boardId)) {
    if (getTripRouteShortName(trip) !== line) continue;
    const later = (alightSecs.get(trip) ?? []).filter((a) => a > boardSec);
    if (later.length === 0) continue;
    const alightSec = Math.min(...later);
    if (!best || boardSec < best.boardSec) {
      best = {
        tripIdx: trip,
        headsign: getTripHeadsign(trip),
        rideMin: Math.max(1, Math.round((alightSec - boardSec) / 60)),
        boardSec,
        alightSec,
      };
    }
  }
  return best;
}
