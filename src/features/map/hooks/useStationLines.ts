import { useMemo } from 'react';
import { loadShapes } from '../../../services/repositories/gtfs/shapes';
import { stopPatterns } from '../../../services/repositories/gtfs/stopPatterns';
import { findRoute, getRouteCatalog, getTripStopSequence } from '../../../services/repositories/gtfs/timetable';
import { loadStations, type Station } from '../stations';
import type { MapRouteSegment } from '../components/map/LiveMap';

/**
 * Traseele care opresc la stația aleasă, ca în Google Maps: traseul întreg
 * (înainte și după stație) al fiecărei variante de pe acest peron, în culoarea
 * oficială a liniei, cu un punct la fiecare stație. Suprapunerea urmează
 * ordinea din catalogul de rute (routes.txt): liniile de la începutul listei
 * se desenează ultimele, deci deasupra (în poza Google, E2/E3 stau peste 15/16 și M3).
 */
export function useStationLines(station: Station | null, fallbackColor: string): MapRouteSegment[] {
  return useMemo(() => {
    if (!station) return [];
    const coords = loadShapes().coords;
    const byId = new Map(loadStations().map((s) => [s.id, s]));
    const rank = new Map(getRouteCatalog().map((r, i) => [r.shortName, i]));
    return stopPatterns(station.id)
      .sort((a, b) => (rank.get(b.line) ?? 0) - (rank.get(a.line) ?? 0) || b.shapeIdx - a.shapeIdx)
      .map((p) => ({
        id: `stationline-${p.shapeIdx}`,
        kind: 'transit' as const,
        line: p.line,
        color: findRoute(p.line)?.color ?? fallbackColor,
        coordinates: coords[p.shapeIdx].map(([lat, lng]) => ({ lat, lng })),
        stops: getTripStopSequence(p.tripIdx).flatMap(({ stopId }) => {
          const s = byId.get(stopId);
          return s ? [{ lat: s.lat, lng: s.lng }] : [];
        }),
        thin: true,
      }));
  }, [station, fallbackColor]);
}
