import { create } from 'zustand';
import type { Sighting } from '../../../services/api/schemas/sighting';
import type { BlePoll } from '../types';

/** Jurnal în memorie pentru testarea beaconurilor (ecranul „Jurnal BLE"): ce recepționează aplicația și ce răspunde serverul. */
export const BLE_LOG_MAX = 200;
/** Un beacon apare în jurnal cel mult o dată pe secundă (altfel ~5 pachete/s îl inundă). */
const SAMPLE_EVERY_MS = 1000;

export type BleLogKind = 'info' | 'sample' | 'sighting';

export interface BleLogEntry {
  id: number;
  atMs: number;
  kind: BleLogKind;
  text?: string;
  busId?: string;
  rssi?: number | null;
  slot?: number;
  token?: string;
  clockSynced?: boolean;
  /** Răspunsul serverului pentru un sighting, sau 'offline' când cererea a eșuat în rețea. */
  status?: number | 'offline';
}

/** Contoare mutabile (nu declanșează randări la fiecare pachet); ecranul le citește o dată pe secundă. */
export const bleStats = { heard: 0, ours: 0, lastOursAtMs: 0, scanning: false, posted: 0, ok: 0, failed: 0 };

interface BleLogState {
  entries: BleLogEntry[];
  push: (entry: Omit<BleLogEntry, 'id'>) => void;
  clear: () => void;
}

let nextId = 1;
const lastSample = new Map<string, { atMs: number; slot: number | undefined }>();
const lastOther = new Map<string, number>();
const OTHER_EVERY_MS = 10_000;

export const useBleLog = create<BleLogState>()((set) => ({
  entries: [],
  push: (entry) => set((s) => ({ entries: [{ ...entry, id: nextId++ }, ...s.entries].slice(0, BLE_LOG_MAX) })),
  clear: () => {
    bleStats.heard = 0;
    bleStats.ours = 0;
    bleStats.lastOursAtMs = 0;
    bleStats.posted = 0;
    bleStats.ok = 0;
    bleStats.failed = 0;
    lastSample.clear();
    lastOther.clear();
    set({ entries: [] });
  },
}));

export const bleLog = {
  info(text: string): void {
    useBleLog.getState().push({ atMs: Date.now(), kind: 'info', text });
  },
  /** Orice pachet BLE auzit (inclusiv de la dispozitive străine) și dacă e de la un autobuz EchoPass. */
  heard(ours: boolean): void {
    bleStats.heard += 1;
    if (ours) {
      bleStats.ours += 1;
      bleStats.lastOursAtMs = Date.now();
    }
  },
  /** Diagnostic: ceva ce seamănă cu beaconul nostru, dar nu e acceptat (alt UUID). Cel mult o dată la 10 s per adresă. */
  other(address: string, text: string): void {
    const now = Date.now();
    if (now - (lastOther.get(address) ?? 0) < OTHER_EVERY_MS) return;
    lastOther.set(address, now);
    useBleLog.getState().push({ atMs: now, kind: 'info', text });
  },
  /** Un beacon recepționat: bus (minor), RSSI și, dacă există, slotul + tokenul din scan response. */
  sample(poll: BlePoll): void {
    const now = Date.now();
    const slot = poll.proof?.slot;
    const prev = lastSample.get(poll.deviceId);
    if (prev && now - prev.atMs < SAMPLE_EVERY_MS && prev.slot === slot) return;
    lastSample.set(poll.deviceId, { atMs: now, slot });
    useBleLog.getState().push({
      atMs: now,
      kind: 'sample',
      busId: poll.deviceId,
      rssi: poll.rssi,
      slot,
      token: poll.proof?.token,
      clockSynced: poll.proof?.clockSynced,
    });
  },
  /** Ce s-a trimis la server și ce a răspuns (200/400/401/422 sau 'offline'). */
  sighting(s: Sighting, status: number | 'offline', detail?: string): void {
    bleStats.posted += 1;
    if (status === 200) bleStats.ok += 1;
    else bleStats.failed += 1;
    useBleLog.getState().push({
      text: detail,
      atMs: Date.now(),
      kind: 'sighting',
      busId: String(s.bus_id),
      rssi: s.rssi,
      slot: s.slot,
      token: s.token,
      clockSynced: s.clock_synced,
      status,
    });
  },
};
