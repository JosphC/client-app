import { useEffect, useMemo, useState } from 'react';
import { getTripShapeSlice } from '../../services/repositories/gtfs/shapes';
import { haversineKm, type LatLng, type Station } from '../map';
import { fetchOsrmGeometry, fetchWalkingGeometry, pinEndpoints } from './legs/streetRouting';
import type { TransitOption } from './transit';

export { decodePolyline6, fetchOsrmGeometry, fetchValhallaWalking, fetchWalkingGeometry, pinEndpoints } from './legs/streetRouting';

export interface RoutePolylineSegment {
  id: string;
  kind: 'walk' | 'transit';
  line?: string;
  color: string;
  coordinates: LatLng[];
  /** Exact GTFS shape path — no router enrichment needed. */
  exact?: boolean;
  /** Transit: intermediate stops drawn as small dots on the line. */
  stops?: LatLng[];
}

function buildFallbackSegments(
  startPoint: LatLng | null,
  chosen: TransitOption | null,
  endPoint: LatLng | null,
): RoutePolylineSegment[] {
  if (!chosen) return [];
  const list: RoutePolylineSegment[] = [];
  const rides = chosen.legs.filter((l) => l.kind === 'ride');
  if (rides.length === 0) {
    // Walking-only option: one footpath from start to end.
    if (startPoint && endPoint) list.push({ id: 'walk-only', kind: 'walk', color: '#3B82F6', coordinates: [startPoint, endPoint] });
    return list;
  }

  // Transit legs use the exact GTFS shape path when available (the same
  // geometry Google Maps draws) — no car-router approximation. Otherwise they
  // follow the real trip path through intermediate stations. Any number of
  // rides, with a walk where a transfer changes stop.
  const ends = (i: number): { from: Station; to: Station } => ({
    from: rides[i]?.fromStation ?? (i === 0 ? chosen.boardStation : chosen.transferStation ?? chosen.boardStation),
    to: rides[i]?.toStation ?? (i === rides.length - 1 ? chosen.alightStation : chosen.transferStation ?? chosen.alightStation),
  });

  if (startPoint) {
    list.push({ id: 'walk-start', kind: 'walk', color: '#3B82F6', coordinates: [startPoint, ends(0).from] });
  }
  rides.forEach((ride, i) => {
    const { from, to } = ends(i);
    const prevTo = i > 0 ? ends(i - 1).to : null;
    if (prevTo && prevTo.id !== from.id) {
      list.push({ id: `walk-transfer-${i}`, kind: 'walk', color: '#3B82F6', coordinates: [prevTo, from] });
    }
    const via = ride.via ?? [];
    const shape = chosen.shapeLegs?.[i];
    const slice = shape ? getTripShapeSlice(shape.tripIdx, [from, ...via, to]) : null;
    list.push({
      id: `transit-${i + 1}-${ride.line ?? chosen.line}`,
      kind: 'transit',
      line: ride.line ?? chosen.line,
      color: '#2563EB',
      coordinates: slice ? pinEndpoints(slice, [from, to]) : [from, ...via, to],
      exact: slice != null,
      stops: via,
    });
  });
  if (endPoint) {
    list.push({ id: 'walk-end', kind: 'walk', color: '#3B82F6', coordinates: [ends(rides.length - 1).to, endPoint] });
  }
  return list;
}

export function useRouteGeometry(
  startPoint: LatLng | null,
  chosen: TransitOption | null,
  endPoint: LatLng | null,
): { segments: RoutePolylineSegment[]; allCoordinates: LatLng[] } {
  const startKey = startPoint ? `${startPoint.lat.toFixed(5)},${startPoint.lng.toFixed(5)}` : '';
  const endKey = endPoint ? `${endPoint.lat.toFixed(5)},${endPoint.lng.toFixed(5)}` : '';
  const chosenKey = chosen ? `${chosen.id}:${chosen.totalMin}` : '';

  const fallback = useMemo(
    () => buildFallbackSegments(startPoint, chosen, endPoint),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startKey, chosenKey, endKey],
  );
  const [segments, setSegments] = useState<RoutePolylineSegment[]>(fallback);

  useEffect(() => {
    setSegments(fallback);
    if (!chosen) return;
    let cancelled = false;

    async function enrich() {
      const enriched = await Promise.all(
        fallback.map(async (seg) => {
          if (seg.kind === 'walk') {
            const walkCoords = await fetchWalkingGeometry(seg.coordinates);
            if (cancelled || walkCoords.length < 2) return seg;
            return { ...seg, coordinates: walkCoords };
          }
          // Exact GTFS shapes are already the real bus path — never routerize.
          if (seg.exact) return seg;
          const roadCoords = await fetchOsrmGeometry(seg.coordinates, 'driving', 8000);
          if (cancelled || !roadCoords || roadCoords.length < 2) return seg;
          // Loop guard: a car-router U-turn (e.g. divided boulevards) draws a
          // spike; keep the waypoint path instead of an absurd detour.
          if (seg.coordinates.length >= 2) {
            const from = seg.coordinates[0];
            const to = seg.coordinates[seg.coordinates.length - 1];
            const beelineKm = haversineKm(from, to);
            if (beelineKm > 0.2) {
              let pathKm = 0;
              for (let i = 1; i < roadCoords.length; i++) {
                pathKm += haversineKm(roadCoords[i - 1], roadCoords[i]);
              }
              if (pathKm > beelineKm * 2.5) return seg;
            }
          }
          return { ...seg, coordinates: roadCoords };
        }),
      );
      if (!cancelled) setSegments(enriched);
    }

    void enrich();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fallback, chosenKey]);

  const allCoordinates = useMemo(() => {
    const acc: LatLng[] = [];
    if (startPoint) acc.push(startPoint);
    for (const seg of segments) acc.push(...seg.coordinates);
    if (endPoint) acc.push(endPoint);
    return acc;
  }, [startPoint, segments, endPoint]);

  return { segments, allCoordinates };
}
