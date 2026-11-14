import { haversineKm, loadStations, type LatLng, type Station } from '../../map';
import type { BusMarker } from '../../map';
import { SINGLE_FARE_RON, TICKET_VALIDITY_MIN } from '../../../core/config';
import type { TransitLeg } from '../transit';

export const WALK_KMH = 4.5;
export const BUS_KMH = 18;
/** Real footpaths are longer than the straight line between two points. */
export const WALK_ROAD_FACTOR = 1.3;
export const TRANSFER_MIN = 3;
export const HEADWAY_MIN = 8;
export const FARE_PER_RIDE = SINGLE_FARE_RON;
export const MAX_OPTIONS = 3;
export const MAX_BOARD_STATIONS = 5;

/**
 * Biletul cu timp acoperă toate îmbarcările din fereastra de valabilitate:
 * a doua urcare în ≤60 min de la prima validare circulă pe același bilet.
 */
export function transferFareRon(firstBoardMs: number, secondBoardMs: number): number {
  return secondBoardMs - firstBoardMs > TICKET_VALIDITY_MIN * 60_000
    ? SINGLE_FARE_RON * 2
    : SINGLE_FARE_RON;
}

export function walkMin(a: LatLng, b: LatLng): number {
  // Straight-line distance underestimates real footpaths (detours, crossings);
  // the road factor keeps walking times honest.
  return Math.max(1, Math.round((haversineKm(a, b) * WALK_ROAD_FACTOR) / WALK_KMH * 60));
}

export function rideMin(a: LatLng, b: LatLng): number {
  return Math.max(1, Math.round((haversineKm(a, b) / BUS_KMH) * 60));
}

export function nearestStations(point: LatLng, limit: number): Station[] {
  return [...loadStations()].sort((a, b) => haversineKm(point, a) - haversineKm(point, b)).slice(0, limit);
}

let lineStationsCache: Map<string, Station[]> | null = null;

export function stationsOfLine(): Map<string, Station[]> {
  if (!lineStationsCache) {
    lineStationsCache = new Map();
    for (const s of loadStations()) {
      for (const line of s.lines) {
        const list = lineStationsCache.get(line);
        if (list) list.push(s);
        else lineStationsCache.set(line, [s]);
      }
    }
  }
  return lineStationsCache;
}

export function nearestOnLine(line: string, to: LatLng): Station | null {
  const list = stationsOfLine().get(line);
  if (!list || list.length === 0) return null;
  let best = list[0];
  let bestKm = haversineKm(best, to);
  for (const s of list) {
    const km = haversineKm(s, to);
    if (km < bestKm) {
      best = s;
      bestKm = km;
    }
  }
  return best;
}

/** Nearest stations of a line to a point, nearest first. */
export function nearestLineStations(line: string, to: LatLng, limit = 3): Station[] {
  const list = stationsOfLine().get(line) ?? [];
  return [...list].sort((a, b) => haversineKm(a, to) - haversineKm(b, to)).slice(0, Math.max(1, limit));
}

export function waitForBus(markers: BusMarker[], line: string, at: LatLng): { minutes: number; crowd: 1 | 2 | 3 } {
  let best: { minutes: number; crowd: 1 | 2 | 3 } | null = null;
  for (const m of markers) {
    if (m.bus.line !== line || !m.position) continue;
    const speed = Math.max(m.position.speedKmh ?? BUS_KMH, 1);
    const minutes = Math.round((haversineKm(m.position, at) / speed) * 60);
    if (!best || minutes < best.minutes) best = { minutes, crowd: m.bus.crowd };
  }
  return best ?? { minutes: HEADWAY_MIN, crowd: 2 };
}

/**
 * Wait estimate from a live bus that is actually approaching the boarding
 * stop heading toward the alighting stop (triangle-inequality check: the
 * boarding stop lies roughly on the bus→destination path). Returns null when
 * no live bus on the line is coming our way — e.g. all are driving away.
 */
export function approachingBusWait(
  markers: BusMarker[],
  line: string,
  board: LatLng,
  alight: LatLng,
): { minutes: number; crowd: 1 | 2 | 3 } | null {
  const legKm = haversineKm(board, alight);
  const toleranceKm = Math.max(0.4, legKm * 0.2);
  let best: { minutes: number; crowd: 1 | 2 | 3 } | null = null;
  for (const m of markers) {
    if (m.bus.line !== line || !m.position) continue;
    const busKmToBoard = haversineKm(m.position, board);
    const busKmToAlight = haversineKm(m.position, alight);
    // Approaching via our stop: board lies on the bus→alight path.
    if (busKmToBoard + legKm - busKmToAlight > toleranceKm) continue;
    const speed = Math.max(m.position.speedKmh ?? BUS_KMH, 6);
    const minutes = Math.max(0, Math.round((busKmToBoard / speed) * 60));
    if (!best || minutes < best.minutes) best = { minutes, crowd: m.bus.crowd };
  }
  return best;
}

/**
 * Guards against absurd detours: going via `point` must not be much longer
 * (as the crow flies) than heading straight to the destination.
 */
export function isReasonableDetour(from: LatLng, via: LatLng, dest: LatLng, maxRatio = 1.6): boolean {
  const directKm = haversineKm(from, dest);
  if (directKm < 0.15) return true;
  return haversineKm(from, via) + haversineKm(via, dest) <= directKm * maxRatio;
}

export function maybeWalk(from: LatLng, fromName: string, to: LatLng, toName: string): TransitLeg | null {
  if (haversineKm(from, to) < 0.03) return null;
  return { kind: 'walk', line: null, minutes: walkMin(from, to), fromName, toName };
}

export function deduplicateBoardStations(
  boards: { station: Station; walk: TransitLeg | null }[],
  originCoords: LatLng | null,
): Map<string, { station: Station; walk: TransitLeg | null }> {
  const map = new Map<string, { station: Station; walk: TransitLeg | null }>();
  for (const item of boards) {
    for (const line of item.station.lines) {
      const existing = map.get(line);
      const walkKm = originCoords ? haversineKm(originCoords, item.station) : 0;
      if (!existing || walkKm < (originCoords ? haversineKm(originCoords, existing.station) : 0)) {
        map.set(line, item);
      }
    }
  }
  return map;
}
