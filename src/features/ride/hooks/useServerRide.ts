import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { env } from '../../../core/config/env';
import { getCurrentRide } from '../../../services/repositories/real/rideRepo';
import { syncRide } from '../serverRide';

/** Când serverul spune „nu mai întreba" (`pollAfterMs: null`) tot verificăm rar: o cursă nouă apare fără alt semnal. */
const IDLE_POLL_MS = 10_000;

/**
 * Doar cu serverul real: serverul decide când ești într-un autobuz. Citim `GET /rides/current` după
 * `pollAfterMs` și aducem promptul de plată / biletul în acord cu răspunsul. Nu face nimic în mock.
 */
export function useServerRide(): void {
  const ride = useQuery({
    queryKey: ['ride', 'current'],
    queryFn: getCurrentRide,
    enabled: !env.useMocks,
    refetchInterval: (query) => query.state.data?.pollAfterMs ?? IDLE_POLL_MS,
    refetchIntervalInBackground: false,
    retry: false,
  });
  useEffect(() => {
    if (ride.data) syncRide(ride.data);
  }, [ride.data]);
}
