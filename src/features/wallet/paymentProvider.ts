import { Platform } from 'react-native';
import { env } from '../../core/config';
import type { NewCardInput, WalletPay } from './types';

/**
 * Payment processor on the phone (Stripe / Adyen / Netopia SDK once chosen).
 * The processor shows its own secure card form or the Google Pay / Apple Pay
 * sheet and returns a payment method id saved for later off-session charges.
 * EchoPass never sees or stores the card number.
 */
export interface PaymentProvider {
  /** Wallet button this phone can offer, or null (old phone, no Google services, not enrolled…). */
  walletPay(): WalletPay | null;
  /** Card through the processor's secure form (3-D Secure once, authorises later charges). */
  addCard(): Promise<NewCardInput>;
  /** Card already in Google Pay / Apple Pay: one tap + fingerprint/face. */
  addWithWalletPay(): Promise<NewCardInput>;
}

export class PaymentProviderUnavailableError extends Error {
  constructor() {
    super('Payment processor not configured');
    this.name = 'PaymentProviderUnavailableError';
  }
}

let counter = 0;

/** Test processor: returns processor test cards instantly (mock mode only). */
function createMockProvider(): PaymentProvider {
  const nextId = (): string => {
    counter += 1;
    return `pm_test_${Date.now().toString(36)}_${counter}`;
  };
  return {
    walletPay: () => (Platform.OS === 'ios' ? 'apple_pay' : 'google_pay'),
    addCard: async () => ({ paymentMethodId: nextId(), network: 'visa', last4: '4242', holder: 'Card de test', expiry: '12/30' }),
    addWithWalletPay: async () => ({
      paymentMethodId: nextId(),
      walletPay: Platform.OS === 'ios' ? 'apple_pay' : 'google_pay',
      network: 'mastercard',
      last4: '4444',
      holder: 'Card de test',
      expiry: '12/30',
    }),
  };
}

/** Real processor: wired when the processor is chosen; until then it refuses explicitly. */
function createUnconfiguredProvider(): PaymentProvider {
  return {
    walletPay: () => null,
    addCard: async () => {
      throw new PaymentProviderUnavailableError();
    },
    addWithWalletPay: async () => {
      throw new PaymentProviderUnavailableError();
    },
  };
}

let cached: PaymentProvider | null = null;

export function getPaymentProvider(): PaymentProvider {
  cached ??= env.useMocks || env.useTestPayments ? createMockProvider() : createUnconfiguredProvider();
  return cached;
}
