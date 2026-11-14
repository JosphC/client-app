import { tripService, type RaptorNetwork, type RaptorPattern, type ServiceDay } from '../../services/repositories/gtfs/network';

/**
 * RAPTOR (Delling et al., Microsoft Research) — the round-based public
 * transit router behind Moovit/Transit-style planners. Round k finds the
 * earliest arrival at every stop with at most k rides; each round scans every
 * pattern touched by an improved stop once, then relaxes walking transfers.
 * The result is the Pareto set (arrival time × number of rides).
 */
export interface RideStep {
  kind: 'ride';
  pattern: number;
  trip: number;
  /** Scheduled (raw GTFS) seconds; add `offset` for query-relative time. */
  boardSec: number;
  alightSec: number;
  offset: number;
  from: number;
  to: number;
}
export interface WalkStep {
  kind: 'walk';
  from: number;
  to: number;
  sec: number;
}
export type JourneyStep = RideStep | WalkStep;

export interface RaptorJourney {
  rides: number;
  /** Query-relative seconds at the destination (after the final walk). */
  arrival: number;
  accessStop: number;
  egressStop: number;
  steps: JourneyStep[];
}

export interface RaptorQuery {
  net: RaptorNetwork;
  /** Stops reachable on foot from the origin, with walking seconds. */
  access: Map<number, number>;
  egress: Map<number, number>;
  departSec: number;
  days: ServiceDay[];
  maxRides: number;
  /** Route indexes not allowed (used to discover alternative routes). */
  bannedRoutes?: Set<number>;
}

/** Minimum time to change vehicles (walk to the door, schedule slack). */
export const TRANSFER_BUFFER_SEC = 120;
/** Ignore departures further than this from the query (night gaps included). */
const HORIZON_SEC = 10 * 3600;

type Parent = { kind: 'access' } | RideStep | WalkStep;

function earliestTrip(p: RaptorPattern, pos: number, need: number, days: ServiceDay[]) {
  let best: { i: number; dep: number; offset: number } | null = null;
  for (const day of days) {
    const target = need - day.offset;
    let i = 0;
    if (p.fifo) {
      let lo = 0;
      let hi = p.times.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if ((p.times[mid]?.[pos] ?? 0) < target) lo = mid + 1;
        else hi = mid;
      }
      i = lo;
    }
    for (; i < p.times.length; i++) {
      const sec = p.times[i]?.[pos] ?? 0;
      if (sec < target) continue;
      if (!day.active.has(tripService(p.trips[i] as number))) continue;
      const dep = sec + day.offset;
      if (!best || dep < best.dep) best = { i, dep, offset: day.offset };
      if (p.fifo) break;
    }
  }
  return best;
}

