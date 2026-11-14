import type { Charge } from '../types';
import { useWalletStore } from '../walletStore';
import { NoPaymentSourceError, selectPaymentSource } from '../paymentSource';
import { useSettingsStore } from '../../settings';
import { useCharges } from './useCharges';

export interface RideCharge {
  charge: Charge;
  coveredByPass: boolean;
  passengers: number;
}

/**
 * Wallet side of the ride contract (called by `ride` on CHECKED_IN/CHECK_OUT in Phase 6).
 * Reads `autoCharge` from the settings store: OFF (default) means ask first, ON means charge now.
 */
export function useAutoCharge() {
  const items = useWalletStore((s) => s.items);
  const defaultSourceId = useWalletStore((s) => s.defaultSourceId);
  const autoCharge = useSettingsStore((s) => s.autoCharge);
  const { createCharge, updateCharge } = useCharges();

  /** Charged on the card right at boarding; the pass covers its holder (see selectPaymentSource). */
  async function charge(line: string, nowMs: number, passengers: number): Promise<RideCharge> {
    const decision = selectPaymentSource(items, defaultSourceId, line, nowMs, { passengers });
    const created = await createCharge({ line, amount: decision.amount, paidWith: decision.paidWith, status: 'in_progress' });
    return { charge: created, coveredByPass: decision.amountCovered, passengers };
  }

  /** CHECKED_IN with auto payment: creates an `in_progress` charge immediately. Returns null when confirmation is required. */
  async function startRideCharge(
    line: string,
    nowMs: number = Date.now(),
    passengers: number = 1,
  ): Promise<RideCharge | null> {
    if (!autoCharge) return null;
    return charge(line, nowMs, passengers);
  }

  /** CHECKED_IN after the user pressed OK in the boarding notice. */
  async function confirmRideCharge(
    line: string,
    nowMs: number = Date.now(),
    passengers: number = 1,
  ): Promise<RideCharge> {
    return charge(line, nowMs, passengers);
  }

  /** CHECK_OUT: covered by pass or completed + ended timestamp. */
  async function finishRideCharge(charge: Charge): Promise<Charge> {
    const status = charge.amount === 0 ? 'covered_by_pass' : 'completed';
    return updateCharge({ id: charge.id, patch: { status, endedAt: new Date().toISOString() } });
  }

  return { startRideCharge, confirmRideCharge, finishRideCharge, NoPaymentSourceError };
}
