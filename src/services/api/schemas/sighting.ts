import { z } from 'zod';

/** Corpul `POST /api/v1/sightings` (contract: docs/phone.md). `rssi` e brut, în dBm. */
export const SightingSchema = z.object({
  bus_id: z.number().int().min(0).max(65535),
  slot: z.number().int().min(0),
  token: z.string().regex(/^[0-9a-f]{32}$/),
  rssi: z.number().int(),
  clock_synced: z.boolean(),
});

export type Sighting = z.infer<typeof SightingSchema>;
