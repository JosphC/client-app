import { z } from 'zod';
import { ApiError } from '../../api/http';
import { newIdempotencyKey, request } from '../../api/authedRequest';
import {
  chargeSchema,
  passProductSchema,
  walletItemSchema,
  type NewCardInput,
  type NewPassInput,
  type PassProduct,
  type WalletItem,
} from '../../api/schemas/wallet';
import type { WalletRepo } from '../types';

const itemsSchema = z.array(walletItemSchema);
const chargesSchema = z.array(chargeSchema);
const catalogSchema = z.array(passProductSchema);
const renewSchema = z.object({ item: walletItemSchema });

const DEFAULT_RENEW_DAYS = 30;

/** Charge-urile le creează serverul la `POST /rides/{id}/confirm`; aplicația nu are voie să le scrie. */
function serverOwned(action: string): never {
  throw new ApiError(0, 'VALIDATION_ERROR', `${action} is done by the server (POST /rides/{sessionId}/confirm).`);
}

/** Produsul de catalog pentru `days` zile: întâi cel valabil pe toate liniile, apoi cel mai ieftin. */
export function pickProduct(catalog: PassProduct[], days: number): PassProduct | null {
  const matching = catalog.filter((p) => p.days === days);
  const pool = matching.length > 0 ? matching : catalog;
  return [...pool].sort((a, b) => Number(b.lines === 'all') - Number(a.lines === 'all') || a.priceRon - b.priceRon)[0] ?? null;
}

/** Wallet real: numărul cardului nu ajunge niciodată aici, doar id-ul metodei de plată dat de procesator. */
export function createWalletRepoReal(): WalletRepo {
  const listItems = (): Promise<WalletItem[]> => request('/wallet/items', {}, itemsSchema);
  return {
    listItems,
    addCard: (input: NewCardInput) => request('/wallet/payment-methods', { method: 'POST', body: input }, walletItemSchema),
    addPass: (input: NewPassInput) => {
      if (!input.cardNumber) throw new ApiError(400, 'VALIDATION_ERROR', 'cardNumber is required for a pass.');
      return request('/wallet/passes', { method: 'POST', body: input }, walletItemSchema);
    },
    removeItem: (id: string) => request(`/wallet/items/${id}`, { method: 'DELETE' }),
    setDefaultSource: (id: string) => request('/wallet/default-source', { method: 'PUT', body: { id } }),
    renewPass: async (id: string, days: number = DEFAULT_RENEW_DAYS, sourceId?: string) => {
      const product = pickProduct(await request('/passes/catalog', {}, catalogSchema), days);
      const card = sourceId ?? (await listItems()).find((i) => i.kind === 'card')?.id;
      if (!product || !card) throw new ApiError(409, 'NO_PAYMENT_METHOD', 'No pass product or card available.');
      const body = { productId: product.id, sourceId: card };
      const { item } = await request(`/wallet/passes/${id}/renew`, { method: 'POST', body, idempotencyKey: newIdempotencyKey() }, renewSchema);
      return item;
    },
    listCharges: () => request('/charges?limit=100', {}, chargesSchema),
    createCharge: async () => serverOwned('Creating a charge'),
    updateCharge: async () => serverOwned('Updating a charge'),
  };
}
