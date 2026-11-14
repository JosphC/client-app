import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { BoardingPromptModal } from '../../../src/features/ride/components/BoardingPromptModal';
import { useRideStore } from '../../../src/features/ride/rideStore';
import { useWalletStore } from '../../../src/features/wallet/walletStore';
import type { WalletItem } from '../../../src/features/wallet/types';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));

let client: QueryClient;

function renderModal() {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <BoardingPromptModal />
    </QueryClientProvider>,
  );
}

const mockCard: Extract<WalletItem, { kind: 'card' }> = {
  kind: 'card',
  id: 'card-1',
  network: 'visa',
  last4: '4021',
  holder: 'Ion Popescu',
  expiry: '11/28',
  token: 'tok_mock',
  bank: 'Nova Bank',
};

const mockPass: Extract<WalletItem, { kind: 'pass' }> = {
  kind: 'pass',
  id: 'pass-1',
  name: 'Abonament Lunar',
  holder: 'Ion Popescu',
  validFrom: '2026-10-01',
  validUntil: '2099-01-01',
  lines: 'all',
  theme: 'ocean',
};

describe('BLE Boarding & Passenger Selection', () => {
  beforeEach(() => {
    useRideStore.setState({
      status: 'idle',
      detectedVehicle: null,
      passengerCount: 1,
      activeRide: null,
      toastMessage: null,
    });
    useWalletStore.setState({
      items: [mockCard],
      defaultSourceId: 'card-1',
    });
  });

  it('starts with status idle and does not render modal', () => {
    const { queryByTestId } = renderModal();
    expect(queryByTestId('btn-confirm-boarding')).toBeNull();
  });

  it('shows detected vehicle with default 1 passenger and 5,00 lei fare', () => {
    useRideStore.getState().detectVehicle({
      line: '15',
      vehicleId: '3114',
      vehicleType: 'Troleibuz',
      station: 'Piața Mărăști',
      destination: 'T. Grozăvescu (Poșta Mare)',
    });

    const { getByTestId, getByText } = renderModal();

    expect(getByText('Câte persoane plătești?')).toBeTruthy();
    expect(getByText('T. Grozăvescu (Poșta Mare)')).toBeTruthy();
    expect(getByTestId('passenger-count-text').props.children).toBe(1);
    expect(getByTestId('total-fare-text').props.children).toBe('5,00 lei');
  });

  it('increments and decrements passenger count, updating total fare', () => {
    useRideStore.getState().detectVehicle({
      line: '15',
      vehicleId: '3114',
      vehicleType: 'Troleibuz',
      station: 'Piața Mărăști',
      destination: 'T. Grozăvescu (Poșta Mare)',
    });

    const { getByTestId } = renderModal();

    // Increment to 2
    fireEvent.press(getByTestId('btn-increment-passengers'));
    expect(getByTestId('passenger-count-text').props.children).toBe(2);
    expect(getByTestId('total-fare-text').props.children).toBe('10,00 lei');

    // Increment to 3
    fireEvent.press(getByTestId('btn-increment-passengers'));
    expect(getByTestId('passenger-count-text').props.children).toBe(3);
    expect(getByTestId('total-fare-text').props.children).toBe('15,00 lei');

    // Decrement back to 2
    fireEvent.press(getByTestId('btn-decrement-passengers'));
    expect(getByTestId('passenger-count-text').props.children).toBe(2);
    expect(getByTestId('total-fare-text').props.children).toBe('10,00 lei');
  });

  it('calculates group fare with pass covering the 1st passenger', () => {
    useWalletStore.setState({ items: [mockCard, mockPass], defaultSourceId: 'card-1' });
    useRideStore.getState().detectVehicle({
      line: '15',
      vehicleId: '3114',
      vehicleType: 'Troleibuz',
      station: 'Piața Mărăști',
      destination: 'T. Grozăvescu (Poșta Mare)',
    });

    const { getByTestId } = renderModal();

    // 1 passenger: covered by pass = 0,00 lei
    expect(getByTestId('passenger-count-text').props.children).toBe(1);
    expect(getByTestId('total-fare-text').props.children).toBe('0,00 lei');

    // 2 passengers: 1 pass + 1 extra = 5,00 lei
    fireEvent.press(getByTestId('btn-increment-passengers'));
    expect(getByTestId('passenger-count-text').props.children).toBe(2);
    expect(getByTestId('total-fare-text').props.children).toBe('5,00 lei');
  });

  it('dismisses boarding prompt on ignore', () => {
    useRideStore.getState().detectVehicle({
      line: '15',
      vehicleId: '3114',
      vehicleType: 'Troleibuz',
      station: 'Piața Mărăști',
      destination: 'T. Grozăvescu (Poșta Mare)',
    });

    const { getByTestId } = renderModal();
    fireEvent.press(getByTestId('btn-ignore-boarding'));

    expect(useRideStore.getState().status).toBe('idle');
    expect(useRideStore.getState().detectedVehicle).toBeNull();
  });
});

describe('boarding pays automatically with the saved method (no card details at boarding)', () => {
  const vehicle = {
    line: '15',
    vehicleId: '3114',
    vehicleType: 'Troleibuz',
    station: 'Piața Mărăști',
    destination: 'T. Grozăvescu (Poșta Mare)',
  };

  beforeEach(() => {
    useRideStore.setState({ status: 'idle', detectedVehicle: null, passengerCount: 1, activeRide: null, toastMessage: null });
    useWalletStore.setState({ items: [mockCard], defaultSourceId: 'card-1', addMethodRequested: false });
  });

  it('3 people: 15 lei, shows the saved card it will charge', () => {
    useRideStore.getState().detectVehicle(vehicle);
    const { getByTestId } = renderModal();
    fireEvent.press(getByTestId('btn-increment-passengers'));
    fireEvent.press(getByTestId('btn-increment-passengers'));
    expect(getByTestId('total-fare-text').props.children).toBe('15,00 lei');
    expect(getByTestId('payment-source-text').props.children).toBe('Visa •• 4021');
  });

  it('no payment method: offers to add one instead of paying', () => {
    useWalletStore.setState({ items: [], defaultSourceId: null });
    useRideStore.getState().detectVehicle(vehicle);
    const { getByTestId, getByText } = renderModal();
    expect(getByTestId('payment-source-text').props.children).toBe('Nu ai încă o metodă de plată.');
    fireEvent.press(getByText('Adaugă metodă de plată'));
    expect(useWalletStore.getState().addMethodRequested).toBe(true);
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/wallet');
    expect(useRideStore.getState().status).not.toBe('detected');
  });

  it('paid: opens the Wallet and asks it to show the QR ticket', async () => {
    useWalletStore.setState({ ticketRequested: false });
    useRideStore.getState().detectVehicle(vehicle);
    const { getByTestId } = renderModal();
    fireEvent.press(getByTestId('btn-confirm-boarding'));
    await waitFor(() => expect(useWalletStore.getState().ticketRequested).toBe(true));
    expect(mockPush).toHaveBeenCalledWith('/(tabs)/wallet');
    expect(useRideStore.getState().activeTicket).not.toBeNull();
  });

  it('payment error is shown inside the prompt, which stays open', () => {
    useRideStore.getState().detectVehicle(vehicle);
    useRideStore.getState().setPaymentError('Plata nu a putut fi făcută.');
    const { getByTestId } = renderModal();
    expect(getByTestId('boarding-payment-error').props.children).toBe('Plata nu a putut fi făcută.');
    expect(getByTestId('btn-confirm-boarding')).toBeTruthy();
  });
});
