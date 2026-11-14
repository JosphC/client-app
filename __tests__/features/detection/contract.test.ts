// Contractul docs/phone.md fără hardware: parser, corp POST, politică de trimitere, scanner nativ (ble-plx simulat).
import { BEACON_UUID, base64ToBytes, parseScanRecord } from '../../../src/features/detection/ble/beacon';
import { createNativeScanner } from '../../../src/features/detection/ble/scanner';
import { createSightingSender, toSighting } from '../../../src/features/detection/ble/sightings';
import type { Sighting } from '../../../src/services/api/schemas/sighting';
import type { BlePoll } from '../../../src/features/detection/types';

type ScanCb = (error: Error | null, device: Record<string, unknown> | null) => void;
let mockScanCb: ScanCb | null = null;
const mockStop = jest.fn(async () => undefined);

jest.mock(
  'react-native-ble-plx',
  () => ({
    BleManager: jest.fn().mockImplementation(() => ({
      startDeviceScan: (_u: unknown, _o: unknown, cb: ScanCb) => {
        mockScanCb = cb;
        return Promise.resolve();
      },
      stopDeviceScan: mockStop,
      destroy: mockStop,
    })),
  }),
  { virtual: true },
);

const UUID = BEACON_UUID.replace(/-/g, '').match(/../g)!.map((h) => parseInt(h, 16));
const ADV = (major: number, minor: number) => [26, 0xff, 0x4c, 0x00, 0x02, 0x15, ...UUID, major >> 8, major & 255, minor >> 8, minor & 255, 0xc5];
const PROOF = (slot: number, token: number[], flags = 1) => [
  25, 0xff, 0xff, 0xff, 0x02, flags, (slot >>> 24) & 255, (slot >>> 16) & 255, (slot >>> 8) & 255, slot & 255, ...token,
];
const TOKEN = Array.from({ length: 16 }, (_, i) => i); // 00 01 02 … 0f → zerourile din față contează
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** base64 independent de parserul testat (fără Buffer/btoa, ca să meargă și în tsc fără tipuri node). */
function B64(...parts: number[][]): string {
  const b = parts.flat();
  let out = '';
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    out += ALPHA[(n >> 18) & 63] + ALPHA[(n >> 12) & 63];
    out += i + 1 < b.length ? ALPHA[(n >> 6) & 63] : '=';
    out += i + 2 < b.length ? ALPHA[n & 63] : '=';
  }
  return out;
}
const U8 = (...parts: number[][]) => Uint8Array.from(parts.flat());
const flush = () => new Promise<void>((r) => setImmediate(() => r()));

