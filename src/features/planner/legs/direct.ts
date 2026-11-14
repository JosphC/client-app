import type { BusMarker, LatLng, Station } from '../../map';
import type { TransitLeg, TransitOption } from '../transit';
import { approachingBusWait, FARE_PER_RIDE, HEADWAY_MIN, isReasonableDetour, maybeWalk, rideMin } from './geo';
import { pickAlightStation, scheduledDirection, timeRide, tripViaStations } from './schedule';

export function buildDirectOption(
  board: Station,
  walk: TransitLeg | null,
  line: string,
  targetStation: Station,
  destCoords: LatLng | null,
  destName: string,
  markers: BusMarker[],
  nowMs: number = Date.now(),
): TransitOption | null {
  const destPoint = destCoords ?? targetStation;
  const pick = pickAlightStation(line, destPoint, board, nowMs);
  if (!pick) return null;
  const { alight, scheduled } = pick;

  // Real timetable data: the next bus when one runs soon, else any scheduled
  // trip of the line (ride time, headsign and geometry don't depend on hour).
  // Only fully-unknown legs fall back to heuristics.
  const timed = scheduled
    ? {
        rideMin: scheduled.rideMin,
        headsign: scheduled.headsign,
        tripIdx: scheduled.tripIdx,
        boardSec: scheduled.boardSec,
        alightSec: scheduled.alightSec,
        upcomingWaitMin: scheduled.waitMin as number | null,
      }
    : timeRide(board, alight, line, nowMs);
  if (!timed) {
    if (scheduledDirection(board, alight, line, nowMs) === false) return null;
    if (!isReasonableDetour(board, alight, destPoint)) return null;
  }

  const approaching = approachingBusWait(markers, line, board, alight);
  // A live bus already coming our way beats the printed schedule.
  const wait: { minutes: number; crowd: 1 | 2 | 3 } =
    timed?.upcomingWaitMin != null
      ? {
          minutes: approaching ? Math.min(timed.upcomingWaitMin, approaching.minutes) : timed.upcomingWaitMin,
          crowd: approaching && approaching.minutes <= timed.upcomingWaitMin ? approaching.crowd : 2,
        }
      : (approaching ?? { minutes: HEADWAY_MIN, crowd: 2 as 1 | 2 | 3 });
  const rideMinutes = timed?.rideMin ?? rideMin(board, alight);
  const ride: TransitLeg = {
    kind: 'ride',
    line,
    minutes: rideMinutes,
    fromName: board.name,
    toName: alight.name,
    fromStation: board,
    toStation: alight,
    headsign: timed?.headsign ?? null,
    departMs: nowMs + ((walk?.minutes ?? 0) + wait.minutes) * 60_000,
    via: timed != null ? tripViaStations(timed.tripIdx, timed.boardSec, timed.alightSec) : undefined,
  };
  const lastWalk = destCoords ? maybeWalk(alight, alight.name, destCoords, destName) : null;
  const legs = [walk, ride, lastWalk].filter((l): l is TransitLeg => l !== null);
  const total = (walk?.minutes ?? 0) + wait.minutes + ride.minutes + (lastWalk?.minutes ?? 0);
  return {
    id: `d-${line}-${board.id}-${alight.id}`,
    legs,
    totalMin: total,
    fareRon: FARE_PER_RIDE,
    crowd: wait.crowd,
    line,
    boardStation: board,
    transferStation: null,
    alightStation: alight,
    headsign: timed?.headsign ?? null,
    viaStations: ride.via,
    shapeLegs: timed != null ? [{ tripIdx: timed.tripIdx, boardId: board.id, alightId: alight.id }] : undefined,
    estimated: timed?.upcomingWaitMin == null,
  };
}
