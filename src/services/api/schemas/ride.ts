import { z } from 'zod';
import { chargeSchema } from './wallet';

export const rideStatusSchema = z.enum(['none', 'pending', 'awaiting_confirmation', 'payment_failed', 'confirmed', 'rejected', 'ended']);
export type RideStatus = z.infer<typeof rideStatusSchema>;

/** `GET /rides/current` și răspunsul la `confirm` / `decline` / `manual` (api-app.md 3.1). */
export const rideSchema = z.object({
  status: rideStatusSchema,
  sessionId: z.string().nullable(),
  updatedAt: z.string(),
  /** `null` = nu mai întreba. */
  pollAfterMs: z.number().int().positive().nullable(),
  vehicle: z.object({ busId: z.number().int(), line: z.string(), destination: z.string().optional() }).nullable(),
  candidates: z.array(z.object({ busId: z.number().int(), line: z.string() })).default([]),
  payment: z.object({ reason: z.string(), clientSecret: z.string().optional() }).nullable().default(null),
  charge: chargeSchema.nullable().default(null),
});
export type Ride = z.infer<typeof rideSchema>;

export interface ConfirmInput {
  passengers: number;
  sourceId?: string;
  /** Obligatoriu doar când cursa are `candidates`. */
  busId?: number;
}
