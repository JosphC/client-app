import { useEffect, useState } from 'react';
import { SINGLE_FARE_RON } from '../../../core/config';
import { formatTransitTime } from '../../../core/utils/timezone';
import { useRideStore } from '../../ride';

/**
 * The ticket shown in the Wallet: the live ride, or the 60-minute ticket that
 * stays valid after getting off. Re-evaluated every 5 s; expired ones are cleared.
 */
export function useCurrentTicket() {
  const liveRide = useRideStore((s) => s.activeRide);
  const activeTicket = useRideStore((s) => s.activeTicket);
  const clearRide = useRideStore((s) => s.clearRide);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const isRideValid = Boolean(liveRide && (!liveRide.expiresAtMs || liveRide.expiresAtMs > now));
  const isTicketValid = Boolean(activeTicket && activeTicket.expiresAtMs > now);

  useEffect(() => {
    const rideExpired = Boolean(liveRide && liveRide.expiresAtMs && liveRide.expiresAtMs <= now);
    const ticketExpired = Boolean(activeTicket && activeTicket.expiresAtMs <= now);
    if (rideExpired || ticketExpired) {
      clearRide(now);
    }
  }, [liveRide, activeTicket, now, clearRide]);

  const validRide = isRideValid ? liveRide : null;
  const currentTicket = validRide ?? (isTicketValid && activeTicket ? {
    line: activeTicket.currentLine,
    destination: activeTicket.destination ?? 'Toate liniile STPT · Bilet 60 min',
    station: activeTicket.station ?? 'Validat în sistem',
    startedAt: formatTransitTime(activeTicket.startedAtMs),
    amount: activeTicket.isTransfer ? 0 : SINGLE_FARE_RON * activeTicket.passengers,
    passengers: activeTicket.passengers,
    expiresAtMs: activeTicket.expiresAtMs,
    isTransfer: activeTicket.isTransfer,
    originalLine: activeTicket.originalLine,
    chargeId: activeTicket.chargeId,
    qrToken: activeTicket.qrToken,
    transferStation: activeTicket.transferStation,
    transferAt: activeTicket.transferAt,
  } : null);

  const remainingMin = currentTicket?.expiresAtMs
    ? Math.max(0, Math.ceil((currentTicket.expiresAtMs - now) / 60000))
    : 42;

  return { currentTicket, remainingMin };
}
