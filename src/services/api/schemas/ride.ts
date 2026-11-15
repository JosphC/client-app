import { z } from 'zod';
import { chargeSchema } from './wallet';

export const rideStatusSchema = z.enum(['none', 'pending', 'awaiting_confirmation', 'payment_failed', 'confirmed', 'rejected', 'ended']);
export type RideStatus = z.infer<typeof rideStatusSchema>;

/**
 * Unde e autobuzul cursei plătite și stația următoare, din poziția ESP32 (backend-de-implementat.md 3.3.1).
 * Doar la `confirmed`; `position` și `nextStop` sunt `null` când poziția e mai veche de 30 s.
 */
export const rideProgressSchema = z.object({
  position: z
    .object({
      lat: z.number(),
      lng: z.number(),
      speedKmh: z.number().nullable().optional(),
      at: z.string(),
      simulated: z.boolean().optional(),
    })
    .nullable()
    .default(null),
  boardedStop: z.string().nullable().default(null),
  nextStop: z
    .object({ index: z.number().int().min(0), name: z.string(), distanceM: z.number(), etaSec: z.number() })
    .nullable()
    .default(null),
  stops: z.array(z.object({ name: z.string(), lat: z.number(), lng: z.number(), passed: z.boolean() })).default([]),
});
export type RideProgress = z.infer<typeof rideProgressSchema>;

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
  progress: rideProgressSchema.nullable().default(null),
});
export type Ride = z.infer<typeof rideSchema>;

export interface ConfirmInput {
  passengers: number;
  sourceId?: string;
  /** Obligatoriu doar când cursa are `candidates`. */
  busId?: number;
}
