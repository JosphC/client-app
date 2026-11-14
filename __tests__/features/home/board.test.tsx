import { fireEvent, render } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement, ReactNode } from 'react';
import { ArrivalsBoard } from '../../../src/features/home/components/arrivals/ArrivalsBoard';
import { DepartureRow } from '../../../src/features/home/components/arrivals/DepartureRow';
import { StationAlert } from '../../../src/features/home/components/arrivals/StationAlert';
import type { Report } from '../../../src/services/api/schemas/report';
import type { StopArrivalItem } from '../../../src/features/home/hooks/useStopArrivals';
import type { Station } from '../../../src/features/map/stations';

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

const boardStation: Station = { id: '152', name: 'Test Station', lat: 45.76546, lng: 21.2255, lines: ['14', '17', '18', 'M14'] };

function departure(tripId: string, line: string, minutesLeft: number, isNow = false): StopArrivalItem {
  return {
    arrival: {
      tripId,
      route: { id: line, shortName: line },
      headsign: 'Centru',
      scheduledTime: null,
      predictedTime: new Date(Date.now() + minutesLeft * 60_000).toISOString(),
      isRealtime: true,
      delayMin: 0,
    },
    minutesLeft,
    isNow,
  };
}

describe('home arrivals board', () => {
  it('board shows live arrivals and tracks bus on tap', async () => {
    const onOpenMap = jest.fn();
    const onTrackBus = jest.fn();
    const screen = renderWithClient(
      <ArrivalsBoard
        station={boardStation}
        coords={null}
        onSelectStation={jest.fn()}
        onDirections={jest.fn()}
        onOpenMap={onOpenMap}
        onTrackBus={onTrackBus}
      />,
    );
    expect(await screen.findByText('Test Station')).toBeTruthy();
    expect(screen.queryByText('Live')).toBeNull();
    expect(await screen.findByText(/Întârziere 4 min/)).toBeTruthy();
    expect(await screen.findByText('Centru')).toBeTruthy();
    expect(await screen.findByText(/Trafic · Linia 17/)).toBeTruthy();
    fireEvent.press(screen.getByText('Centru'));
    expect(onTrackBus).toHaveBeenCalledWith('bus-17a');
    expect(screen.getByText('Distribuie')).toBeTruthy();
    expect(screen.getByText('Raportează')).toBeTruthy();
  });

  it('board actions trigger directions and save, lines filter rows', async () => {
    const onDirections = jest.fn();
    const screen = renderWithClient(
      <ArrivalsBoard
        station={boardStation}
        coords={null}
        onSelectStation={jest.fn()}
        onDirections={onDirections}
        onOpenMap={jest.fn()}
        onTrackBus={jest.fn()}
      />,
    );
    await screen.findByText('Test Station');
    fireEvent.press(screen.getByText('Direcții'));
    expect(onDirections).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByText('Salvează'));
    expect(screen.getByText('Salvat')).toBeTruthy();
    fireEvent.press(screen.getByText('Toate'));
    expect(screen.getByText('Centru')).toBeTruthy();
    fireEvent.press(screen.getAllByText('14')[0]);
    expect(screen.queryByText('Centru')).toBeNull();
    expect(screen.getByText('Spitalul Municipal')).toBeTruthy();
  });

  it('board header opens the station picker and picks by search', async () => {
    const onSelectStation = jest.fn();
    const screen = renderWithClient(
      <ArrivalsBoard
        station={boardStation}
        coords={null}
        onSelectStation={onSelectStation}
        onDirections={jest.fn()}
        onOpenMap={jest.fn()}
        onTrackBus={jest.fn()}
      />,
    );
    await screen.findByText('Test Station');
    fireEvent.press(screen.getByLabelText('Schimbă stația'));
    fireEvent.changeText(screen.getByPlaceholderText('Caută stația…'), 'Banat');
    fireEvent.press(screen.getAllByText('Banatul')[0]);
    expect(onSelectStation).toHaveBeenCalledWith(expect.objectContaining({ id: '4' }));
  });

  it('station alert expands to all alerts', () => {
    const alerts: Report[] = [
      { id: 'r1', kind: 'traffic', line: '17', stopName: 'Piața Mărăști', confirmations: 3, expiresAt: '2027-10-03T09:20:00Z' },
      { id: 'r2', kind: 'works', line: '17', stopName: 'Centru', confirmations: 1, expiresAt: '2027-10-03T09:20:00Z' },
    ];
    const screen = render(<StationAlert alerts={alerts} />);
    expect(screen.getByText(/Trafic · Linia 17/)).toBeTruthy();
    expect(screen.getByText(/\+1 alerte/)).toBeTruthy();
    expect(screen.queryByText(/Lucrări · Linia 17/)).toBeNull();
    fireEvent.press(screen.getByText(/Trafic · Linia 17/));
    expect(screen.getByText(/Lucrări · Linia 17/)).toBeTruthy();
  });

  it('station alert shows age when createdAt exists', () => {
    const createdAt = new Date(Date.now() - 5 * 60_000).toISOString();
    const screen = render(
      <StationAlert
        alerts={[{ id: 'r1', kind: 'traffic', line: '17', stopName: 'Piața Mărăști', confirmations: 3, expiresAt: '2027-10-03T09:20:00Z', createdAt }]}
      />,
    );
    expect(screen.getByText(/Trafic · Linia 17/)).toBeTruthy();
    expect(screen.getByText(/acum/)).toBeTruthy();
  });

  it('station alert hides without alerts', () => {
    const screen = render(<StationAlert alerts={[]} />);
    expect(screen.queryByText(/Linia/)).toBeNull();
  });

  it('row shows big eta number with min unit and talkback label', () => {
    const screen = render(<DepartureRow item={departure('t1', '5', 3)} onPress={jest.fn()} />);
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('min')).toBeTruthy();
    expect(screen.getByLabelText(/Linia 5 spre Centru/)).toBeTruthy();
  });

  it('row shows early and delayed status against the schedule', () => {
    const base = Date.now();
    const iso = (min: number) => new Date(base + min * 60_000).toISOString();
    const early = render(
      <DepartureRow
        item={{
          arrival: {
            tripId: 'e1',
            route: { id: '3', shortName: '3' },
            headsign: 'Centru',
            scheduledTime: iso(12),
            predictedTime: iso(10),
            isRealtime: true,
          },
          minutesLeft: 10,
          isNow: false,
        }}
        onPress={jest.fn()}
      />,
    );
    expect(early.getByText(/Devansare 2 min/)).toBeTruthy();
    const late = render(
      <DepartureRow
        item={{
          arrival: {
            tripId: 'l1',
            route: { id: '3', shortName: '3' },
            headsign: 'Centru',
            scheduledTime: iso(10),
            predictedTime: iso(11),
            isRealtime: true,
            delayMin: 1,
          },
          minutesLeft: 11,
          isNow: false,
        }}
        onPress={jest.fn()}
      />,
    );
    expect(late.getByText(/Întârziere 1 min/)).toBeTruthy();
  });

  it('board stays visible with empty message when no arrivals', async () => {
    const screen = renderWithClient(
      <ArrivalsBoard
        station={{ id: 'nope', name: 'Nicăieri', lat: 0, lng: 0, lines: [] }}
        coords={null}
        onSelectStation={jest.fn()}
        onDirections={jest.fn()}
        onOpenMap={jest.fn()}
        onTrackBus={jest.fn()}
      />,
    );
    expect(await screen.findByText('Nicio sosire în următoarele 2 ore')).toBeTruthy();
  });
});
