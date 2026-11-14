import { SINGLE_FARE_RON, TICKET_VALIDITY_MIN } from '../../core/config';
import { loadStations, type BusMarker, type LatLng, type Station } from '../map';
import {
  distKm,
  FOOTPATH_KM,
  getRaptorNetwork,
  serviceDays,
  walkSec,
  type RaptorNetwork,
} from '../../services/repositories/gtfs/network';
import { getTripHeadsign, getTripRouteShortName } from '../../services/repositories/gtfs/timetable';
import { runRaptor, type RaptorJourney } from './raptor';
import { MAX_OPTIONS, tripViaStations, waitForBus } from './transitHelpers';
import type { TransitLeg, TransitOption } from './transit';

/** Walking radius to/from stops (Moovit/Transit default ≈ 1 km). */
const ACCESS_KM = 1.0;
const MAX_RIDES = 3;
/** Ranking like Google/Moovit: a transfer "costs" 5 min, walking is a bit worse than riding. */
const TRANSFER_PENALTY_SEC = 300;
const WALK_RELUCTANCE = 0.5;
/** Alternatives must stay close to the best option. */
const SLACK_SEC = 20 * 60;
const MAX_WALK_ONLY_SEC = 25 * 60;

export interface PlanEnds {
  originCoords: LatLng;
  originName: string;
  originStation: Station | null;
  destCoords: LatLng;
  destName: string;
  destStation: Station | null;
}

function reachable(net: RaptorNetwork, point: LatLng, station: Station | null): Map<number, number> {
  const out = new Map<number, number>();
  const own = station ? net.stopIndex.get(station.id) : undefined;
  if (own !== undefined) out.set(own, 0);
  const radius = station ? FOOTPATH_KM : ACCESS_KM;
  const ranked: { i: number; km: number }[] = [];
  for (let i = 0; i < net.stopIds.length; i++) {
    ranked.push({ i, km: distKm(point.lat, point.lng, net.lat[i] as number, net.lng[i] as number) });
  }
  ranked.sort((a, b) => a.km - b.km);
  ranked.forEach(({ i, km }, rank) => {
    if ((km <= radius || rank < 3) && !out.has(i)) out.set(i, walkSec(km));
  });
  return out;
}

function walkSecs(j: RaptorJourney, access: Map<number, number>, egress: Map<number, number>): number {
  const transfers = j.steps.reduce((sum, s) => sum + (s.kind === 'walk' ? s.sec : 0), 0);
  return (access.get(j.accessStop) ?? 0) + transfers + (egress.get(j.egressStop) ?? 0);
}

function routeKey(net: RaptorNetwork, j: RaptorJourney): string {
  return j.steps.map((s) => (s.kind === 'ride' ? `${net.patterns[s.pattern]?.route}:${s.from}>${s.to}` : 'w')).join('|');
}

function walkLeg(sec: number, fromName: string, toName: string): TransitLeg {
  return { kind: 'walk', line: null, minutes: Math.max(1, Math.round(sec / 60)), fromName, toName };
}

function fareRon(boardTimes: number[]): number {
  let tickets = 0;
  let validFrom = -Infinity;
  for (const t of boardTimes) {
    if (t - validFrom > TICKET_VALIDITY_MIN * 60_000) {
      tickets += 1;
      validFrom = t;
    }
  }
  return tickets * SINGLE_FARE_RON;
}

function toOption(
  j: RaptorJourney, ends: PlanEnds, ctx: { net: RaptorNetwork; access: Map<number, number>; egress: Map<number, number> },
  departSec: number, midnightMs: number, markers: BusMarker[],
): TransitOption | null {
  const byId = new Map(loadStations().map((s) => [s.id, s]));
  const station = (i: number): Station | undefined => byId.get(ctx.net.stopIds[i] ?? '');
  const legs: TransitLeg[] = [];
  const first = station(j.accessStop);
  const accessSec = ctx.access.get(j.accessStop) ?? 0;
  if (!first) return null;
  if (accessSec >= 30) legs.push(walkLeg(accessSec, ends.originName, first.name));
  const rides: { leg: TransitLeg; from: Station; to: Station; trip: number }[] = [];
  for (const step of j.steps) {
    const from = station(step.from);
    const to = station(step.to);
    if (!from || !to) return null;
    if (step.kind === 'walk') {
      legs.push(walkLeg(step.sec, from.name, to.name));
      continue;
    }
    const line = getTripRouteShortName(step.trip) ?? '';
    const leg: TransitLeg = {
      kind: 'ride', line, minutes: Math.max(1, Math.round((step.alightSec - step.boardSec) / 60)),
      fromName: from.name, toName: to.name, fromStation: from, toStation: to,
      headsign: getTripHeadsign(step.trip) || null,
      departMs: midnightMs + (step.boardSec + step.offset) * 1000,
      via: tripViaStations(step.trip, step.boardSec, step.alightSec),
    };
    legs.push(leg);
    rides.push({ leg, from, to, trip: step.trip });
  }
  const egressSec = ctx.egress.get(j.egressStop) ?? 0;
  const last = rides[rides.length - 1];
  const head = rides[0];
  if (!head || !last) return null;
  if (egressSec >= 30) legs.push(walkLeg(egressSec, last.to.name, ends.destName));
  return {
    id: `rp-${rides.map((r) => r.leg.line).join('-')}-${head.from.id}-${head.leg.departMs ?? 0}`,
    legs,
    totalMin: Math.max(1, Math.ceil((j.arrival - departSec) / 60)),
    fareRon: fareRon(rides.map((r) => r.leg.departMs ?? 0)),
    crowd: waitForBus(markers, head.leg.line ?? '', head.from).crowd,
    line: head.leg.line ?? '',
    boardStation: head.from,
    transferStation: rides.length > 1 ? head.to : null,
    alightStation: last.to,
    headsign: head.leg.headsign ?? null,
    viaStations: rides.flatMap((r, i) => (i === 0 ? r.leg.via ?? [] : [r.from, ...(r.leg.via ?? [])])),
    shapeLegs: rides.map((r) => ({ tripIdx: r.trip, boardId: r.from.id, alightId: r.to.id })),
    estimated: false,
  };
}

