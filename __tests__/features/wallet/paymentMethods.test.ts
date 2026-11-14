import { getPaymentProvider } from '../../../src/features/wallet/paymentProvider';
import { createWalletRepoMock } from '../../../src/services/repositories/mock/walletRepo.mock';
import { newCardInputSchema } from '../../../src/services/api/schemas/wallet';

describe('payment methods through the processor (no card number in the app)', () => {
  it('a card from the secure form is saved only as the processor payment method id', async () => {
    const method = await getPaymentProvider().addCard();
    expect(newCardInputSchema.parse(method)).toEqual(method);
    expect(Object.keys(method)).not.toContain('pan');
    const item = await createWalletRepoMock().addCard(method);
    expect(item.kind).toBe('card');
    if (item.kind === 'card') {
      expect(item.token).toBe(method.paymentMethodId);
      expect(item.last4).toHaveLength(4);
    }
  });

  it('Google Pay / Apple Pay cards are tagged so the wallet shows where they come from', async () => {
    const provider = getPaymentProvider();
    expect(provider.walletPay()).not.toBeNull();
    const item = await createWalletRepoMock().addCard(await provider.addWithWalletPay());
    expect(item.kind === 'card' && item.tag).toMatch(/Google Pay|Apple Pay/);
  });
});
