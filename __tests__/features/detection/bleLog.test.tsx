import { act, render } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BLE_LOG_MAX, bleLog, bleStats, useBleLog } from '../../../src/features/detection/ble/log';
import { BleLogScreen } from '../../../src/features/detection/components/BleLogScreen';
import type { BlePoll } from '../../../src/features/detection/types';

const TOKEN = '000102030405060708090a0b0c0d0e0f';
const poll = (slot: number | undefined, over: Partial<BlePoll> = {}): BlePoll => ({
  deviceId: '101',
  rssi: -68,
  atMs: 0,
  proof: slot === undefined ? undefined : { slot, token: TOKEN, clockSynced: true },
  ...over,
});

beforeEach(() => {
  jest.useFakeTimers().setSystemTime(new Date('2026-11-02T12:00:00Z'));
  act(() => useBleLog.getState().clear());
});
afterEach(() => jest.useRealTimers());

describe('jurnal BLE (store)', () => {
  it('un beacon apare cel mult o dată pe secundă, dar un slot nou (token nou) apare imediat', () => {
    bleLog.sample(poll(100));
    bleLog.sample(poll(100));
    expect(useBleLog.getState().entries).toHaveLength(1);
    bleLog.sample(poll(101));
    expect(useBleLog.getState().entries).toHaveLength(2);
    jest.setSystemTime(Date.now() + 1100);
    bleLog.sample(poll(101));
    expect(useBleLog.getState().entries).toHaveLength(3);
  });

  it('păstrează slotul, tokenul și flagul de ceas exact cum vin de la beacon', () => {
    bleLog.sample(poll(58734123));
    expect(useBleLog.getState().entries[0]).toMatchObject({
      kind: 'sample', busId: '101', rssi: -68, slot: 58734123, token: TOKEN, clockSynced: true,
    });
    bleLog.sample(poll(undefined, { deviceId: '202' }));
    expect(useBleLog.getState().entries[0]).toMatchObject({ busId: '202', token: undefined });
  });

  it('notează ce a trimis aplicația la server și ce a răspuns', () => {
    bleLog.sighting({ bus_id: 101, slot: 9, token: TOKEN, rssi: -68, clock_synced: true }, 422);
    bleLog.sighting({ bus_id: 101, slot: 9, token: TOKEN, rssi: -68, clock_synced: true }, 'offline');
    const [offline, rejected] = useBleLog.getState().entries;
    expect(rejected).toMatchObject({ kind: 'sighting', status: 422, token: TOKEN });
    expect(offline.status).toBe('offline');
  });

  it('ține cel mult BLE_LOG_MAX intrări (cele mai noi) și clear() zeroizează și contoarele', () => {
    for (let i = 0; i < BLE_LOG_MAX + 20; i++) bleLog.info(`m${i}`);
    const { entries } = useBleLog.getState();
    expect(entries).toHaveLength(BLE_LOG_MAX);
    expect(entries[0].text).toBe(`m${BLE_LOG_MAX + 19}`);
    bleLog.heard(true);
    bleLog.heard(false);
    expect(bleStats).toMatchObject({ heard: 2, ours: 1 });
    act(() => useBleLog.getState().clear());
    expect(bleStats).toMatchObject({ heard: 0, ours: 0, lastOursAtMs: 0 });
    expect(useBleLog.getState().entries).toHaveLength(0);
  });
});

describe('ecranul „Jurnal BLE"', () => {
  const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
  const renderScreen = () =>
    render(
      <SafeAreaProvider initialMetrics={metrics}>
        <BleLogScreen onBack={jest.fn()} />
      </SafeAreaProvider>,
    );

  it('arată mesajul de început când nu s-a recepționat nimic', () => {
    const screen = renderScreen();
    expect(screen.getByText(/Nimic recepționat încă/)).toBeTruthy();
  });

  it('afișează tokenul complet, slotul, RSSI și răspunsul serverului (422 = token vechi)', () => {
    bleLog.heard(true);
    bleLog.sample(poll(58734123));
    bleLog.sighting({ bus_id: 101, slot: 58734123, token: TOKEN, rssi: -68, clock_synced: true }, 422);
    const screen = renderScreen();
    expect(screen.getAllByText(TOKEN).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/slot 58734123/)).toHaveLength(2);
    expect(screen.getByText(/422 · token vechi sau greșit/)).toBeTruthy();
    expect(screen.getByText(/Pachete cu UUID-ul EchoPass: 1/)).toBeTruthy();
  });
});
