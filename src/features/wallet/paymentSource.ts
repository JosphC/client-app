import { SINGLE_FARE_RON } from '../../core/config';
import type { WalletItem } from './types';

export interface ChargeDecision {
  /** Card id, or the pass id when the pass covers everyone. */
  paidWith: string;
  /** The pass holder rides free. */
  amountCovered: boolean;
  /** Lei charged on the card right at boarding: passengers not covered by the pass × fare. */
  amount: number;
}

export class NoPaymentSourceError extends Error {
  constructor() {
    super('No payment source available');
    this.name = 'NoPaymentSourceError';
  }
}

export interface PaymentOptions {
  passengers?: number;
  fareRon?: number;
}

function passCoversLine(item: WalletItem, line: string, nowMs: number): boolean {
  if (item.kind !== 'pass') return false;
  if (new Date(item.validUntil).getTime() < nowMs) return false;
  return item.lines === 'all' || item.lines.includes(line);
}

/**
 * Pure source selection, the same rules the server applies:
 * 1. a valid pass for the line covers its holder; extra passengers still pay;
 * 2. the rest is charged on the default card, else on the first saved card;
 * 3. nothing to pay with → NoPaymentSourceError (the app offers to add a card).
 */
export function selectPaymentSource(
  items: WalletItem[],
  defaultSourceId: string | null,
  line: string,
  nowMs: number,
  { passengers = 1, fareRon = SINGLE_FARE_RON }: PaymentOptions = {},
): ChargeDecision {
  const pass = items.find((item) => passCoversLine(item, line, nowMs));
  const amount = Math.max(0, passengers - (pass ? 1 : 0)) * fareRon;
  if (pass && amount === 0) return { paidWith: pass.id, amountCovered: true, amount: 0 };

  const card = items.find((item) => item.id === defaultSourceId && item.kind === 'card') ?? items.find((item) => item.kind === 'card');
  if (!card) throw new NoPaymentSourceError();
  return { paidWith: card.id, amountCovered: pass !== undefined, amount };
}
