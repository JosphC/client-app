// Scannerul acceptă DOAR beaconuri cu UUID-ul EchoPass (d22b117c-2f6e-4d74-9e9f-6f09213c3dd0).
import { BEACON_UUID, parseScanRecord } from '../../../src/features/detection/ble/beacon';
import { bleStats, useBleLog } from '../../../src/features/detection/ble/log';
import { createNativeScanner } from '../../../src/features/detection/ble/scanner';
import type { BlePoll } from '../../../src/features/detection/types';

type ScanCb = (error: Error | null, device: Record<string, unknown> | null) => void;
let mockScanCb: ScanCb | null = null;

jest.mock(
  'react-native-ble-plx',
  () => ({
    BleManager: jest.fn().mockImplementation(() => ({
      startDeviceScan: (_u: unknown, _o: unknown, cb: ScanCb) => {
        mockScanCb = cb;
        return Promise.resolve();
      },
      stopDeviceScan: jest.fn(async () => undefined),
      destroy: jest.fn(async () => undefined),
    })),
  }),
  { virtual: true },
);

const UUID = BEACON_UUID.replace(/-/g, '').match(/../g)!.map((h) => parseInt(h, 16));
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
function b64(bytes: number[]): string {
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < bytes.length ? B64[n & 63] : '=');
  }
  return out;
}
const advert = (uuid: number[], minor: number) => [26, 0xff, 0x4c, 0x00, 0x02, 0x15, ...uuid, 0, 7, minor >> 8, minor & 255, 0xc5];
const proof = [25, 0xff, 0xff, 0xff, 0x02, 1, 0, 0, 0, 9, ...Array.from({ length: 16 }, (_, i) => i)];
const dev = (id: string, raw: number[], name: string | null = null) => ({ id, rssi: -70, rawScanRecord: b64(raw), localName: name, name });

describe('octeții exacți emiși de firmware-ul ESP32 (Beacon.cpp / BeaconFrame.cpp)', () => {
  // advert: flags (02 01 06) + manufacturer data iBeacon (len 26: 4C 00 | 02 15 | UUID | major BE | minor BE | tx)
  const espAdvert = [2, 0x01, 0x06, 26, 0xff, 0x4c, 0x00, 0x02, 0x15, ...UUID, 0x00, 0x07, 0x00, 0x65, 0xc5];
  // scan response: manufacturer data (len 25: FF FF | ver 02 | flags 01 | slot BE | token 16 B)
  const espProof = [25, 0xff, 0xff, 0xff, 0x02, 0x01, 0x03, 0x8c, 0xd7, 0x0b, ...Array.from({ length: 16 }, (_, i) => 0xa0 + i)];

  it('citește iBeacon-ul (route 7, bus 101) și tokenul din scan response, fără umplere', () => {
    const r = parseScanRecord(Uint8Array.from([...espAdvert, ...espProof]));
    expect(r.advert).toEqual({ routeId: 7, busId: 101 });
    expect(r.proof).toMatchObject({ clockSynced: true, token: 'a0a1a2a3a4a5a6a7a8a9aaabacadaeaf' });
  });

  it('citește tokenul și când Android umple advertul la 31 de octeți (un 0) înaintea scan response-ului', () => {
    const r = parseScanRecord(Uint8Array.from([...espAdvert, 0, ...espProof, 0, 0, 0]));
    expect(r.advert?.busId).toBe(101);
    expect(r.proof?.token).toBe('a0a1a2a3a4a5a6a7a8a9aaabacadaeaf');
  });
});

describe('filtru UUID în scanner', () => {
  beforeEach(() => {
    mockScanCb = null;
    useBleLog.getState().clear();
  });

  it('ignoră un dispozitiv numit EP-… dacă nu are UUID-ul EchoPass', async () => {
    const samples: BlePoll[] = [];
    await createNativeScanner().start((s) => samples.push(s));
    mockScanCb!(null, dev('AA', [2, 1, 6], 'EP-3114'));
    expect(samples).toHaveLength(0);
    expect(bleStats).toMatchObject({ heard: 1, ours: 0 });
  });

  it('ignoră iBeacon cu alt UUID și scan response de la o adresă necunoscută', async () => {
    const samples: BlePoll[] = [];
    await createNativeScanner().start((s) => samples.push(s));
    mockScanCb!(null, dev('BB', advert(UUID.map(() => 1), 101)));
    mockScanCb!(null, dev('CC', proof));
    expect(samples).toHaveLength(0);
    expect(bleStats.ours).toBe(0);
  });

  it('un iBeacon cu alt UUID nu e acceptat, dar apare în jurnal ca diagnostic cu UUID-ul lui', async () => {
    const samples: BlePoll[] = [];
    await createNativeScanner().start((s) => samples.push(s));
    mockScanCb!(null, dev('EE', advert(UUID.map((b) => b ^ 0xff), 55)));
    expect(samples).toHaveLength(0);
    const texts = useBleLog.getState().entries.map((e) => e.text ?? '');
    expect(texts.some((x) => x.includes('iBeacon IGNORAT') && x.includes('minor 55'))).toBe(true);
  });

  it('acceptă beaconul cu UUID-ul EchoPass și scan response-ul de la aceeași adresă', async () => {
    const samples: BlePoll[] = [];
    await createNativeScanner().start((s) => samples.push(s));
    mockScanCb!(null, dev('DD', advert(UUID, 101)));
    mockScanCb!(null, dev('DD', proof));
    expect(samples.map((s) => [s.deviceId, s.proof?.slot])).toEqual([['101', undefined], ['101', 9]]);
    expect(bleStats.ours).toBe(2);
  });
});
