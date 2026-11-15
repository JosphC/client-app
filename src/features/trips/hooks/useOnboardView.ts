import { env } from '../../../core/config/env';
import { t } from '../../../core/i18n';
import { formatTransitTime } from '../../../core/utils/timezone';
import type { RideProgress } from '../../../services/api/schemas/ride';
import { useRideStore, type ActiveRideState } from '../../ride';
import { getLineStops, timeStopsFrom, type LineStationStop } from '../data/lineStations';

export interface OnboardView {
  /** Toate stațiile traseului, în ordine. */
  stops: LineStationStop[];
  /** Index în `stops`; -1 când nu se știe. */
  boardedIndex: number;
  nextIndex: number;
  boardedName: string;
  /** `null` cât timp serverul nu are o poziție proaspătă a autobuzului. */
  nextName: string | null;
  /** „în 3 min”, „acum” sau „Se caută autobuzul…”. */
  nextEtaText: string;
  /** Mock: „Programat” lângă stația de urcare; real: nimic (ora vine din poziție, nu din orar). */
  boardedNote: string | null;
}

/** „acum” sub 30 s, altfel „în N min” (rotunjit în sus: un autobuz la 61 s nu e „în 1 min”). */
export function etaText(etaSec: number): string {
  if (etaSec <= 30) return t('live.now');
  return `${t('live.inPrefix')} ${Math.ceil(etaSec / 60)} ${t('common.min')}`;
}

/** Stațiile reale ale cursei, din `progress` (poziția ESP32 proiectată pe traseu, calculată de server). Pură. */
export function progressView(progress: RideProgress, fallbackBoarded: string, nowMs: number): OnboardView {
  const next = progress.nextStop;
  const nextIndex = next ? next.index : -1;
  const stops: LineStationStop[] = progress.stops.map((s, i) => ({
    id: `p-${i}`,
    name: s.name,
    durationMinFromPrev: 0,
    connections: [],
    // Doar stația următoare are o oră: când ajunge autobuzul acolo, după poziția lui de acum.
    scheduledTime: next && i === nextIndex ? formatTransitTime(nowMs + next.etaSec * 1000) : undefined,
  }));
  const boardedName = progress.boardedStop ?? fallbackBoarded;
  return {
    stops,
    boardedIndex: progress.boardedStop ? progress.stops.findIndex((s) => s.name === progress.boardedStop) : -1,
    nextIndex,
    boardedName,
    nextName: next?.name ?? null,
    nextEtaText: next ? etaText(next.etaSec) : t('ride.positionUnavailable'),
    boardedNote: null,
  };
}

/** Stațiile demonstrative (modul mock): urcare din `ride.station`, stația următoare = cea de după. */
function demoView(ride: ActiveRideState): OnboardView {
  const lineStops = getLineStops(ride.line);
  const rawIdx = lineStops.findIndex((s) => s.name.toLowerCase().includes(ride.station.toLowerCase().slice(0, 5)));
  const boardedIndex = rawIdx >= 0 ? rawIdx : 0;
  const stops = timeStopsFrom(lineStops, boardedIndex, ride.startedAt);
  const nextIndex = Math.min(stops.length - 1, boardedIndex + 1);
  return {
    stops,
    boardedIndex,
    nextIndex,
    boardedName: stops[boardedIndex]?.name ?? ride.station,
    nextName: stops[nextIndex]?.name ?? null,
    nextEtaText: t('ride.nextEta'),
    boardedNote: t('home.tripScheduled'),
  };
}

/** Ce arată cardul „La bord”: cu serverul real, progresul de la server; în mock, datele demonstrative. */
export function useOnboardView(ride: ActiveRideState | null | undefined): OnboardView | null {
  const progress = useRideStore((s) => s.rideProgress);
  if (!ride) return null;
  if (env.useMocks) return demoView(ride);
  if (progress) return progressView(progress, ride.station, Date.now());
  // Serverul n-a trimis încă progresul (prima interogare după plată): fără stații inventate.
  return {
    stops: [],
    boardedIndex: -1,
    nextIndex: -1,
    boardedName: ride.station,
    nextName: null,
    nextEtaText: t('ride.positionUnavailable'),
    boardedNote: null,
  };
}
