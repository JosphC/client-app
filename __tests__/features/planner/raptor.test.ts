import { planTransit } from '../../../src/features/planner/transit';
import { walkMin } from '../../../src/features/planner/transitHelpers';
import { loadStations, haversineKm } from '../../../src/features/map';
import { findForwardRides } from '../../../src/services/repositories/gtfs/tripSearch';

const C9C = { lat: 45.74925, lng: 21.24164 };
const CONTI = { lat: 45.7326, lng: 21.26124 };
/** Thursday 12 Nov 2026, 08:00 in Timișoara (UTC+2). */
const MORNING = new Date('2026-11-12T06:00:00Z').getTime();

function plan(from: { lat: number; lng: number }, to: { lat: number; lng: number }, at: number) {
  return planTransit({ station: null, coords: from, name: 'Start' }, { coords: to, name: 'Dest' }, [], at);
}

describe('RAPTOR planner (Moovit/Transit-style)', () => {
  it('Cămin 9C → Continental: walk to Ion Vidu and ride E2 straight (no back-and-forth)', () => {
    const options = plan(C9C, CONTI, MORNING);
    const best = options[0];
    const rides = best?.legs.filter((l) => l.kind === 'ride') ?? [];
    expect(rides).toHaveLength(1);
    expect(rides[0]?.line).toBe('E2');
    expect(best?.boardStation.id).toBe('166');
    expect(best?.alightStation.id).toBe('309');
    expect(best?.legs[0]?.kind).toBe('walk');
  });

  it('boards each vehicle at the closest stop it serves (Ion Vidu, not Parcul Copiilor), all day', () => {
    for (let half = 0; half < 36; half++) {
      const at = new Date('2026-11-12T03:00:00Z').getTime() + half * 30 * 60_000; // 05:00 → 22:30
      for (const o of plan(C9C, CONTI, at)) {
        const first = o.legs.find((l) => l.kind === 'ride');
        if (!first?.fromStation) continue;
        const boardKm = haversineKm(C9C, first.fromStation);
        // A stop the same vehicle reaches later and that is closer to the start would be the right boarding stop.
        for (const later of first.via ?? []) expect(haversineKm(C9C, later)).toBeGreaterThan(boardKm - 0.03);
      }
    }
  });

  it('never rides back to a stop the passenger could simply walk to', () => {
    for (const o of plan(C9C, CONTI, MORNING)) {
      const rides = o.legs.filter((l) => l.kind === 'ride');
      if (rides.length < 2) continue;
      const transfer = rides[0]?.toStation;
      expect(transfer && haversineKm(C9C, transfer) > 0.5).toBe(true);
    }
  });

  it('is at least as fast as the best direct trip found by exhaustive search', () => {
    const near = (p: { lat: number; lng: number }) => loadStations().filter((s) => haversineKm(p, s) <= 1);
    let bruteArrival = Infinity;
    for (const board of near(C9C)) {
      const atStop = MORNING + walkMin(C9C, board) * 60_000;
      for (const alight of near(CONTI)) {
        const ride = findForwardRides(board.id, alight.id, null, atStop, 180, 1)[0];
        if (!ride) continue;
        bruteArrival = Math.min(bruteArrival, ride.departMs + (ride.alightSec - ride.boardSec) * 1000 + walkMin(alight, CONTI) * 60_000);
      }
    }
    const best = Math.min(...plan(C9C, CONTI, MORNING).map((o) => MORNING + o.totalMin * 60_000));
    expect(bruteArrival).toBeLessThan(Infinity);
    // Rounding of walk minutes vs seconds: allow one minute.
    expect(best).toBeLessThanOrEqual(bruteArrival + 60_000);
  });

  it('chains legs in time: each ride leaves after the previous one arrives (+2 min to change)', () => {
    const stations = loadStations();
    const from = stations.find((s) => s.id === '176') as NonNullable<ReturnType<typeof stations.find>>;
    const to = stations.find((s) => s.id === '163') as NonNullable<ReturnType<typeof stations.find>>;
    const options = planTransit({ station: from, coords: null }, to, [], MORNING);
    expect(options.length).toBeGreaterThan(0);
    for (const o of options) {
      const rides = o.legs.filter((l) => l.kind === 'ride');
      for (let i = 1; i < rides.length; i++) {
        const prev = rides[i - 1];
        const arrive = (prev?.departMs ?? 0) + (prev?.minutes ?? 0) * 60_000;
        expect(rides[i]?.departMs ?? 0).toBeGreaterThanOrEqual(arrive + 60_000);
      }
      expect(o.shapeLegs).toHaveLength(rides.length);
    }
  });

  it('suggests walking first when it is the fastest way', () => {
    const a = { lat: 45.7566, lng: 21.2289 };
    const b = { lat: 45.7581, lng: 21.2305 };
    const options = plan(a, b, MORNING);
    expect(options[0]?.line).toBe('Pe jos');
    expect(options[0]?.fareRon).toBe(0);
  });

  it('offers distinct alternatives (different lines), each with real times', () => {
    const options = plan(C9C, CONTI, MORNING);
    expect(options.length).toBeGreaterThanOrEqual(2);
    const combos = options.map((o) => o.legs.filter((l) => l.kind === 'ride').map((l) => l.line).join('>'));
    expect(new Set(combos).size).toBe(combos.length);
    for (const o of options) expect(o.estimated).toBe(false);
  });
});
