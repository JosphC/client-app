jest.mock('../../../src/core/config/env', () => ({
  env: { apiBaseUrl: 'http://server.test', displayToken: 'tok', serverBuses: '101:E2' },
}));

import { loadServerFleet, parseServerBuses } from '../../../src/services/repositories/real/serverBuses';

function json(body: unknown, status = 200): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

const position = {
  bus_id: 101, route_id: 7, device_id: 'a4cf12e08b10', boot_id: 'b', seq: 1, ts: 1, uptime_ms: 1, sim: 0,
  fix_ok: true, lat: 45.7537, lon: 21.2257, speed_kmh: 18.5, received_at: '2026-11-15T09:00:00Z',
};

describe('parseServerBuses', () => {
  it('citește perechile bus_id:linie și ignoră intrările greșite', () => {
    expect(parseServerBuses('101:E2, 102:E7,abc:X,103:')).toEqual([
      { busId: 101, line: 'E2' },
      { busId: 102, line: 'E7' },
    ]);
    expect(parseServerBuses(null)).toEqual([]);
  });
});

describe('loadServerFleet', () => {
  const fetchMock = jest.fn();
  beforeEach(() => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
  });

  it('pune autobuzul 101 pe linia E2 cu numărul de persoane de pe server', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/headcount') ? json({ bus_id: 101, people_counted: 7 }) : json(position),
    );
    const fleet = await loadServerFleet();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://server.test/api/v1/buses/101/position',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer tok' }) }),
    );
    expect(fleet.buses).toEqual([expect.objectContaining({ id: 'server-101', line: 'E2', headcount: 7 })]);
    expect(fleet.positions[0]).toEqual(
      expect.objectContaining({ busId: 'server-101', lat: 45.7537, lng: 21.2257, speedKmh: 18.5 }),
    );
    expect(fleet.positions[0].nextStop.length).toBeGreaterThan(0);
  });

  it('arată autobuzul fără număr când headcount-ul eșuează sau e necunoscut', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/headcount') ? json({ error: { code: 'NOT_FOUND' } }, 404) : json(position),
    );
    expect((await loadServerFleet()).buses[0].headcount).toBeNull();
  });

  it('omite autobuzul fără poziție', async () => {
    fetchMock.mockImplementation(async () => json({ error: { code: 'NOT_FOUND' } }, 404));
    expect(await loadServerFleet()).toEqual({ buses: [], positions: [] });
  });
});
