import AsyncStorage from '@react-native-async-storage/async-storage';
import * as client from '../../../src/services/api/authedRequest';
import * as http from '../../../src/services/api/http';
import * as session from '../../../src/services/api/session';
import * as wallet from '../../../src/services/repositories/real/walletRepo.real';


const fetchMock = jest.fn();
(globalThis as unknown as { fetch: unknown }).fetch = fetchMock;

const json = (status: number, body: unknown, headers: Record<string, string> = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k: string) => headers[k] ?? null },
  json: async () => body,
});
const tokens = (n: number) => ({ userId: 'u1', accessToken: `acc${n}`, refreshToken: `ref${n}`, expiresIn: 900 });

beforeEach(async () => {
  fetchMock.mockReset();
  await AsyncStorage.clear();
  await session.clearSession();
});

describe('client către serverul EchoPass', () => {
  it('creează un utilizator anonim o singură dată și trimite Bearer', async () => {
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/auth/anonymous') ? json(200, tokens(1)) : json(200, []),
    );
    await Promise.all([client.request('/wallet/items'), client.request('/wallet/items')]);
    const urls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(urls.filter((u) => u.endsWith('/auth/anonymous'))).toHaveLength(1);
    const walletCall = fetchMock.mock.calls.find((c) => (c[0] as string).endsWith('/wallet/items'));
    expect(walletCall?.[0]).toContain('/api/v1/wallet/items');
    expect(walletCall?.[1].headers.Authorization).toBe('Bearer acc1');
  });

  it('la 401 face un singur refresh, salvează noul refresh token și reîncearcă', async () => {
    await session.writeSession({ userId: 'u1', tier: 'anonymous', accessToken: 'old', refreshToken: 'ref0', accessExpiresAtMs: Date.now() + 600_000 });
    fetchMock.mockImplementation(async (url: string, init: { headers: Record<string, string>; body?: string }) => {
      if (url.endsWith('/auth/refresh')) {
        expect(JSON.parse(init.body as string)).toEqual({ refreshToken: 'ref0' });
        return json(200, tokens(2));
      }
      return init.headers.Authorization === 'Bearer acc2' ? json(200, []) : json(401, { error: { code: 'AUTH_INVALID', message: 'x' } });
    });
    await client.request('/wallet/items');
    expect(fetchMock.mock.calls.filter((c) => (c[0] as string).endsWith('/auth/refresh'))).toHaveLength(1);
    expect((await session.readSession())?.refreshToken).toBe('ref2');
  });

  it('mapează eroarea serverului în ApiError (code, reason, Retry-After)', async () => {
    await session.writeSession({ userId: 'u1', tier: 'account', accessToken: 'a', refreshToken: 'r', accessExpiresAtMs: Date.now() + 600_000 });
    fetchMock.mockResolvedValueOnce(json(402, { error: { code: 'PAYMENT_DECLINED', message: 'no', reason: 'card_declined' } }));
    await expect(client.request('/rides/x/confirm', { method: 'POST' })).rejects.toMatchObject({ code: 'PAYMENT_DECLINED', reason: 'card_declined', status: 402 });
    fetchMock.mockResolvedValueOnce(json(429, { error: { code: 'RATE_LIMITED', message: 'slow' } }, { 'Retry-After': '12' }));
    const err = await client.request('/me').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(http.ApiError);
    expect((err as http.ApiError).retryAfterSec).toBe(12);
  });

  it('reînnoirea abonamentului cere Idempotency-Key și alege produsul din catalog', async () => {
    await session.writeSession({ userId: 'u1', tier: 'account', accessToken: 'a', refreshToken: 'r', accessExpiresAtMs: Date.now() + 600_000 });
    const pass = { kind: 'pass', id: 'p1', name: 'L', holder: 'A', validFrom: '2026-11-14', validUntil: '2026-12-14', lines: 'all', theme: 'ocean', cardNumber: 'TM-1', verified: false };
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/passes/catalog'))
        return json(200, [
          { id: 'a0000000-0000-4000-8000-000000000004', name: 'Monthly E2', days: 30, priceRon: 60, lines: ['E2'] },
          { id: 'a0000000-0000-4000-8000-000000000003', name: 'Monthly', days: 30, priceRon: 120, lines: 'all' },
        ]);
      return json(200, { item: pass, charge: {} });
    });
    const repo = wallet.createWalletRepoReal();
    await repo.renewPass('p1', 30, 'card-1');
    const renew = fetchMock.mock.calls.find((c) => (c[0] as string).endsWith('/wallet/passes/p1/renew'));
    expect(renew?.[1].headers['Idempotency-Key']).toMatch(/^[0-9a-f-]{36}$/);
    expect(JSON.parse(renew?.[1].body)).toEqual({ productId: 'a0000000-0000-4000-8000-000000000003', sourceId: 'card-1' });
  });
});
