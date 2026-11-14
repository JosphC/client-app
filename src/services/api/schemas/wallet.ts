import { z } from 'zod';

export const passSchema = z.object({
  id: z.string().min(1),
  holderName: z.string().min(1),
  email: z.string().email().optional(),
  validUntil: z.string().date(),
  daysLeft: z.number().int().min(0),
});
export type Pass = z.infer<typeof passSchema>;

export const paymentMethodSchema = z.object({
  id: z.string().min(1),
  brand: z.string().min(1),
  last4: z.string().length(4),
});
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

export const cardNetworkSchema = z.enum(['visa', 'mastercard', 'other']);
export type CardNetwork = z.infer<typeof cardNetworkSchema>;

export const passThemeSchema = z.enum(['ocean', 'sunset', 'forest']);
export type PassTheme = z.infer<typeof passThemeSchema>;

const cardItemSchema = z.object({
  kind: z.literal('card'),
  id: z.string().min(1),
  network: cardNetworkSchema,
  last4: z.string().length(4),
  holder: z.string().min(1),
  expiry: z.string().regex(/^\d{2}\/\d{2}$/),
  token: z.string().min(1),
  bank: z.string().min(1).optional(),
  tag: z.string().min(1).optional(),
});

const passItemSchema = z.object({
  kind: z.literal('pass'),
  id: z.string().min(1),
  name: z.string().min(1),
  holder: z.string().min(1),
  validFrom: z.string().date(),
  validUntil: z.string().date(),
  lines: z.union([z.literal('all'), z.array(z.string().min(1)).min(1)]),
  theme: passThemeSchema,
  cardNumber: z.string().min(1).optional(),
  /** Setat de server; pe serverul real un abonament neverificat nu plătește cursa. */
  verified: z.boolean().optional(),
});

export const walletItemSchema = z.discriminatedUnion('kind', [cardItemSchema, passItemSchema]);
export type WalletItem = z.infer<typeof walletItemSchema>;

/** Wallet button (Google Pay / Apple Pay) used to add the card, when any. */
export const walletPaySchema = z.enum(['google_pay', 'apple_pay']);
export type WalletPay = z.infer<typeof walletPaySchema>;

/**
 * A card is added through the payment processor's secure sheet (or Google /
 * Apple Pay): the app never sees the card number, only what the processor returns.
 */
export const newCardInputSchema = z.object({
  /** Processor payment method id, saved for later off-session charges. */
  paymentMethodId: z.string().min(1),
  walletPay: walletPaySchema.optional(),
  network: cardNetworkSchema,
  last4: z.string().length(4),
  holder: z.string().min(1),
  expiry: z.string().regex(/^\d{2}\/\d{2}$/),
});
export type NewCardInput = z.infer<typeof newCardInputSchema>;

export const newPassInputSchema = z.object({
  /** Cerut de server (`POST /wallet/passes`). */
  cardNumber: z.string().min(1).optional(),
  name: z.string().min(1),
  holder: z.string().min(1),
  validUntil: z.string().date(),
  lines: z.union([z.literal('all'), z.array(z.string().min(1)).min(1)]),
  theme: passThemeSchema,
});
export type NewPassInput = z.infer<typeof newPassInputSchema>;

export const chargeStatusSchema = z.enum(['in_progress', 'completed', 'covered_by_pass', 'cancelled']);
export type ChargeStatus = z.infer<typeof chargeStatusSchema>;

export const chargeSchema = z.object({
  id: z.string().min(1),
  line: z.string().min(1),
  destination: z.string().min(1).optional(),
  amount: z.number().min(0),
  currency: z.literal('RON'),
  status: chargeStatusSchema,
  paidWith: z.string().min(1),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime().optional(),
  qrToken: z.string().min(1),
});
export type Charge = z.infer<typeof chargeSchema>;

export const passProductSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  days: z.number().int().min(1),
  priceRon: z.number().min(0),
  lines: z.union([z.literal('all'), z.array(z.string().min(1)).min(1)]),
});
export type PassProduct = z.infer<typeof passProductSchema>;
