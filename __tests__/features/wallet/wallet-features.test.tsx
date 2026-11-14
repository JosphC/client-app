import { fireEvent, render } from '@testing-library/react-native';
import { ActiveRideCard } from '../../../src/features/wallet/components/ActiveRideCard';
import { WalletManageCard } from '../../../src/features/wallet/components/actions/WalletManageCard';
import { RenewPassSheet } from '../../../src/features/wallet/components/actions/RenewPassSheet';
import type { WalletItem } from '../../../src/features/wallet/types';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

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
  validUntil: '2026-11-02',
  lines: 'all',
  theme: 'ocean',
};

describe('Wallet Mature Features', () => {

  it('ActiveRideCard renders 60-min countdown and triggers inspector QR on press', () => {
    const onOpenInspector = jest.fn();

    const { getByTestId, getByText, getAllByText } = render(
      <ActiveRideCard
        line="15"
        destination="T. Grozăvescu (Poșta Mare)"
        boardedAt="18:24"
        expiresInMin={42}
        totalMin={60}
        onOpenInspector={onOpenInspector}
      />,
    );

    expect(getByText(/călătorie activă/i)).toBeTruthy();
    expect(getByText(/42 min/)).toBeTruthy();
    expect(getByText(/rămase/)).toBeTruthy();
    expect(getByText(/T. Grozăvescu/)).toBeTruthy();
    expect(getByText(/\(Poșta Mare\)/)).toBeTruthy();
    // QR label renders in two tones once layout is known (white over vivid
    // fill, dark over drained base); the dark layer is hidden from screen
    // readers, and layout never fires in Jest, so trigger it manually.
    const hiddenOpts = { includeHiddenElements: true };
    expect(getAllByText(/Arată codul QR/, hiddenOpts)).toHaveLength(1);
    fireEvent(getByTestId('show-qr-button'), 'layout', {
      nativeEvent: { layout: { width: 320, height: 46 } },
    });
    expect(getAllByText(/Arată codul QR/, hiddenOpts)).toHaveLength(2);

    fireEvent.press(getByTestId('active-ride-card'));
    expect(onOpenInspector).toHaveBeenCalledTimes(1);
  });

  it('WalletManageCard renders pass info and triggers renew for pass item', () => {
    const onOpenRenew = jest.fn();

    const { getByTestId, getByText } = render(
      <WalletManageCard
        item={mockPass}
        onOpenRenew={onOpenRenew}
      />,
    );

    expect(getByText('Valabil până la')).toBeTruthy();
    expect(getByText(/Toate liniile urbane STPT/)).toBeTruthy();
    fireEvent.press(getByTestId('btn-renew-pass'));
    expect(onOpenRenew).toHaveBeenCalledTimes(1);
  });

  it('WalletManageCard returns null for bank card because payments are directly from bank card', () => {
    const onOpenRenew = jest.fn();

    const { toJSON } = render(
      <WalletManageCard
        item={mockCard}
        onOpenRenew={onOpenRenew}
      />,
    );

    expect(toJSON()).toBeNull();
  });

  it('RenewPassSheet lets user extend pass and confirms renewal', () => {
    const onRenew = jest.fn();
    const onClose = jest.fn();

    const { getByText } = render(
      <RenewPassSheet
        visible={true}
        passItem={mockPass}
        onClose={onClose}
        onRenew={onRenew}
      />,
    );

    fireEvent.press(getByText(/Confirmă reînnoirea/));
    expect(onRenew).toHaveBeenCalledWith(30);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('RenewPassSheet lists all official STPT passes and renews annual for 365 days', () => {
    const onRenew = jest.fn();
    const onClose = jest.fn();

    const { getByTestId, getByText } = render(
      <RenewPassSheet
        visible={true}
        passItem={mockPass}
        onClose={onClose}
        onRenew={onRenew}
      />,
    );

    for (const id of ['general-30', 'linie-30', 'expres-30', 'general-365', 'nominalizat-30', 'nominalizat-30-plus', 'nenominalizat-30']) {
      expect(getByTestId(`pass-option-${id}`)).toBeTruthy();
    }
    fireEvent.press(getByTestId('pass-option-general-365'));
    fireEvent.press(getByText(/Confirmă reînnoirea/));
    expect(onRenew).toHaveBeenCalledWith(365);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
