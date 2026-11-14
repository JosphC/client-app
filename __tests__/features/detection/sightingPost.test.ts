import { bleStats, useBleLog } from '../../../src/features/detection/ble/log';
import { createSightingSender } from '../../../src/features/detection/ble/sightings';
import { postSighting } from '../../../src/services/repositories/real/sightingRepo';
import type { Sighting } from '../../../src/services/api/schemas/sighting';
import type { BlePoll } from '../../../src/features/detection/types';

const TOKEN = '000102030405060708090a0b0c0d0e0f';
const sighting: Sighting = { bus_id: 101, slot: 59788182, token: TOKEN, rssi: -54, clock_synced: true };
const target = { baseUrl: 'http://192.168.1.104:8000', userId: 'phone-test', authToken: null };
const flush = () => new Promise<void>((r) => setImmediate(() => r()));
const fetchMock = jest.fn();
(globalThis as unknown as { fetch: unknown }).fetch = fetchMock;

beforeEach(() => {
  fetchMock.mockReset();
  useBleLog.getState().clear();
});

describe('POST /api/v1/sightings către serverul de test', () => {
  it('trimite corpul din docs/phone.md la adresa configurată, cu X-User-Id', async () => {
    fetchMock.mockResolvedValue({ status: 200, text: async () => '{"ok":true}' });
    const r = await postSighting(sighting, target);
    expect(r).toEqual({ status: 200, detail: undefined });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('http://192.168.1.104:8000/api/v1/sightings');
    expect(init.method).toBe('POST');
    expect(init.headers['X-User-Id']).toBe('phone-test');
    expect(JSON.parse(init.body)).toEqual(sighting);
  });

  it('la refuz întoarce și motivul dat de server (începutul corpului)', async () => {
    fetchMock.mockResolvedValue({ status: 422, text: async () => '{"ok":false,"reason":"token not issued by this bus recently"}' });
    const r = await postSighting(sighting, target);
    expect(r.status).toBe(422);
    expect(r.detail).toContain('token not issued by this bus recently');
  });
});

describe('jurnalul arată fiecare POST', () => {
  const poll: BlePoll = { deviceId: '101', rssi: -54, atMs: 0, proof: { slot: 59788182, token: TOKEN, clockSynced: true } };

  it('200 → contor „acceptate", 422 → „refuzate" cu motivul din răspuns', async () => {
    const post = jest.fn().mockResolvedValueOnce(200).mockResolvedValueOnce({ status: 422, detail: 'token not issued by this bus recently' });
    const sender = createSightingSender({ post });
    sender.submit(poll);
    await flush();
    sender.submit({ ...poll, proof: { ...poll.proof!, slot: poll.proof!.slot + 1 } });
    await flush();
    expect(bleStats).toMatchObject({ posted: 2, ok: 1, failed: 1 });
    const [latest, first] = useBleLog.getState().entries;
    expect(first).toMatchObject({ kind: 'sighting', status: 200 });
    expect(latest).toMatchObject({ status: 422, text: 'token not issued by this bus recently' });
  });

  it('eroare de rețea → „offline" cu mesajul erorii, ca să vezi de ce nu ajunge la server', async () => {
    const post = jest.fn().mockRejectedValue(new Error('Network request failed'));
    createSightingSender({ post }).submit(poll);
    await flush();
    expect(useBleLog.getState().entries[0]).toMatchObject({ status: 'offline', text: 'Network request failed' });
    expect(bleStats.failed).toBe(1);
  });
});
