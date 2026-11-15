import { SINGLE_FARE_RON } from '../../../core/config';
import { t } from '../../../core/i18n';
import { formatLei } from '../../../core/utils/format';
import { selectPaymentSource, type ChargeDecision } from '../../wallet/paymentSource';
import { useWalletStore } from '../../wallet/walletStore';

export interface BoardingPayment {
  /** Null when nothing can pay: the prompt offers to add a payment method instead. */
  decision: ChargeDecision | null;
  /** Why nothing can pay (no card saved). */
  problem: string | null;
  totalText: string;
  breakdown: string;
  /** "Visa •• 4242", "Google Pay •• 4444", "Abonament". */
  sourceLabel: string;
}

/**
 * What the boarding prompt shows for N passengers, computed with the exact
 * rules used to charge (selectPaymentSource): pass for its holder, then the
 * saved card, charged right away. No card details are ever asked at boarding.
 */
export function useBoardingPayment(line: string, passengers: number, nowMs: number = Date.now()): BoardingPayment {
  const items = useWalletStore((s) => s.items);
  const defaultSourceId = useWalletStore((s) => s.defaultSourceId);
  const fareText = formatLei(SINGLE_FARE_RON);

  let decision: ChargeDecision | null = null;
  let problem: string | null = null;
  try {
    decision = selectPaymentSource(items, defaultSourceId, line, nowMs, { passengers });
  } catch {
    problem = t('ride.noPaymentMethod');
  }

  const covered = decision?.amountCovered ?? false;
  const breakdown = covered
    ? passengers === 1
      ? t('ride.passOne')
      : `${t('ride.passShort')} + ${passengers - 1} × ${fareText}`
    : `${passengers} × ${fareText}`;
  const amount = decision?.amount ?? passengers * SINGLE_FARE_RON;

  let sourceLabel = '';
  if (decision) {
    const card = items.find((i) => i.id === decision?.paidWith && i.kind === 'card');
    if (card?.kind === 'card') sourceLabel = `${card.tag ?? (card.network === 'mastercard' ? 'Mastercard' : card.network === 'visa' ? 'Visa' : t('wallet.otherNetwork'))} •• ${card.last4}`;
    else sourceLabel = t('ride.passSource');
  }

  return { decision, problem, totalText: formatLei(amount), breakdown, sourceLabel };
}
