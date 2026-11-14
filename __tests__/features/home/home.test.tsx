import { act, fireEvent, render, renderHook } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HomeHero } from '../../../src/features/home/components/HomeHero';
import { PlannerCard } from '../../../src/features/home/components/planner/PlannerCard';
import { StickySearchBar } from '../../../src/features/home/components/planner/StickySearchBar';
import { Screen } from '../../../src/ui';
import { RouteOptions } from '../../../src/features/home/components/planner/RouteOptions';
import { useRoutePlanner } from '../../../src/features/home/hooks/useRoutePlanner';
import type { Station } from '../../../src/features/map/stations';
import { t } from '../../../src/core/i18n';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-router', () => ({ useFocusEffect: (effect: () => void) => effect() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

function renderWithClient(ui: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return render(ui, { wrapper: Wrapper });
}

const MORNING = new Date(2026, 9, 4, 8, 15, 0).getTime();
const EVENING = new Date(2026, 9, 4, 20, 15, 0).getTime();

describe('home screen', () => {
  it('greets by time of day with the user name', () => {
    const morning = render(<HomeHero name="Ion" onNotifications={jest.fn()} nowMs={MORNING} />);
    expect(morning.getByText('Bună dimineața, Ion')).toBeTruthy();
    const evening = render(<HomeHero name={null} onNotifications={jest.fn()} nowMs={EVENING} />);
    expect(evening.getByText('Bună seara')).toBeTruthy();
  });

  it('planner picks origin without diacritics and validates', () => {
    const onOriginChange = jest.fn();
    const onSearchRoute = jest.fn();
    const screen = render(
      <PlannerCard
        origin={null}
        destination={null}
        onOriginChange={onOriginChange}
        onDestinationChange={jest.fn()}
        onSwap={jest.fn()}
        onSearchRoute={onSearchRoute}
      />,
    );
    fireEvent(screen.getByPlaceholderText(t('home.from')), 'focus');
    fireEvent.changeText(screen.getByPlaceholderText(t('home.from')), 'Maras');
    const results = screen.getAllByText(/Mărăști/);
    expect(results.length).toBeGreaterThan(0);
    fireEvent.press(results[0]);
    expect(onOriginChange).toHaveBeenCalledTimes(1);

    fireEvent.press(screen.getAllByText('Alege destinația')[0]);
    expect(screen.getAllByText('Alege destinația')).toHaveLength(2);
    expect(onSearchRoute).not.toHaveBeenCalled();
  });

  it('planner rejects the same station twice and picks departure time', () => {
    const same: Station = { id: '4', name: 'Banatul', lat: 45.73662, lng: 21.19784, lines: ['2', '7', '9'] };
    const onSearchRoute = jest.fn();
    const screen = render(
      <PlannerCard
        origin={same}
        destination={same}
        onOriginChange={jest.fn()}
        onDestinationChange={jest.fn()}
        onSwap={jest.fn()}
        onSearchRoute={onSearchRoute}
      />,
    );
    fireEvent.press(screen.getAllByText('Alege două stații diferite')[0]);
    expect(screen.getAllByText('Alege două stații diferite')).toHaveLength(2);
    expect(onSearchRoute).not.toHaveBeenCalled();

    fireEvent.press(screen.getByLabelText('Plecare acum'));
    fireEvent.changeText(screen.getByPlaceholderText('Ora (HH:MM)'), '14:30');
    fireEvent.press(screen.getByText('Plecare la'));
    expect(screen.getByText('14:30')).toBeTruthy();
  });

  it('sticky bar hides until scrolled and triggers search', () => {
    const onSearch = jest.fn();
    const hidden = render(
      <StickySearchBar visible={false} destinationName="Billa" canSearch={true} onSearch={onSearch} />,
    );
    expect(hidden.queryByText('Billa')).toBeNull();
    const shown = render(
      <StickySearchBar visible={true} destinationName="Billa" canSearch={true} onSearch={onSearch} />,
    );
    expect(shown.getByText('Billa')).toBeTruthy();
    fireEvent.press(shown.getAllByRole('button')[0]);
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('screen reports scroll position', () => {
    const onScrollY = jest.fn();
    const screen = render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}>
        <Screen scroll onScrollY={onScrollY}>
          <></>
        </Screen>
      </SafeAreaProvider>,
    );
    fireEvent.scroll(screen.getByTestId('screen-scroll'), { nativeEvent: { contentOffset: { y: 200 } } });
    expect(onScrollY).toHaveBeenCalledWith(200);
  });

  it('route planner state swaps and relaunches search', () => {
    const nav = { plan: jest.fn(), live: jest.fn(), notifications: jest.fn() };
    const a: Station = { id: 'a', name: 'A', lat: 0, lng: 0, lines: [] };
    const b: Station = { id: 'b', name: 'B', lat: 0, lng: 0, lines: [] };
    const { result } = renderHook(() => useRoutePlanner(jest.fn(), nav));
    act(() => {
      result.current.changeOrigin(a, null);
      result.current.changeDestination(b);
    });
    expect(result.current.origin).toBe(a);
    act(() => {
      result.current.swap();
    });
    expect(result.current.origin).toBe(b);
    expect(result.current.destination).toBe(a);
  });

  it('route options list real options and open details', async () => {
    const from: Station = { id: 's1', name: 'Piața Victoriei', lat: 45.75, lng: 21.22, lines: ['17', '11'] };
    const to: Station = { id: 's2', name: 'Calea Aradului', lat: 45.76, lng: 21.23, lines: ['11'] };
    const onOpen = jest.fn();
    const screen = renderWithClient(<RouteOptions origin={from} originCoords={null} destination={to} onOpen={onOpen} />);
    expect(await screen.findByText('Rute')).toBeTruthy();
    const fares = await screen.findAllByText(/5,00 lei/);
    expect(fares.length).toBeGreaterThan(0);
    fireEvent.press(fares[0]);
    expect(onOpen).toHaveBeenCalledTimes(1);
    // Real timetable routing from these coordinates (the fixture lines are not used).
    expect(onOpen.mock.calls[0][0]).toMatchObject({ line: expect.any(String), totalMin: expect.any(Number) });
  });
});
