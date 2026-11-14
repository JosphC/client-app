import { render } from '@testing-library/react-native';
import { CircleLayer, LineLayer, ShapeSource } from '@maplibre/maplibre-react-native';
import type { FeatureCollection } from 'geojson';
import type { MapRouteSegment } from '../../../../src/features/map/components/map/LiveMap';
import { StationLines } from '../../../../src/features/map/components/map/lines/StationLines';

const coordinates = [
  { lat: 45.75, lng: 21.22 },
  { lat: 45.76, lng: 21.23 },
];

/** Aceeași ordine ca `useStationLines`: din spate în față (15 jos, E2 deasupra). */
const segments: MapRouteSegment[] = ['15', 'M3', 'M24', 'E2'].map((line) => ({
  id: `stationline-${line}`,
  kind: 'transit',
  line,
  color: '#000000',
  coordinates,
  stops: [coordinates[0]],
  thin: true,
}));

describe('StationLines (traseele unei stații)', () => {
  it('nu desenează nimic fără segmente', () => {
    const view = render(<StationLines segments={[]} />);
    expect(view.toJSON()).toBeNull();
  });

  it('o singură sursă și un singur strat de linii, cu ordinea fixată prin lineSortKey', () => {
    const view = render(<StationLines segments={segments} />);
    expect(view.UNSAFE_getAllByType(ShapeSource)).toHaveLength(1);
    expect(view.UNSAFE_getAllByType(LineLayer)).toHaveLength(1);
    expect(view.UNSAFE_getAllByType(CircleLayer)).toHaveLength(1);

    const style = view.UNSAFE_getByType(LineLayer).props.style as Record<string, unknown>;
    expect(style.lineSortKey).toEqual(['get', 'z']);
    expect(style.lineColor).toEqual(['get', 'color']);
  });

  it('fiecare linie are z crescător (ultima, E2, deasupra) și culoarea oficială a liniei', () => {
    const view = render(<StationLines segments={segments} />);
    const shape = view.UNSAFE_getByType(ShapeSource).props.shape as FeatureCollection;
    const lines = shape.features.filter((f) => f.geometry.type === 'LineString');

    expect(lines.map((f) => f.properties?.z)).toEqual([0, 1, 2, 3]);
    expect(lines.map((f) => f.properties?.color)).toEqual(['#6F2095', '#0148A2', '#0148A2', '#F58134']);
    // Punctele opririlor poartă aceeași culoare și aceeași ordine ca linia lor.
    const dots = shape.features.filter((f) => f.geometry.type === 'Point');
    expect(dots.map((f) => f.properties?.z)).toEqual([0, 1, 2, 3]);
  });
});
