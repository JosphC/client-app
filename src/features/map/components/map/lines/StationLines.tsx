import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import { CircleLayer, LineLayer, ShapeSource } from '@maplibre/maplibre-react-native';
import { findRoute } from '../../../../../services/repositories/gtfs/timetable';
import type { MapRouteSegment } from '../LiveMap';

/** Below this zoom intermediate stops would merge into a white stripe. */
const STOP_DOTS_MIN_ZOOM = 13;

interface StationLinesProps {
  /** Din spate în față: primul segment se desenează primul, ultimul stă deasupra. */
  segments: MapRouteSegment[];
}

/**
 * Traseele care trec printr-o stație, într-o singură sursă și un singur strat.
 * Ordinea „cine e deasupra" vine din `lineSortKey` (valoare mai mare = mai sus), nu din
 * momentul în care se încarcă fiecare sursă: cu un strat pe linie, liniile M (albastre,
 * multe și suprapuse) ajungeau uneori deasupra liniilor 15 / E2 și le acopereau.
 */
export function StationLines({ segments }: StationLinesProps) {
  if (segments.length === 0) return null;

  const features: Array<Feature<LineString | Point>> = [];
  segments.forEach((seg, z) => {
    // Culoarea oficială a liniei (galben tramvai, albastru troleibuz…), ca insigna din listă.
    const color = (seg.line ? findRoute(seg.line)?.color : null) ?? seg.color;
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: seg.coordinates.map((p) => [p.lng, p.lat]) },
      properties: { color, z },
    });
    (seg.stops ?? []).forEach((p) => {
      features.push({ type: 'Feature', geometry: { type: 'Point', coordinates: [p.lng, p.lat] }, properties: { color, z } });
    });
  });
  const shape: FeatureCollection<LineString | Point> = { type: 'FeatureCollection', features };

  return (
    <ShapeSource id="station-lines" shape={shape}>
      <LineLayer
        id="station-lines-core"
        belowLayerID="station-icons"
        filter={['==', ['geometry-type'], 'LineString']}
        style={{ lineColor: ['get', 'color'], lineSortKey: ['get', 'z'], lineWidth: 4, lineCap: 'round', lineJoin: 'round' }}
      />
      <CircleLayer
        id="station-lines-stops"
        belowLayerID="station-icons"
        minZoomLevel={STOP_DOTS_MIN_ZOOM}
        filter={['==', ['geometry-type'], 'Point']}
        style={{
          circleColor: '#FFFFFF',
          circleRadius: 3.5,
          circleStrokeColor: ['get', 'color'],
          circleStrokeWidth: 1.5,
          circleSortKey: ['get', 'z'],
        }}
      />
    </ShapeSource>
  );
}