describe('parser vs docs/phone.md', () => {
  it('token = 32 caractere hex mici, cu zerouri în față (octeți < 0x10)', () => {
    const p = parseScanRecord(U8(PROOF(1, TOKEN))).proof!;
    expect(p.token).toBe('000102030405060708090a0b0c0d0e0f');
    expect(p.token).toMatch(/^[0-9a-f]{32}$/);
  });

  it('major/minor la limite: 0 și 65535', () => {
    expect(parseScanRecord(U8(ADV(0, 0))).advert).toEqual({ routeId: 0, busId: 0 });
    expect(parseScanRecord(U8(ADV(65535, 65535))).advert).toEqual({ routeId: 65535, busId: 65535 });
  });

  it('ordinea pachetelor nu contează, iar record-ul real din rawScanRecord (base64) se parsează la fel', () => {
    const raw = base64ToBytes(B64([2, 1, 6], PROOF(58734123, TOKEN), ADV(7, 101)));
    expect(parseScanRecord(raw)).toEqual({
      advert: { routeId: 7, busId: 101 },
      proof: { slot: 58734123, token: '000102030405060708090a0b0c0d0e0f', clockSynced: true },
    });
  });

  it('flags: bit 0 = ceas sincronizat; alți biți nu îl schimbă', () => {
    const synced = (flags: number) => parseScanRecord(U8(PROOF(1, TOKEN, flags))).proof?.clockSynced;
    expect([synced(0b0000), synced(0b0001), synced(0b1110), synced(0b1111)]).toEqual([false, true, false, true]);
  });

  it('slot: 32 biți big-endian fără semn (cap de scală)', () => {
    expect(parseScanRecord(U8(PROOF(0xffffffff, TOKEN))).proof?.slot).toBe(4294967295);
    expect(parseScanRecord(U8(PROOF(0x00000100, TOKEN))).proof?.slot).toBe(256);
  });

  it('respinge: proof de 21 octeți, advert fără prefix 02 15, alt company id', () => {
    const shortProof = PROOF(1, TOKEN.slice(0, 15)); // 21 octeți de payload
    shortProof[0] = 24;
    expect(parseScanRecord(U8(shortProof)).proof).toBeNull();
    const badPrefix = ADV(7, 101);
    badPrefix[5] = 0x16;
    expect(parseScanRecord(U8(badPrefix)).advert).toBeNull();
    const otherCompany = PROOF(1, TOKEN);
    otherCompany[2] = 0x34;
    expect(parseScanRecord(U8(otherCompany)).proof).toBeNull();
  });

  it('nu crapă pe date murdare: gol, lungime care depășește buffer-ul; octeții 0 de umplere sunt săriți', () => {
    expect(parseScanRecord(new Uint8Array())).toEqual({ advert: null, proof: null });
    expect(parseScanRecord(U8([40, 0xff, 0x4c, 0x00, 1, 2, 3]))).toEqual({ advert: null, proof: null });
    expect(parseScanRecord(U8([0, ...ADV(7, 101)])).advert).toEqual({ routeId: 7, busId: 101 });
  });
});

describe('corpul POST (toSighting)', () => {
  const poll = (over: Partial<BlePoll> = {}): BlePoll => ({
    deviceId: '101',
    rssi: -68,
    atMs: 0,
    proof: { slot: 5, token: '000102030405060708090a0b0c0d0e0f', clockSynced: true },
    ...over,
  });

  it('exact cele 5 câmpuri din contract, rssi brut întreg', () => {
    expect(toSighting(poll({ rssi: -67.6 }))).toEqual({
      bus_id: 101, slot: 5, token: '000102030405060708090a0b0c0d0e0f', rssi: -68, clock_synced: true,
    });
  });

  it('nu trimite: fără rssi, bus_id peste 65535, token cu majuscule sau lungime greșită', () => {
    expect(toSighting(poll({ rssi: null }))).toBeNull();
    expect(toSighting(poll({ deviceId: '65536' }))).toBeNull();
    expect(toSighting(poll({ proof: { slot: 5, token: 'A'.repeat(32), clockSynced: true } }))).toBeNull();
    expect(toSighting(poll({ proof: { slot: 5, token: 'a'.repeat(31), clockSynced: true } }))).toBeNull();
  });
});

