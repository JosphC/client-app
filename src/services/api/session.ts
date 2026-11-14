import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserTier = 'anonymous' | 'account';

export interface Session {
  userId: string;
  tier: UserTier;
  accessToken: string;
  refreshToken: string;
  /** Epoch ms la care expiră access token-ul. */
  accessExpiresAtMs: number;
}

const KEY = 'echopass-session';
let cache: Session | null = null;
let loaded = false;

/** Sesiunea curentă (citită o singură dată de pe disc, apoi din memorie). */
export async function readSession(): Promise<Session | null> {
  if (!loaded) {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      cache = raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      cache = null;
    }
    loaded = true;
  }
  return cache;
}

/** Scrie ÎNTÂI pe disc: refresh token-ul vechi e invalid imediat după un refresh reușit. */
export async function writeSession(session: Session): Promise<void> {
  cache = session;
  loaded = true;
  await AsyncStorage.setItem(KEY, JSON.stringify(session));
}

export async function clearSession(): Promise<void> {
  cache = null;
  loaded = true;
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // sesiunea din memorie e deja ștearsă; la următoarea pornire discul e oricum ignorat dacă tokenul e invalid
  }
}
