import { approachingAt, loadStations, searchStations, trolleybusesAt, type Station } from '../../../src/features/map';
import type { BusMarker } from '../../../src/features/map';

function marker(line: string, lat = 45.75, lng = 21.22, id = `${line}-1`): BusMarker {
  return {
    bus: { id, line, destination: 'X', crowd: 1, delayMin: 0, delayReason: null },
    position: { busId: id, lat, lng, nextStop: 'S', arrivesInMin: 0, updatedAt: '2026-10-04T09:00:00Z' },
  };
}

const station: Station = { id: '1', name: 'Catedrala', lat: 45.75, lng: 21.22, lines: ['11', '2'] };

describe('stations', () => {
  it('loads the validated GTFS asset', () => {
    const stations = loadStations();
    expect(stations.length).toBeGreaterThan(800);
    expect(stations.every((s) => s.lines.length > 0)).toBe(true);
  });

  it('searches by substring and caps results', () => {
    const stations = loadStations();
    const hits = searchStations(stations, 'catedrala');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits.every((s) => s.name.toLowerCase().includes('catedrala'))).toBe(true);
    expect(searchStations(stations, 'x')).toEqual([]);
  });

  it('matches without diacritics', () => {
    const stations = loadStations();
    const hits = searchStations(stations, 'marasti');
    expect(hits.some((s) => s.name.includes('Mărăști'))).toBe(true);
  });

  it('keeps only trolleybuses serving the station', () => {
    const markers = [marker('11'), marker('14'), marker('2'), marker('33')];
    const filtered = trolleybusesAt(markers, station);
    expect(filtered.map((m) => m.bus.line)).toEqual(['11']);
  });

  it('approachingAt: every mode on the station lines, nearest first (Google Maps style)', () => {
    // Autobuzul 2 (nu troleibuz) e acum inclus; 33 nu oprește aici; cel la stație vine primul.
    const far = marker('11', 45.76, 21.23, 'far');
    const atStop = marker('2', 45.75, 21.22, 'at-stop');
    const shown = approachingAt([far, marker('33'), atStop], station);
    expect(shown.map((m) => m.bus.id)).toEqual(['at-stop', 'far']);
  });

  it('approachingAt: no position or too far (over 90 min) is not shown', () => {
    const noPos: BusMarker = { ...marker('11', 45.75, 21.22, 'no-pos'), position: undefined };
    const veryFar = marker('2', 46.75, 22.22, 'very-far');
    expect(approachingAt([noPos, veryFar], station)).toEqual([]);
  });
});
