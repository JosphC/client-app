/** UUID iBeacon comun tuturor autobuzelor (docs/phone.md); nu e secret, doar filtrează scanarea. */
export const BEACON_UUID = 'd22b117c-2f6e-4d74-9e9f-6f09213c3dd0';

const APPLE_COMPANY = 0x004c;
const PROOF_COMPANY = 0xffff;
const PROOF_VERSION = 0x02;

export interface BeaconAdvert {
  routeId: number;
  busId: number;
}

export interface BeaconProof {
  slot: number;
  /** 16 octeți → 32 de caractere hex mici. */
  token: string;
  clockSynced: boolean;
}

export interface ParsedBeacon {
  advert: BeaconAdvert | null;
  /** Lipsește până când autobuzul are timp (scan response absent). */
  proof: BeaconProof | null;
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** base64 → octeți (rawScanRecord din react-native-ble-plx). Caractere invalide sunt ignorate. */
export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out: number[] = [];
  let acc = 0;
  let bits = 0;
  for (const ch of clean) {
    acc = (acc << 6) | B64.indexOf(ch);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

function hex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const UUID_HEX = BEACON_UUID.replace(/-/g, '');

function parseAdvert(p: Uint8Array): BeaconAdvert | null {
  if (p.length < 23 || p[0] !== 0x02 || p[1] !== 0x15) return null;
  if (hex(p.subarray(2, 18)) !== UUID_HEX) return null;
  return { routeId: (p[18] << 8) | p[19], busId: (p[20] << 8) | p[21] };
}

function parseProof(p: Uint8Array): BeaconProof | null {
  if (p.length < 22 || p[0] !== PROOF_VERSION) return null;
  const slot = ((p[2] << 24) | (p[3] << 16) | (p[4] << 8) | p[5]) >>> 0;
  return { slot, token: hex(p.subarray(6, 22)), clockSynced: (p[1] & 0x01) !== 0 };
}

/**
 * Parsează un scan record BLE brut (structuri AD: len, tip, date). Android poate livra
 * advertul și scan response-ul împreună sau separat, deci fiecare parte poate lipsi.
 */
export function parseScanRecord(bytes: Uint8Array): ParsedBeacon {
  const result: ParsedBeacon = { advert: null, proof: null };
  let i = 0;
  while (i < bytes.length) {
    const len = bytes[i];
    // Octeți 0 de umplere (Android poate lăsa așa între advert și scan response): îi sărim, altfel tokenul din
    // scan response nu s-ar mai citi. Orice structură AD validă are lungimea nenulă.
    if (len === 0) {
      i += 1;
      continue;
    }
    if (i + 1 + len > bytes.length) break;
    if (bytes[i + 1] === 0xff && len >= 3) {
      const company = bytes[i + 2] | (bytes[i + 3] << 8);
      const payload = bytes.subarray(i + 4, i + 1 + len);
      if (company === APPLE_COMPANY) result.advert = parseAdvert(payload) ?? result.advert;
      else if (company === PROOF_COMPANY) result.proof = parseProof(payload) ?? result.proof;
    }
    i += len + 1;
  }
  return result;
}

export interface OtherBeacon {
  kind: 'ibeacon' | 'proof';
  uuid?: string;
  major?: number;
  minor?: number;
}

function formatUuid(b: Uint8Array): string {
  const h = hex(b);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/**
 * Doar pentru diagnostic (jurnalul BLE): un iBeacon cu ALT UUID sau un pachet 0xFFFF, adică ceva care seamănă cu
 * beaconul nostru dar nu e acceptat. Nu intră în detecție; ajută la a vedea dacă ESP32 emite alt UUID.
 */
export function describeOtherBeacon(bytes: Uint8Array): OtherBeacon | null {
  let i = 0;
  while (i < bytes.length) {
    const len = bytes[i];
    if (len === 0) {
      i += 1;
      continue;
    }
    if (i + 1 + len > bytes.length) break;
    if (bytes[i + 1] === 0xff && len >= 3) {
      const company = bytes[i + 2] | (bytes[i + 3] << 8);
      const p = bytes.subarray(i + 4, i + 1 + len);
      if (company === APPLE_COMPANY && p.length >= 23 && p[0] === 0x02 && p[1] === 0x15) {
        return {
          kind: 'ibeacon',
          uuid: formatUuid(p.subarray(2, 18)),
          major: (p[18] << 8) | p[19],
          minor: (p[20] << 8) | p[21],
        };
      }
      if (company === PROOF_COMPANY) return { kind: 'proof' };
    }
    i += len + 1;
  }
  return null;
}