describe('politica de trimitere', () => {
  const mk = (bus: string, slot: number): BlePoll => ({
    deviceId: bus, rssi: -60, atMs: 0, proof: { slot, token: 'b'.repeat(32), clockSynced: true },
  });

  it('autobuze diferite au sloturi independente; un slot mai vechi nu se retrimite', async () => {
    const post = jest.fn<Promise<number>, [Sighting]>(async () => 200);
    const s = createSightingSender({ post });
    s.submit(mk('101', 10));
    s.submit(mk('202', 10));
    s.submit(mk('101', 9));
    await flush();
    expect(post.mock.calls.map((c) => [c[0].bus_id, c[0].slot])).toEqual([[101, 10], [202, 10]]);
  });

  it('400 se abandonează fără retry (bug de aplicație, nu se repetă)', async () => {
    const post = jest.fn<Promise<number>, [Sighting]>(async () => 400);
    const s = createSightingSender({ post });
    s.submit(mk('101', 1));
    await flush();
    s.submit({ ...mk('101', 1), proof: undefined });
    await flush();
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('eroare de rețea: reîncearcă și când vine același slot cu token (nu doar poll fără token)', async () => {
    const post = jest.fn<Promise<number>, [Sighting]>().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(200);
    const s = createSightingSender({ post });
    s.submit(mk('101', 1));
    await flush();
    s.submit(mk('101', 1));
    await flush();
    expect(post).toHaveBeenCalledTimes(2);
  });
});

describe('politica de trimitere: request lent', () => {
  it('un request în curs nu se dublează la fiecare advert (~5/s)', async () => {
    let release: (n: number) => void = () => undefined;
    const post = jest.fn<Promise<number>, [Sighting]>(() => new Promise((r) => { release = r; }));
    const s = createSightingSender({ post });
    const p: BlePoll = { deviceId: '101', rssi: -60, atMs: 0, proof: { slot: 1, token: 'c'.repeat(32), clockSynced: true } };
    for (let i = 0; i < 10; i++) s.submit(p);
    await flush();
    expect(post).toHaveBeenCalledTimes(1);
    release(200);
  });
});

describe('scanner nativ (ble-plx simulat)', () => {
  const dev = (id: string, rawScanRecord: string | null, rssi: number | null = -70) => ({
    id, rssi, rawScanRecord, localName: null, name: null,
  });
  async function run() {
    const samples: BlePoll[] = [];
    const stop = await createNativeScanner().start((s) => samples.push(s));
    return { samples, stop };
  }

  beforeEach(() => {
    mockScanCb = null;
    mockStop.mockClear();
  });

  it('advert + scan response în același rezultat → un sample cu bus și proof', async () => {
    const { samples } = await run();
    mockScanCb!(null, dev('AA', B64(ADV(7, 101), PROOF(9, TOKEN))));
    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({ deviceId: '101', rssi: -70, proof: { slot: 9, clockSynced: true } });
  });

  it('Android livrează separat: scan response-ul preia bus_id de la ultimul advert al aceleiași adrese', async () => {
    const { samples } = await run();
    mockScanCb!(null, dev('AA', B64(ADV(7, 101))));
    mockScanCb!(null, dev('AA', B64(PROOF(9, TOKEN))));
    expect(samples.map((s) => [s.deviceId, s.proof?.slot])).toEqual([['101', undefined], ['101', 9]]);
  });

  it('proof de la o adresă necunoscută (fără advert văzut) nu produce sample', async () => {
    const { samples } = await run();
    mockScanCb!(null, dev('ZZ', B64(PROOF(9, TOKEN))));
    expect(samples).toHaveLength(0);
  });

  it('două autobuze pe adrese diferite nu se amestecă', async () => {
    const { samples } = await run();
    mockScanCb!(null, dev('AA', B64(ADV(7, 101))));
    mockScanCb!(null, dev('BB', B64(ADV(7, 202))));
    mockScanCb!(null, dev('BB', B64(PROOF(4, TOKEN))));
    mockScanCb!(null, dev('AA', B64(PROOF(5, TOKEN))));
    expect(samples.map((s) => [s.deviceId, s.proof?.slot])).toEqual([
      ['101', undefined], ['202', undefined], ['202', 4], ['101', 5],
    ]);
  });

  it('ignoră UUID străin, erori de scan și rssi lipsă; stop oprește scanarea', async () => {
    const { samples, stop } = await run();
    const foreign = ADV(7, 101).map((b, i) => (i >= 6 && i < 22 ? 1 : b));
    mockScanCb!(null, dev('CC', B64(foreign)));
    mockScanCb!(new Error('scan'), null);
    mockScanCb!(null, dev('AA', B64(ADV(7, 101)), null));
    expect(samples).toHaveLength(0);
    stop();
    expect(mockStop).toHaveBeenCalled();
  });
});