export function runRaptor(q: RaptorQuery): RaptorJourney[] {
  const { net, access, departSec, days, maxRides } = q;
  const n = net.stopIds.length;
  const tau: Float64Array[] = [new Float64Array(n).fill(Infinity)];
  const parents: (Parent | undefined)[][] = [new Array(n)];
  const best = new Float64Array(n).fill(Infinity);
  let marked = new Set<number>();
  for (const [stop, sec] of access) {
    (tau[0] as Float64Array)[stop] = departSec + sec;
    best[stop] = departSec + sec;
    (parents[0] as Parent[])[stop] = { kind: 'access' };
    marked.add(stop);
  }

  for (let k = 1; k <= maxRides && marked.size > 0; k++) {
    const prev = tau[k - 1] as Float64Array;
    const cur = Float64Array.from(prev);
    const par: (Parent | undefined)[] = new Array(n);
    tau.push(cur);
    parents.push(par);
    const queue = new Map<number, number>();
    for (const s of marked) {
      for (const { p, pos } of net.stopPatterns[s] ?? []) {
        if (q.bannedRoutes?.has(net.patterns[p]?.route ?? -1)) continue;
        const known = queue.get(p);
        if (known === undefined || pos < known) queue.set(p, pos);
      }
    }
    const rideMarked = new Set<number>();
    for (const [p, startPos] of queue) {
      const pattern = net.patterns[p] as RaptorPattern;
      let trip: { i: number; offset: number; boardPos: number; label: number } | null = null;
      for (let pos = startPos; pos < pattern.stops.length; pos++) {
        const s = pattern.stops[pos] as number;
        if (trip) {
          const arr = (pattern.times[trip.i]?.[pos] ?? Infinity) + trip.offset;
          if (arr < best[s]) {
            cur[s] = arr;
            best[s] = arr;
            const boardSec = pattern.times[trip.i]?.[trip.boardPos] ?? 0;
            par[s] = {
              kind: 'ride', pattern: p, trip: pattern.trips[trip.i] as number, offset: trip.offset,
              boardSec, alightSec: arr - trip.offset, from: pattern.stops[trip.boardPos] as number, to: s,
            };
            rideMarked.add(s);
          }
        }
        if (prev[s] === Infinity || pos === pattern.stops.length - 1) continue;
        const need = prev[s] + (k > 1 ? TRANSFER_BUFFER_SEC : 0);
        const curDep = trip ? (pattern.times[trip.i]?.[pos] ?? Infinity) + trip.offset : Infinity;
        if (need > curDep) continue;
        const et = earliestTrip(pattern, pos, need, days);
        if (et && et.dep < curDep && et.dep <= departSec + HORIZON_SEC) trip = { i: et.i, offset: et.offset, boardPos: pos, label: prev[s] };
        // Same vehicle, reachable sooner here (e.g. less walking): board it at this stop instead.
        else if (trip && prev[s] < trip.label) trip = { i: trip.i, offset: trip.offset, boardPos: pos, label: prev[s] };
      }
    }
    marked = new Set(rideMarked);
    for (const s of rideMarked) {
      // Only walk on from a stop reached by a ride (no walk-after-walk chains).
      if (par[s]?.kind !== 'ride') continue;
      for (const fp of net.footpaths[s] ?? []) {
        const arr = cur[s] + fp.sec;
        if (arr < best[fp.to]) {
          cur[fp.to] = arr;
          best[fp.to] = arr;
          par[fp.to] = { kind: 'walk', from: s, to: fp.to, sec: fp.sec };
          marked.add(fp.to);
        }
      }
    }
  }
  return collect(q, tau, parents);
}

function parentAt(parents: (Parent | undefined)[][], k: number, s: number): { parent: Parent; round: number } | null {
  for (let r = k; r >= 0; r--) {
    const p = parents[r]?.[s];
    if (p) return { parent: p, round: r };
  }
  return null;
}

function collect(q: RaptorQuery, tau: Float64Array[], parents: (Parent | undefined)[][]): RaptorJourney[] {
  const out: RaptorJourney[] = [];
  let bestArrival = Infinity;
  for (let k = 1; k < tau.length; k++) {
    let target: { stop: number; arrival: number } | null = null;
    for (const [stop, sec] of q.egress) {
      const p = parents[k]?.[stop];
      // Egress walks start where a ride ended (no walk-then-walk chains).
      if (!p || p.kind !== 'ride') continue;
      const arrival = (tau[k] as Float64Array)[stop] + sec;
      if (!target || arrival < target.arrival) target = { stop, arrival };
    }
    if (!target || target.arrival >= bestArrival) continue;
    const steps: JourneyStep[] = [];
    let stop = target.stop;
    let round = k;
    let accessStop = -1;
    for (let guard = 0; guard < 16; guard++) {
      const found = parentAt(parents, round, stop);
      if (!found) break;
      const { parent } = found;
      round = found.round;
      if (parent.kind === 'access') {
        accessStop = stop;
        break;
      }
      steps.unshift(parent);
      stop = parent.from;
      if (parent.kind === 'ride') round -= 1;
    }
    if (accessStop < 0 || !steps.some((s) => s.kind === 'ride')) continue;
    bestArrival = target.arrival;
    out.push({ rides: steps.filter((s) => s.kind === 'ride').length, arrival: target.arrival, accessStop, egressStop: target.stop, steps });
  }
  return out;
}
