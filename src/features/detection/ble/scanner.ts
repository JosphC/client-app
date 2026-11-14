import { PermissionsAndroid, Platform } from 'react-native';
import { env } from '../../../core/config/env';
import type { BlePoll } from '../types';
import { base64ToBytes, describeOtherBeacon, parseScanRecord } from './beacon';
import { bleLog, bleStats } from './log';

/** One advertisement heard from an on-board transmitter; deviceId = vehicle id. */
export type BleSample = BlePoll;

export interface BleScanner {
  /** Starts listening; returns the stop function. Never throws. */
  start(onSample: (sample: BleSample) => void): Promise<() => void>;
}

/** Vehicle id from the advertised local name ("EP-3114" → "3114"), null for foreign devices. */
export function parseVehicleId(
  localName: string | null | undefined,
  prefix: string = env.bleNamePrefix
): string | null {
  if (!localName || !localName.startsWith(prefix)) return null;
  const id = localName.slice(prefix.length).trim();
  return id.length > 0 ? id : null;
}

async function grantAndroidScan(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const needed =
    Number(Platform.Version) >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          // Beacon advertisements need a location-capable scan (no neverForLocation).
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const result = await PermissionsAndroid.requestMultiple(needed);
  return needed.every((p) => result[p] === PermissionsAndroid.RESULTS.GRANTED);
}

type BlePlx = typeof import('react-native-ble-plx');

/** Native module is present only in a dev client / build that includes ble-plx. */
function loadBlePlx(): BlePlx | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('react-native-ble-plx') as BlePlx;
  } catch {
    return null;
  }
}

/** Real scanner (react-native-ble-plx). Missing module or denied permission → silent no-op. */
export function createNativeScanner(): BleScanner {
  return {
    async start(onSample) {
      const plx = loadBlePlx();
      if (!plx) {
        bleLog.info('Modulul BLE lipsește din această aplicație');
        return () => undefined;
      }
      if (!(await grantAndroidScan().catch(() => false))) {
        bleLog.info('Permisiuni Bluetooth / Locație refuzate: scanarea nu pornește');
        return () => undefined;
      }
      let manager: InstanceType<BlePlx['BleManager']>;
      try {
        manager = new plx.BleManager();
      } catch {
        bleLog.info('Nu pot porni managerul Bluetooth');
        return () => undefined;
      }
      const uuids = env.bleServiceUuid ? [env.bleServiceUuid] : null;
      // Android poate livra advertul și scan response-ul separat: ținem ultimul bus_id văzut per adresă.
      const busByAddress = new Map<string, number>();
      const begin = () => {
        bleLog.info('Scanare BLE pornită');
        bleStats.scanning = true;
        manager
          .startDeviceScan(uuids, { allowDuplicates: true }, (error, device) => {
            if (error) {
              bleStats.scanning = false;
              bleLog.info(`Eroare scanare: ${error.message}`);
              return;
            }
            if (!device || device.rssi == null) return;
            const raw = device.rawScanRecord ? base64ToBytes(device.rawScanRecord) : null;
            const beacon = raw ? parseScanRecord(raw) : null;
            if (beacon?.advert) busByAddress.set(device.id, beacon.advert.busId);
            const busId = beacon?.advert?.busId ?? busByAddress.get(device.id);
            const proof = beacon?.proof ?? undefined;
            // Doar beaconurile cu UUID-ul EchoPass (BEACON_UUID, verificat în parseScanRecord). Scan response-ul (token) vine
            // fără UUID, deci se acceptă doar de la o adresă văzută deja cu UUID-ul nostru; nu mai acceptăm după nume.
            const ours = busId !== undefined && Boolean(beacon?.advert || proof);
            bleLog.heard(ours);
            if (!ours && raw) {
              const other = describeOtherBeacon(raw);
              if (other?.kind === 'ibeacon') {
                bleLog.other(
                  device.id,
                  `iBeacon IGNORAT (alt UUID): ${other.uuid} major ${other.major} minor ${other.minor} · ${device.rssi} dBm`
                );
              } else if (other?.kind === 'proof') {
                bleLog.other(
                  device.id,
                  `Pachet 0xFFFF IGNORAT (adresă fără iBeacon cu UUID-ul nostru) · ${device.rssi} dBm`
                );
              }
            }
            if (ours) onSample({ deviceId: String(busId), rssi: device.rssi, atMs: Date.now(), proof });
          })
          .catch(() => undefined);
      };
      // Bluetooth oprit la pornire sau pornit mai târziu: scanarea începe (din nou) când ajunge PoweredOn.
      const stateSub = manager.onStateChange?.((state) => {
        bleLog.info(`Stare Bluetooth: ${state}`);
        if (state === 'PoweredOn') begin();
        else bleStats.scanning = false;
      }, true);
      if (!stateSub) begin();
      return () => {
        bleStats.scanning = false;
        stateSub?.remove();
        void manager.stopDeviceScan().catch(() => undefined);
        void manager.destroy().catch(() => undefined);
      };
    },
  };
}

const mockListeners = new Set<(sample: BleSample) => void>();

/** Mock mode: samples come from `emitMockBleSample` (simulator bar, tests). */
export function createMockScanner(): BleScanner {
  return {
    async start(onSample) {
      mockListeners.add(onSample);
      bleStats.scanning = true;
      return () => {
        bleStats.scanning = false;
        mockListeners.delete(onSample);
      };
    },
  };
}

export function emitMockBleSample(sample: BleSample): void {
  for (const listener of mockListeners) listener(sample);
}

export function createBleScanner(): BleScanner {
  return env.useMockBle ? createMockScanner() : createNativeScanner();
}
