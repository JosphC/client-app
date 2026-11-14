import { loadShapes } from './shapes';
import { getStopTripTimes, getTripRouteShortName } from './timetable';

export interface StopPattern {
  line: string;
  /** Indexul formei GTFS (traseul complet al cursei, de la prima la ultima stație). */
  shapeIdx: number;
  /** O cursă reprezentativă a variantei (pentru secvența de stații). */
  tripIdx: number;
  /** Plecări din stația aleasă pe această variantă. */
  departures: number;
}

/**
 * Variantele de traseu care opresc la stația (peronul) `stopId`: cursele ei
 * grupate pe forma GTFS. Fiecare variantă e traseul întreg al cursei, înainte
 * și după stație, doar pe sensul care folosește acest peron.
 */
export function stopPatterns(stopId: string): StopPattern[] {
  const shapeOfTrip = loadShapes().trips;
  const byShape = new Map<number, StopPattern>();
  for (const [, tripIdx] of getStopTripTimes(stopId)) {
    const shapeIdx = shapeOfTrip[tripIdx];
    const line = getTripRouteShortName(tripIdx);
    if (shapeIdx === undefined || shapeIdx < 0 || !line) continue;
    const hit = byShape.get(shapeIdx);
    if (hit) hit.departures += 1;
    else byShape.set(shapeIdx, { line, shapeIdx, tripIdx, departures: 1 });
  }
  return [...byShape.values()];
}
