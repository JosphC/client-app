// Metro/Babel înlocuiește DOAR accesările statice `process.env.EXPO_PUBLIC_X`; `process.env[name]`
// rămâne nedefinit în aplicație. De aceea fiecare variabilă e citită explicit aici.
declare const process: { env: Record<string, string | undefined> };

const raw = {
  USE_MOCKS: process.env.EXPO_PUBLIC_USE_MOCKS,
  USE_REAL_BUS: process.env.EXPO_PUBLIC_USE_REAL_BUS,
  USE_MOCK_BLE: process.env.EXPO_PUBLIC_USE_MOCK_BLE,
  API_URL: process.env.EXPO_PUBLIC_API_URL,
  BLE_SERVICE_UUID: process.env.EXPO_PUBLIC_BLE_SERVICE_UUID,
  BLE_NAME_PREFIX: process.env.EXPO_PUBLIC_BLE_NAME_PREFIX,
  AUTH_TOKEN: process.env.EXPO_PUBLIC_AUTH_TOKEN,
  TEST_USER_ID: process.env.EXPO_PUBLIC_TEST_USER_ID,
  SIGHTINGS_URL: process.env.EXPO_PUBLIC_SIGHTINGS_URL,
  TEST_PAYMENTS: process.env.EXPO_PUBLIC_TEST_PAYMENTS,
  TEST_ID_TOKEN: process.env.EXPO_PUBLIC_TEST_ID_TOKEN,
};

function readBool(value: string | undefined, fallback: boolean): boolean {
  return value === undefined ? fallback : value === 'true';
}

const useMocks = readBool(raw.USE_MOCKS, true);

export const env = {
  /** In-memory mocks for tests; Docker sets this to false so the app talks to mock-api. */
  useMocks,
  /** Live STPT bus positions instead of the bus mock. Wallet/trips stay on mocks. */
  useRealBus: readBool(raw.USE_REAL_BUS, false),
  /**
   * Scannerul BLE simulat. Implicit urmează `useMocks`; pune `EXPO_PUBLIC_USE_MOCK_BLE=false`
   * împreună cu `USE_MOCKS=true` ca să citești un ESP32 real cu serverul încă mock.
   */
  useMockBle: readBool(raw.USE_MOCK_BLE, useMocks),
  apiBaseUrl: raw.API_URL ?? 'http://localhost:4000',
  /**
   * BLE beacon contract of the on-board transmitter (to be confirmed with the
   * hardware/backend team): optional service UUID filter and the local-name
   * prefix followed by the vehicle id, e.g. "EP-3114".
   */
  bleServiceUuid: raw.BLE_SERVICE_UUID ?? null,
  bleNamePrefix: raw.BLE_NAME_PREFIX ?? 'EP-',
  /** Token de login trimis ca `Authorization` la /sightings (până există login real). */
  authToken: raw.AUTH_TOKEN ?? null,
  /** Doar server de test: utilizatorul vine din `X-User-Id`, nu din login. */
  testUserId: raw.TEST_USER_ID ?? null,
  /**
   * Dacă e setată, DOAR sighting-urile BLE (POST /api/v1/sightings) merg la această adresă, chiar cu USE_MOCKS=true;
   * restul aplicației rămâne pe mock. Ex.: http://192.168.1.104:8000 (serverul de test al ESP32).
   */
  sightingsUrl: raw.SIGHTINGS_URL ? raw.SIGHTINGS_URL.replace(/\/+$/, '') : null,
  /**
   * Serverul are procesator de plăți fals (api-app.md §12): acceptă orice `paymentMethodId`. Cu `true`, aplicația
   * adaugă carduri de test chiar și cu USE_MOCKS=false. Implicit urmează `useMocks`; NU activa în producție.
   */
  useTestPayments: readBool(raw.TEST_PAYMENTS, useMocks),
  /** Doar server de test: `idToken` fix (ex. `test:alice`) pentru Google/Apple până există SDK-ul real. */
  testIdToken: raw.TEST_ID_TOKEN ?? null,
} as const;
