declare const btoa: (data: string) => string;
import { useRideStore } from '../../../src/features/ride/rideStore';
import { applyConfirmed, chooseCandidate, syncRide, ticketClaims } from '../../../src/features/ride/serverRide';
import type { Ride } from '../../../src/services/api/schemas/ride';

const b64 = (o: object) => btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const QR = `${b64({ alg: 'EdDSA' })}.${b64({ cid: 'c1', line: 'E2', pax: 2, exp: 1_900_000_000 })}.sig`;

const base: Ride = { status: 'none', sessionId: null, updatedAt: '2026-11-14T10:00:00Z', pollAfterMs: null, vehicle: null, candidates: [], payment: null, charge: null, progress: null };
const awaiting = (over: Partial<Ride> = {}): Ride => ({
  ...base, status: 'awaiting_confirmation', sessionId: 's1', pollAfterMs: 3000, vehicle: { busId: 101, line: 'E2', destination: 'Elbromplast' }, ...over,
});
const confirmed: Ride = {
  ...awaiting({ status: 'confirmed', pollAfterMs: 15000 }),
  charge: { id: 'c1', line: 'E2', destination: 'Elbromplast', amount: 10, currency: 'RON', status: 'in_progress', paidWith: 'card1', startedAt: '2026-11-14T09:14:54Z', qrToken: QR },
};

beforeEach(() => useRideStore.getState().resetAll());

describe('sincronizarea cursei cu serverul', () => {
  it('awaiting_confirmation deschide promptul cu autobuzul serverului', () => {
    syncRide(awaiting());
    const s = useRideStore.getState();
    expect(s.status).toBe('detected');
    expect(s.detectedVehicle).toMatchObject({ line: 'E2', vehicleId: '101', destination: 'Elbromplast' });
    expect(s.serverRide).toMatchObject({ sessionId: 's1', busId: 101 });
  });

  it('nu redeschide promptul la fiecare poll pentru aceeași sesiune', () => {
    syncRide(awaiting());
    useRideStore.getState().setPassengerCount(3);
    syncRide(awaiting());
    expect(useRideStore.getState().passengerCount).toBe(3);
  });

  it('două autobuze: alegerea păstrează numărul de persoane', () => {
    syncRide(awaiting({ vehicle: null, candidates: [{ busId: 101, line: 'E2' }, { busId: 202, line: '33' }] }));
    useRideStore.getState().setPassengerCount(2);
    expect(useRideStore.getState().serverRide?.busId).toBeNull();
    chooseCandidate(202);
    const s = useRideStore.getState();
    expect(s.serverRide?.busId).toBe(202);
    expect(s.detectedVehicle?.line).toBe('33');
    expect(s.passengerCount).toBe(2);
  });

  it('confirmed creează cursa și biletul cu qrToken, pasageri și expirare din JWT, o singură dată', () => {
    syncRide(awaiting());
    syncRide(confirmed);
    const s = useRideStore.getState();
    expect(s.status).toBe('active');
    expect(s.activeRide).toMatchObject({ chargeId: 'c1', qrToken: QR, passengers: 2, amount: 10 });
    expect(s.activeTicket).toMatchObject({ qrToken: QR, expiresAtMs: 1_900_000_000_000 });
    expect(s.serverRide).toBeNull();
    const ride = s.activeRide;
    applyConfirmed(confirmed);
    expect(useRideStore.getState().activeRide).toBe(ride);
  });

  it('ended închide cursa, iar rejected închide promptul rămas deschis', () => {
    syncRide(confirmed);
    syncRide({ ...confirmed, status: 'ended', pollAfterMs: null });
    expect(useRideStore.getState().activeRide).toBeNull();
    syncRide(awaiting({ sessionId: 's2' }));
    syncRide({ ...base, status: 'rejected' });
    expect(useRideStore.getState().status).toBe('idle');
  });

  it('un JWT stricat nu strică nimic', () => {
    expect(ticketClaims('nu-e-jwt')).toEqual({ pax: null, expMs: null });
  });
});
