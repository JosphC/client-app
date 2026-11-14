import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import { t } from '../../../core/i18n';
import { ApiError } from '../../../services/api/http';
import { confirmRide, declineRide } from '../../../services/repositories/real/rideRepo';
import { NoPaymentSourceError, selectPaymentSource } from '../../wallet/paymentSource';
import { useWalletStore } from '../../wallet/walletStore';
import { useRideStore } from '../rideStore';
import { applyConfirmed, markSessionDismissed } from '../serverRide';

/** Plata și refuzul prin server (`confirm` / `decline`); înlocuiesc charge-ul local din modul mock. */
export function useServerBoarding() {
  const router = useRouter();
  const client = useQueryClient();

  const confirm = useCallback(
    async (passengers: number): Promise<void> => {
      const store = useRideStore.getState();
      const ride = store.serverRide;
      const vehicle = store.detectedVehicle;
      if (!ride || !vehicle) return;
      if (ride.candidates.length > 0 && ride.busId === null) {
        store.setToastMessage(t('ride.chooseBus'));
        return;
      }
      const { items, defaultSourceId } = useWalletStore.getState();
      const busId = ride.candidates.length > 0 ? (ride.busId ?? undefined) : undefined;
      const card = items.find((i) => i.kind === 'card' && i.id === defaultSourceId) ?? items.find((i) => i.kind === 'card');
      try {
        const source = selectPaymentSource(items, defaultSourceId, vehicle.line, Date.now(), { passengers }).paidWith;
        let result;
        try {
          result = await confirmRide(ride.sessionId, { passengers, sourceId: source, busId });
        } catch (e) {
          // Abonament neacceptat (ex. neverificat pe serverul real): serverul cere plata cu cardul.
          if (!(e instanceof ApiError) || e.code !== 'NO_PAYMENT_METHOD' || !card || card.id === source) throw e;
          result = await confirmRide(ride.sessionId, { passengers, sourceId: card.id, busId });
        }
        applyConfirmed(result, passengers);
        void client.invalidateQueries({ queryKey: ['wallet', 'charges'] });
        void client.invalidateQueries({ queryKey: ['ride', 'current'] });
      } catch (e) {
        if (e instanceof ApiError && e.code === 'ACCOUNT_REQUIRED') {
          markSessionDismissed(ride.sessionId);
          store.dismissDetection();
          store.setToastMessage(t('ride.accountRequired'));
          router.push('/auth');
        } else if (e instanceof ApiError && e.code === 'SESSION_EXPIRED') {
          store.dismissDetection();
          store.setToastMessage(t('ride.sessionExpired'));
        } else if (e instanceof NoPaymentSourceError || (e instanceof ApiError && e.code === 'NO_PAYMENT_METHOD')) {
          store.setToastMessage(t('ride.noPaymentMethod'));
        } else if (e instanceof ApiError && e.code === 'NETWORK') {
          store.setToastMessage(t('ride.networkError'));
        } else {
          store.setToastMessage(t('ride.paymentFailed'));
        }
      }
    },
    [client, router],
  );

  /** „Nu e cursa mea": serverul nu mai întreabă pentru același autobuz. */
  const decline = useCallback((): void => {
    const ride = useRideStore.getState().serverRide;
    useRideStore.getState().dismissDetection();
    if (!ride) return;
    markSessionDismissed(ride.sessionId);
    void declineRide(ride.sessionId)
      .catch(() => undefined)
      .then(() => client.invalidateQueries({ queryKey: ['ride', 'current'] }));
  }, [client]);

  /** Utilizatorul pleacă să adauge o metodă de plată: închidem promptul fără să respingem cursa la server. */
  const defer = useCallback((): void => {
    const ride = useRideStore.getState().serverRide;
    if (ride) markSessionDismissed(ride.sessionId);
    useRideStore.getState().dismissDetection();
  }, []);

  return { confirm, decline, defer };
}
