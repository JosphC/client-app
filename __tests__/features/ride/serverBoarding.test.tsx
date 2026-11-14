import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { useServerBoarding } from '../../../src/features/ride/hooks/useServerBoarding';
import { useRideStore } from '../../../src/features/ride/rideStore';
import { useWalletStore } from '../../../src/features/wallet/walletStore';
import { ApiError } from '../../../src/services/api/http';
import * as rideRepo from '../../../src/services/repositories/real/rideRepo';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../../../src/services/repositories/real/rideRepo');
const repo = rideRepo as jest.Mocked<typeof rideRepo>;

const card = { kind: 'card', id: 'card-1', network: 'visa', last4: '4242', holder: 'A', expiry: '12/30', token: 'pm' } as const;
const pass = { kind: 'pass', id: 'pass-1', name: 'L', holder: 'A', validFrom: '2026-01-01', validUntil: '2099-01-01', lines: 'all', theme: 'ocean' } as const;
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
const ride = {
  status: 'confirmed', sessionId: 's1', updatedAt: 'x', pollAfterMs: 15000, vehicle: { busId: 101, line: 'E2' }, candidates: [], payment: null,
  charge: { id: 'c1', line: 'E2', amount: 5, currency: 'RON', status: 'in_progress', paidWith: 'card-1', startedAt: '2026-11-14T09:14:54Z', qrToken: 'a.b.c' },
} as const;

beforeEach(() => {
  jest.resetAllMocks();
  const s = useRideStore.getState();
  s.resetAll();
  s.detectVehicle({ line: 'E2', vehicleId: '101', vehicleType: 'Autobuz', station: '', destination: '' });
  s.setServerRide({ sessionId: 's1', candidates: [], busId: 101 });
  useWalletStore.setState({ items: [card], defaultSourceId: 'card-1' });
});

describe('plata prin server', () => {
  it('confirm trimite pasagerii și sursa, apoi activează biletul', async () => {
    repo.confirmRide.mockResolvedValue(ride as never);
    const { result } = renderHook(() => useServerBoarding(), { wrapper });
    await act(() => result.current.confirm(1));
    expect(repo.confirmRide).toHaveBeenCalledWith('s1', { passengers: 1, sourceId: 'card-1', busId: undefined });
    expect(useRideStore.getState().activeRide?.chargeId).toBe('c1');
  });

  it('abonament neacceptat (NO_PAYMENT_METHOD) → reîncearcă cu cardul', async () => {
    useWalletStore.setState({ items: [card, pass], defaultSourceId: 'card-1' });
    repo.confirmRide
      .mockRejectedValueOnce(new ApiError(409, 'NO_PAYMENT_METHOD', 'Pay with a card instead.'))
      .mockResolvedValueOnce(ride as never);
    const { result } = renderHook(() => useServerBoarding(), { wrapper });
    await act(() => result.current.confirm(1));
    expect(repo.confirmRide).toHaveBeenNthCalledWith(1, 's1', expect.objectContaining({ sourceId: 'pass-1' }));
    expect(repo.confirmRide).toHaveBeenNthCalledWith(2, 's1', expect.objectContaining({ sourceId: 'card-1' }));
    expect(useRideStore.getState().activeRide).not.toBeNull();
  });

  it('ACCOUNT_REQUIRED → închide promptul și duce la login', async () => {
    repo.confirmRide.mockRejectedValue(new ApiError(403, 'ACCOUNT_REQUIRED', 'x'));
    const { result } = renderHook(() => useServerBoarding(), { wrapper });
    await act(() => result.current.confirm(1));
    expect(mockPush).toHaveBeenCalledWith('/auth');
    expect(useRideStore.getState().status).toBe('idle');
  });

  it('PAYMENT_DECLINED → promptul rămâne deschis pentru reîncercare', async () => {
    repo.confirmRide.mockRejectedValue(new ApiError(402, 'PAYMENT_DECLINED', 'x', 'card_declined'));
    const { result } = renderHook(() => useServerBoarding(), { wrapper });
    await act(() => result.current.confirm(1));
    expect(useRideStore.getState().status).toBe('detected');
    expect(useRideStore.getState().toastMessage).toBeTruthy();
  });

  it('decline închide local și anunță serverul', async () => {
    repo.declineRide.mockResolvedValue(ride as never);
    const { result } = renderHook(() => useServerBoarding(), { wrapper });
    await act(async () => result.current.decline());
    expect(repo.declineRide).toHaveBeenCalledWith('s1');
    expect(useRideStore.getState().status).toBe('idle');
  });
});
