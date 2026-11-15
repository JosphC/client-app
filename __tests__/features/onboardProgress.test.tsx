import { act, fireEvent, render } from '@testing-library/react-native';
import { useRideStore } from '../../src/features/ride/rideStore';
import { applyConfirmed } from '../../src/features/ride/serverRide';
import { LiveOnboardCard } from '../../src/features/trips/components/onboard/LiveOnboardCard';
import { etaText, progressView } from '../../src/features/trips/hooks/useOnboardView';
import { rideSchema, type RideProgress } from '../../src/services/api/schemas/ride';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../../src/core/config/env', () => ({
  env: {
    useMocks: false, useRealBus: false, useMockBle: false, apiBaseUrl: 'http://x', bleServiceUuid: null, bleNamePrefix: 'EP-',
    authToken: null, testUserId: null, sightingsUrl: null, useTestPayments: true, testIdToken: null,
  },
}));

// Exact cum îl trimite serverul (progress.rs): stația următoare e a treia, la 320 m / 55 s.
const progress: RideProgress = {
  position: { lat: 45.75, lng: 21.23, speedKmh: 22.5, at: '2026-11-14T20:40:12Z', simulated: true },
  boardedStop: 'Piața Badea Cârțan',
  nextStop: { index: 2, name: 'Piața Mărăști', distanceM: 320, etaSec: 55 },
  stops: [
    { name: 'Dedeman', lat: 45.74, lng: 21.24, passed: true },
    { name: 'Piața Badea Cârțan', lat: 45.75, lng: 21.23, passed: true },
    { name: 'Piața Mărăști', lat: 45.756, lng: 21.229, passed: false },
    { name: 'Parcul Copiilor', lat: 45.76, lng: 21.22, passed: false },
  ],
};

const confirmedRide = (p: RideProgress | null) =>
  rideSchema.parse({
    status: 'confirmed', sessionId: 's1', updatedAt: '2026-11-14T20:40:12Z', pollAfterMs: 5000,
    vehicle: { busId: 101, line: 'E2', destination: 'Elbromplast' }, candidates: [], payment: null,
    charge: {
      id: 'c1', line: 'E2', amount: 5, currency: 'RON', status: 'in_progress', paidWith: 'card-1',
      startedAt: '2026-11-14T20:38:00Z', qrToken: 'a.b.c',
    },
    progress: p,
  });

describe('progresul cursei de la server', () => {
  beforeEach(() => useRideStore.getState().resetAll());

  it('eta: „acum” sub 30 s, altfel minute rotunjite în sus', () => {
    expect(etaText(20)).toBe('acum');
    expect(etaText(55)).toBe('în 1 min');
    expect(etaText(61)).toBe('în 2 min');
  });

  it('progressView: stațiile reale, urcarea și stația următoare cu ora sosirii', () => {
    const view = progressView(progress, '', Date.UTC(2026, 10, 14, 20, 40, 0));
    expect(view.stops.map((s) => s.name)).toEqual(['Dedeman', 'Piața Badea Cârțan', 'Piața Mărăști', 'Parcul Copiilor']);
    expect(view.boardedIndex).toBe(1);
    expect(view.nextIndex).toBe(2);
    expect(view.nextName).toBe('Piața Mărăști');
    expect(view.nextEtaText).toBe('în 1 min');
    expect(view.stops[2]?.scheduledTime).toMatch(/^\d{2}:\d{2}$/);
    expect(view.stops[3]?.scheduledTime).toBeUndefined();
  });

  it('fără poziție proaspătă: fără stație următoare, „Se caută autobuzul…”', () => {
    const view = progressView({ ...progress, position: null, nextStop: null }, '', Date.now());
    expect(view.nextName).toBeNull();
    expect(view.nextEtaText).toBe('Se caută autobuzul…');
  });

  it('cardul arată stațiile E2 de la server și se actualizează la fiecare răspuns', () => {
    applyConfirmed(confirmedRide(progress));
    const ride = useRideStore.getState().activeRide;
    const screen = render(<LiveOnboardCard ride={ride} />);
    expect(screen.getByText('Piața Mărăști')).toBeTruthy();
    expect(screen.getByText('în 1 min')).toBeTruthy();
    expect(screen.getByText(/Piața Badea Cârțan/)).toBeTruthy();

    fireEvent.press(screen.getByTestId('live-onboard-header'));
    expect(screen.getByText('Parcul Copiilor')).toBeTruthy();

    // Autobuzul a trecut de Piața Mărăști: următorul răspuns (5 s) mută stația următoare.
    const moved: RideProgress = {
      ...progress,
      nextStop: { index: 3, name: 'Parcul Copiilor', distanceM: 90, etaSec: 15 },
      stops: progress.stops.map((s, i) => ({ ...s, passed: i <= 2 })),
    };
    act(() => applyConfirmed(confirmedRide(moved)));
    expect(screen.getAllByText('Parcul Copiilor').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/acum/).length).toBeGreaterThan(0);
  });

  it('fără progres încă: nicio stație inventată', () => {
    applyConfirmed(confirmedRide(null));
    const ride = useRideStore.getState().activeRide;
    const screen = render(<LiveOnboardCard ride={ride} />);
    expect(screen.queryByText('Piața Regina Maria')).toBeNull();
    expect(screen.getByText('—')).toBeTruthy();
  });
});
