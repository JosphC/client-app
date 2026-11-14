import { haversineKm, type BusMarker, type LatLng, type Station } from '../../map';
import type { TransitLeg, TransitOption } from '../transit';
import {
  approachingBusWait,
  HEADWAY_MIN,
  isReasonableDetour,
  maybeWalk,
  rideMin,
  stationsOfLine,
  TRANSFER_MIN,
  transferFareRon,
} from './geo';
import {
  pickAlightStation,
  scheduledDirectRide,
  scheduledDirection,
  timeRide,
  tripViaStations,
  type RideTiming,
} from './schedule';

export function buildTransferOption(
  board: Station,
  walk: TransitLeg | null,
  first: string,
  second: string,
  targetStation: Station,
  destCoords: LatLng | null,
  destName: string,
  markers: BusMarker[],
  nowMs: number = Date.now(),
): TransitOption | null {
  if (first === second) return null;
  const firstStops = stationsOfLine().get(first);
  const secondIds = new Set((stationsOfLine().get(second) ?? []).map((s) => s.id));
  if (!firstStops) return null;
  const destPoint = destCoords ?? targetStation;

  // Shared stations ranked by detour sanity — never transfer backwards.
  const candidates = firstStops
    .filter((s) => secondIds.has(s.id) && s.id !== board.id)
    .filter((s) => isReasonableDetour(board, s, destPoint))
    .sort(
      (a, b) =>
        haversineKm(board, a) + haversineKm(a, destPoint) - (haversineKm(board, b) + haversineKm(b, destPoint)),
    )
    .slice(0, 4);

  let best: TransitOption | null = null;
  for (const change of candidates) {
    const opt = buildTransferVia(board, walk, first, second, change, destCoords, destPoint, destName, markers, nowMs);
    if (opt && (!best || opt.totalMin < best.totalMin)) best = opt;
  }
  return best;
}

function buildTransferVia(
  board: Station,
  walk: TransitLeg | null,
  first: string,
  second: string,
  change: Station,
  destCoords: LatLng | null,
  destPoint: LatLng,
  destName: string,
  markers: BusMarker[],
  nowMs: number,
): TransitOption | null {
  // Direction validity of the first leg (timetable pattern; unknown when no data).
  if (scheduledDirection(board, change, first, nowMs) === false) return null;

  const walkMinutes = walk?.minutes ?? 0;
  const leg1Scheduled = scheduledDirectRide(board, change, first, nowMs);
  const leg1Timed: RideTiming | null = leg1Scheduled
    ? { ...leg1Scheduled, upcomingWaitMin: leg1Scheduled.waitMin }
    : timeRide(board, change, first, nowMs);
  const approaching1 = approachingBusWait(markers, first, board, change);
  const wait1 =
    leg1Timed?.upcomingWaitMin != null
      ? approaching1
        ? Math.min(leg1Timed.upcomingWaitMin, approaching1.minutes)
        : leg1Timed.upcomingWaitMin
      : (approaching1?.minutes ?? HEADWAY_MIN);
  const ride1Min = leg1Timed?.rideMin ?? rideMin(board, change);
  const arrive1Ms = nowMs + (walkMinutes + wait1 + ride1Min) * 60_000;

  // The second bus must realistically connect after the first arrival, at a
  // stop it actually serves in our direction.
  const pick = pickAlightStation(second, destPoint, change, nowMs, arrive1Ms + TRANSFER_MIN * 60_000);
  if (!pick) return null;
  const { alight, scheduled: leg2Upcoming } = pick;
  const leg2Timed =
    leg2Upcoming != null
      ? {
          rideMin: leg2Upcoming.rideMin,
          headsign: leg2Upcoming.headsign,
          tripIdx: leg2Upcoming.tripIdx,
          boardSec: leg2Upcoming.boardSec,
          alightSec: leg2Upcoming.alightSec,
          upcomingWaitMin: leg2Upcoming.waitMin as number | null,
        }
      : timeRide(change, alight, second, nowMs, arrive1Ms + TRANSFER_MIN * 60_000);
  if (!leg2Timed && !isReasonableDetour(change, alight, destPoint)) return null;
  const wait2 = leg2Timed?.upcomingWaitMin ?? HEADWAY_MIN;
  const ride2Min = leg2Timed?.rideMin ?? rideMin(change, alight);

  const ride1: TransitLeg = {
    kind: 'ride',
    line: first,
    minutes: ride1Min,
    fromName: board.name,
    toName: change.name,
    fromStation: board,
    toStation: change,
    headsign: leg1Timed?.headsign ?? null,
  };
  const ride2: TransitLeg = {
    kind: 'ride',
    line: second,
    minutes: ride2Min,
    fromName: change.name,
    toName: alight.name,
    fromStation: change,
    toStation: alight,
    headsign: leg2Timed?.headsign ?? null,
  };
  const lastWalk = destCoords ? maybeWalk(alight, alight.name, destCoords, destName) : null;
  const legs = [walk, ride1, ride2, lastWalk].filter((l): l is TransitLeg => l !== null);
  const total = walkMinutes + wait1 + ride1Min + TRANSFER_MIN + wait2 + ride2Min + (lastWalk?.minutes ?? 0);
  const firstBoardMs = nowMs + (walkMinutes + wait1) * 60_000;
  const secondBoardMs = arrive1Ms + TRANSFER_MIN * 60_000 + wait2 * 60_000;
  const via1 = leg1Timed ? tripViaStations(leg1Timed.tripIdx, leg1Timed.boardSec, leg1Timed.alightSec) : [];
  const via2 = leg2Timed ? tripViaStations(leg2Timed.tripIdx, leg2Timed.boardSec, leg2Timed.alightSec) : [];
  Object.assign(ride1, { departMs: firstBoardMs, via: via1 });
  Object.assign(ride2, { departMs: secondBoardMs, via: via2 });
  const upcoming = leg1Timed?.upcomingWaitMin != null && leg2Timed?.upcomingWaitMin != null;
  const shapeLegs: { tripIdx: number; boardId: string; alightId: string }[] = [];
  if (leg1Timed) shapeLegs.push({ tripIdx: leg1Timed.tripIdx, boardId: board.id, alightId: change.id });
  if (leg2Timed) shapeLegs.push({ tripIdx: leg2Timed.tripIdx, boardId: change.id, alightId: alight.id });
  return {
    id: `t-${first}-${second}-${board.id}-${change.id}-${alight.id}`,
    legs,
    totalMin: total,
    fareRon: transferFareRon(firstBoardMs, secondBoardMs),
    crowd:
      approaching1 && (leg1Timed?.upcomingWaitMin == null || approaching1.minutes <= leg1Timed.upcomingWaitMin)
        ? approaching1.crowd
        : 2,
    line: first,
    boardStation: board,
    transferStation: change,
    alightStation: alight,
    headsign: leg1Timed?.headsign ?? null,
    viaStations: [...via1, ...via2],
    shapeLegs: shapeLegs.length > 0 ? shapeLegs : undefined,
    estimated: !upcoming,
  };
}
