import { BEACON_UUID, base64ToBytes, parseScanRecord } from '../../../src/features/detection/ble/beacon';
import { createSightingSender, toSighting } from '../../../src/features/detection/ble/sightings';
import type { Sighting } from '../../../src/services/api/schemas/sighting';
import type { BlePoll } from '../../../src/features/detection/types';

const uuidBytes = BEACON_UUID.replace(/-/g, '').match(/../g)!.map((h) => parseInt(h, 16));
const TOKEN = Array.from({ length: 16 }, (_, i) => 0xa0 + i);
const TOKEN_HEX = TOKEN.map((b) => b.toString(16)).join('');

function advert(major: number, minor: number, uuid = uuidBytes): number[] {
  return [26, 0xff, 0x4c, 0x00, 0x02, 0x15, ...uuid, major >> 8, major & 255, minor >> 8, minor & 255, 0xc5];
}
function proof(slot: number, flags = 1, version = 2): number[] {
  return [25, 0xff, 0xff, 0xff, version, flags, (slot >>> 24) & 255, (slot >>> 16) & 255, (slot >>> 8) & 255, slot & 255, ...TOKEN];
}
const bytes = (...parts: number[][]) => Uint8Array.from(parts.flat());

describe('beacon scan record (docs/phone.md)', () => {
  it('reads route, bus, slot, token and clock flag', () => {
    const r = parseScanRecord(bytes([2, 1, 6], advert(7, 101), proof(58734123)));
    expect(r.advert).toEqual({ routeId: 7, busId: 101 });
    expect(r.proof).toEqual({ slot: 58734123, token: TOKEN_HEX, clockSynced: true });
  });

  it('handles the 32-bit slot above 2^31 and big-endian minor', () => {
    const r = parseScanRecord(bytes(advert(65535, 0x0102), proof(0xf0000001, 0)));
    expect(r.advert).toEqual({ routeId: 65535, busId: 258 });
    expect(r.proof).toMatchObject({ slot: 0xf0000001, clockSynced: false });
  });

  it('advert without scan response gives no proof', () => {
    expect(parseScanRecord(bytes(advert(7, 101)))).toEqual({ advert: { routeId: 7, busId: 101 }, proof: null });
  });

  it('ignores foreign UUIDs, wrong version and truncated data', () => {
    expect(parseScanRecord(bytes(advert(7, 101, uuidBytes.map(() => 1)))).advert).toBeNull();
    expect(parseScanRecord(bytes(proof(5, 1, 3))).proof).toBeNull();
    expect(parseScanRecord(bytes(advert(7, 101)).subarray(0, 12)).advert).toBeNull();
  });

  it('decodes base64 like rawScanRecord', () => {
    expect(Array.from(base64ToBytes('AQID/w=='))).toEqual([1, 2, 3, 255]);
  });
});

describe('sightings', () => {
  const poll = (slot: number, over: Partial<BlePoll> = {}): BlePoll => ({
    deviceId: '101',
    rssi: -68,
    atMs: 0,
    proof: { slot, token: TOKEN_HEX, clockSynced: true },
    ...over,
  });
  const flush = () => new Promise<void>((r) => setImmediate(() => r()));

  it('builds the exact body of the contract and never sends without a token', () => {
    expect(toSighting(poll(9))).toEqual({ bus_id: 101, slot: 9, token: TOKEN_HEX, rssi: -68, clock_synced: true });
    expect(toSighting(poll(9, { proof: undefined }))).toBeNull();
    expect(toSighting(poll(9, { deviceId: '3114x' }))).toBeNull();
  });

  it('sends once per bus and slot, again when the slot changes', async () => {
    const post = jest.fn<Promise<number>, [Sighting]>(async () => 200);
    const sender = createSightingSender({ post });
    sender.submit(poll(1));
    sender.submit(poll(1));
    sender.submit(poll(2));
    await flush();
    expect(post.mock.calls.map((c) => c[0].slot)).toEqual([1, 2]);
  });

  it('retries after a network error only within 2 minutes', async () => {
    let t = 0;
    const post = jest.fn<Promise<number>, [Sighting]>().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(200);
    const sender = createSightingSender({ post, now: () => t });
    sender.submit(poll(1));
    await flush();
    t = 30_000;
    sender.submit(poll(1, { proof: undefined }));
    await flush();
    expect(post).toHaveBeenCalledTimes(2);
    expect(post.mock.calls[1][0].slot).toBe(1);

    const stale = jest.fn<Promise<number>, [Sighting]>().mockRejectedValueOnce(new Error('offline'));
    const s2 = createSightingSender({ post: stale, now: () => t });
    s2.submit(poll(5));
    await flush();
    t += 121_000;
    s2.submit(poll(5, { proof: undefined }));
    await flush();
    expect(stale).toHaveBeenCalledTimes(1);
  });

  it('drops 422 without retry and reports 401', async () => {
    const onUnauthorized = jest.fn();
    const post = jest.fn<Promise<number>, [Sighting]>().mockResolvedValueOnce(422).mockResolvedValueOnce(401);
    const sender = createSightingSender({ post, onUnauthorized });
    sender.submit(poll(1));
    await flush();
    sender.submit(poll(2));
    await flush();
    sender.submit(poll(2, { proof: undefined }));
    await flush();
    expect(post).toHaveBeenCalledTimes(2);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});

describe('server mock (sightings)', () => {
  const { mockSightingStatus } = jest.requireActual('../../../src/features/detection/ble/sightings');
  const s = (slot: number): Sighting => ({ bus_id: 101, slot, token: TOKEN_HEX.padEnd(32, '0').slice(0, 32), rssi: -68, clock_synced: true });
  const now = 1_700_000_000_000;
  const slot = Math.floor(now / 30_000);

  it('200 pentru slot curent, 422 pentru slot vechi sau din viitor', () => {
    expect(mockSightingStatus(s(slot), now)).toBe(200);
    expect(mockSightingStatus(s(slot - 4), now)).toBe(200);
    expect(mockSightingStatus(s(slot - 5), now)).toBe(422);
    expect(mockSightingStatus(s(slot + 5), now)).toBe(422);
  });
});
