import { useQueryClient } from '@tanstack/react-query';
import { env } from '../../../core/config/env';
import { t } from '../../../core/i18n';
import type { BusPosition } from '../../../services/api/schemas/bus';
import { findRoute } from '../../../services/repositories/gtfs/timetable';
import { useBusPresence } from '../../detection';
import { useBuses } from '../../map';
import type { DetectedVehicle } from '../rideStore';
import { useRideStore } from '../rideStore';
import { useRideDetector } from '../hooks/useRideDetector';

function modeLabel(line: string): string {
  const mode = findRoute(line)?.mode;
  if (mode === 'tram') return t('common.modeTram');
  if (mode === 'trolley') return t('common.modeTrolley');
  return t('common.modeBus');
}

type FleetBus = Pick<ReturnType<typeof useBuses>['buses'][number], 'line' | 'destination'>;

/** Doar în mock: beaconul unui ESP32 de test (id necunoscut flotei) apare ca o cursă de test. */
const TEST_BEACON_BUS: FleetBus = { line: '15', destination: 'Test ESP32' };

/** Autobuzul din flotă pentru id-ul anunțat; în mock, un id necunoscut cade pe cursa de test. */
export function resolveDetectedBus<T extends FleetBus & { id: string }>(
  fleet: T[],
  vehicleId: string,
  allowTestBeacon: boolean = env.useMocks,
): FleetBus | null {
  return fleet.find((b) => b.id === vehicleId) ?? (allowTestBeacon ? TEST_BEACON_BUS : null);
}

/**
 * Automatic BLE check-in / check-out. Renders nothing; mount once at the
 * root. Boarding resolves the advertised vehicle id against the live fleet
 * (the server still cross-checks with GPS before charging); alighting from
 * the vehicle of the active ride closes it.
 */
export function BleAutoCheckIn() {
  const client = useQueryClient();
  const { buses } = useBuses();
  const { handleDetected, clearRide } = useRideDetector();

  useBusPresence(true, {
    onEnter: (vehicleId) => {
      // Cu serverul real, serverul decide (sighting-uri + GPS); promptul vine din `useServerRide`.
      if (!env.useMocks) return;
      const state = useRideStore.getState();
      if (state.status !== 'idle' && state.activeRide?.vehicleId === vehicleId) return;
      const bus = resolveDetectedBus(buses, vehicleId);
      if (!bus) return;
      const position = client.getQueryData<BusPosition[]>(['positions'])?.find((p) => p.busId === vehicleId);
      const vehicle: DetectedVehicle = {
        line: bus.line,
        vehicleId,
        vehicleType: modeLabel(bus.line),
        station: position?.nextStop ?? '',
        destination: bus.destination,
      };
      void handleDetected(vehicle);
    },
    onLeave: (vehicleId) => {
      if (!env.useMocks) return;
      if (useRideStore.getState().activeRide?.vehicleId === vehicleId) clearRide();
    },
  });

  return null;
}
