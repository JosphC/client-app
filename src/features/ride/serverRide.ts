import { t } from '../../core/i18n';
import { formatTransitTime } from '../../core/utils/timezone';
import type { Ride } from '../../services/api/schemas/ride';
import { findRoute } from '../../services/repositories/gtfs/timetable';
import { useRideStore, type DetectedVehicle } from './rideStore';

declare const atob: (data: string) => string;

const TICKET_TTL_MS = 60 * 60 * 1000;

/** Sesiuni respinse local (ex. cont necesar): nu mai deschidem promptul pentru ele cât serverul le ține deschise. */
const dismissed = new Set<string>();
export const markSessionDismissed = (sessionId: string): void => void dismissed.add(sessionId);

function modeLabel(line: string): string {
  const mode = findRoute(line)?.mode;
  if (mode === 'tram') return t('common.modeTram');
  if (mode === 'trolley') return t('common.modeTrolley');
  return t('common.modeBus');
}

export function toDetectedVehicle(line: string, busId: number, destination = ''): DetectedVehicle {
  return { line, vehicleId: String(busId), vehicleType: modeLabel(line), station: '', destination };
}

/** `pax` și `exp` din payload-ul JWT al biletului (fără verificare: o face inspectorul / serverul). */
export function ticketClaims(qrToken: string): { pax: number | null; expMs: number | null } {
  try {
    const part = qrToken.split('.')[1] ?? '';
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4))) as { pax?: unknown; exp?: unknown };
    return {
      pax: typeof claims.pax === 'number' ? claims.pax : null,
      expMs: typeof claims.exp === 'number' ? claims.exp * 1000 : null,
    };
  } catch {
    return { pax: null, expMs: null };
  }
}

/** Cursa plătită: bilet + cursă activă din charge-ul serverului (idempotent: același charge nu se aplică de două ori). */
export function applyConfirmed(ride: Ride, passengersHint?: number): void {
  const { charge } = ride;
  if (!charge) return;
  const store = useRideStore.getState();
  if (store.activeRide?.chargeId === charge.id && store.activeRide.qrToken === charge.qrToken) return;
  const claims = ticketClaims(charge.qrToken);
  const passengers = passengersHint ?? claims.pax ?? 1;
  const startedAtMs = Date.parse(charge.startedAt);
  const expiresAtMs = claims.expMs ?? startedAtMs + TICKET_TTL_MS;
  const line = ride.vehicle?.line ?? charge.line;
  const destination = ride.vehicle?.destination ?? charge.destination ?? '';
  const startedAt = formatTransitTime(startedAtMs);
  store.setActiveRide({
    line, vehicleId: String(ride.vehicle?.busId ?? ''), passengers, amount: charge.amount, station: '', destination,
    startedAt, chargeId: charge.id, qrToken: charge.qrToken, expiresAtMs,
  });
  store.startTicket({
    ticketId: `tkt-${charge.id}`, originalLine: line, currentLine: line, passengers, startedAtMs, expiresAtMs,
    chargeId: charge.id, qrToken: charge.qrToken, isTransfer: false, transfersCount: 0, destination,
  });
  store.setServerRide(null);
}

/** Aduce starea aplicației în acord cu ce spune serverul (apelat la fiecare răspuns de la `/rides/current`). */
export function syncRide(ride: Ride): void {
  const store = useRideStore.getState();
  switch (ride.status) {
    case 'awaiting_confirmation':
    case 'payment_failed': {
      if (!ride.sessionId || dismissed.has(ride.sessionId)) return;
      const first = ride.vehicle ?? ride.candidates[0];
      if (!first) return;
      if (store.serverRide?.sessionId !== ride.sessionId) {
        store.setServerRide({ sessionId: ride.sessionId, candidates: ride.candidates, busId: ride.vehicle?.busId ?? null });
        store.detectVehicle(toDetectedVehicle(first.line, first.busId, ride.vehicle?.destination));
      }
      if (ride.status === 'payment_failed') store.setToastMessage(t('ride.paymentFailed'));
      return;
    }
    case 'confirmed':
      applyConfirmed(ride);
      return;
    case 'ended':
      if (store.activeRide) store.clearRide();
      return;
    default:
      // none / pending / rejected: dacă promptul mai e deschis pentru o sesiune care nu mai există, îl închidem.
      if (store.serverRide) store.dismissDetection();
  }
}

/** Utilizatorul alege autobuzul când serverul a auzit două. */
export function chooseCandidate(busId: number): void {
  const store = useRideStore.getState();
  const pick = store.serverRide?.candidates.find((c) => c.busId === busId);
  if (!store.serverRide || !pick) return;
  store.setServerRide({ ...store.serverRide, busId });
  store.detectVehicle(toDetectedVehicle(pick.line, pick.busId));
  store.setPassengerCount(store.passengerCount);
}