function walkOnly(ends: PlanEnds, sec: number): TransitOption {
  const anchor = ends.destStation ?? ends.originStation ?? loadStations()[0] as Station;
  return {
    id: `walk-${ends.destName}`,
    legs: [walkLeg(sec, ends.originName, ends.destName)],
    totalMin: Math.max(1, Math.round(sec / 60)),
    fareRon: 0, crowd: 1, line: 'Pe jos',
    boardStation: anchor, transferStation: null, alightStation: anchor,
  };
}

/**
 * Moovit/Transit-style planning on the bundled timetable: exact RAPTOR
 * journeys (walking access within ~1 km, walking transfers between nearby
 * stops, up to 3 rides), alternatives found by excluding the routes already
 * used, ranked with a transfer penalty, plus walking when it is competitive.
 */
export function planWithRaptor(ends: PlanEnds, markers: BusMarker[], nowMs: number): TransitOption[] {
  // Same trip within the same minute → same journeys; live buses only refresh the crowd level.
  const key = [ends.originCoords.lat, ends.originCoords.lng, ends.originStation?.id, ends.destCoords.lat, ends.destCoords.lng,
    ends.destStation?.id, ends.originName, ends.destName, Math.floor(nowMs / 60_000)].join('|');
  const hit = planCache.get(key);
  if (hit) return hit.map((o) => (o.legs.some((l) => l.kind === 'ride') ? { ...o, crowd: waitForBus(markers, o.line, o.boardStation).crowd } : o));
  const result = computePlan(ends, markers, nowMs);
  planCache.set(key, result);
  if (planCache.size > 20) planCache.delete(planCache.keys().next().value as string);
  return result;
}

const planCache = new Map<string, TransitOption[]>();

function computePlan(ends: PlanEnds, markers: BusMarker[], nowMs: number): TransitOption[] {
  const net = getRaptorNetwork();
  const access = reachable(net, ends.originCoords, ends.originStation);
  const egress = reachable(net, ends.destCoords, ends.destStation);
  const { midnightMs, days } = serviceDays(nowMs);
  const departSec = Math.floor((nowMs - midnightMs) / 1000);
  const found = new Map<string, RaptorJourney>();
  const banned = new Set<number>();
  for (let round = 0; round < 5 && found.size < 8; round++) {
    const result = runRaptor({ net, access, egress, departSec, days, maxRides: MAX_RIDES, bannedRoutes: banned });
    if (result.length === 0) break;
    for (const j of result) {
      if (!found.has(routeKey(net, j))) found.set(routeKey(net, j), j);
      const firstRide = j.steps.find((s) => s.kind === 'ride');
      if (firstRide?.kind === 'ride') banned.add(net.patterns[firstRide.pattern]?.route ?? -1);
    }
  }
  const scored = [...found.values()].map((j) => {
    const walk = walkSecs(j, access, egress);
    return { j, walk, score: j.arrival - departSec + TRANSFER_PENALTY_SEC * (j.rides - 1) + WALK_RELUCTANCE * walk };
  });
  // One option per line combination (the best-scored one), like Moovit's list.
  scored.sort((a, b) => a.score - b.score);
  const seenLines = new Set<string>();
  const kept = scored.filter(({ j }) => {
    const key = j.steps.map((s) => (s.kind === 'ride' ? net.patterns[s.pattern]?.route : '')).filter((r) => r !== '').join('>');
    if (seenLines.has(key)) return false;
    seenLines.add(key);
    return true;
  });
  const bestScore = kept[0]?.score ?? Infinity;
  const ctx = { net, access, egress };
  const options = kept
    .filter((x) => x.score <= bestScore + SLACK_SEC)
    .map((x) => toOption(x.j, ends, ctx, departSec, midnightMs, markers))
    .filter((o): o is TransitOption => o !== null)
    .slice(0, MAX_OPTIONS);
  const direct = walkSec(distKm(ends.originCoords.lat, ends.originCoords.lng, ends.destCoords.lat, ends.destCoords.lng));
  const fastest = options.reduce((m, o) => Math.min(m, o.totalMin * 60), Infinity);
  if (direct <= MAX_WALK_ONLY_SEC && (direct <= fastest || direct <= 10 * 60)) {
    const walk = walkOnly(ends, direct);
    return direct <= fastest ? [walk, ...options].slice(0, MAX_OPTIONS) : [...options.slice(0, MAX_OPTIONS - 1), walk];
  }
  return options;
}
