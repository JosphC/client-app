import { t } from '../../../core/i18n';
import type { NewCardInput, WalletPay } from '../types';
import { getPaymentProvider, PaymentProviderUnavailableError } from '../paymentProvider';

export type AddMethodResult = { ok: true } | { ok: false; message: string };

/**
 * Adding a payment method goes through the processor only: its secure card
 * form or the Google Pay / Apple Pay sheet. What comes back (payment method
 * id, network, last4, expiry) is saved; the card number never reaches EchoPass.
 */
export function usePaymentMethods(addCard: (input: NewCardInput) => Promise<unknown>) {
  const provider = getPaymentProvider();
  const walletPay: WalletPay | null = provider.walletPay();

  async function add(kind: 'card' | 'wallet'): Promise<AddMethodResult> {
    try {
      const method = kind === 'wallet' ? await provider.addWithWalletPay() : await provider.addCard();
      await addCard(method);
      return { ok: true };
    } catch (error) {
      const message =
        error instanceof PaymentProviderUnavailableError ? t('wallet.providerMissing') : t('wallet.paymentSetupFailed');
      return { ok: false, message };
    }
  }

  return { walletPay, add };
}
