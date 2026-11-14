import { Logger } from '@maplibre/maplibre-react-native';
import { isMapNativeAvailable } from './mapStyle';

interface NativeMapLog {
  message: string;
  level: string;
  tag?: string;
}

/** Erori de rețea ale motorului nativ la descărcarea tile-urilor/stilului (offline, DNS, timeout). */
const NETWORK_FAILURE =
  /Unable to resolve host|No address associated with hostname|Unable to connect|Failed to connect|timed out|timeout|Network is unreachable|Connection (reset|refused|closed)|Software caused connection abort/i;

/**
 * Log nativ MapLibre care apare firesc fără rețea sau fără locație (telefon în avion, emulator
 * fără GPS) și nu e un bug al aplicației. Fără filtru, fiecare ajunge `console.error` și acoperă
 * ecranul cu LogBox în dev. Harta continuă cu ce are în cache / arată lista de rezervă.
 */
export function isTransientMapLog({ message, level, tag }: NativeMapLog): boolean {
  if (level !== 'error') return false;
  if (tag === 'Mbgl-LocationComponent' && message.includes('Failed to obtain last location update')) return true;
  return (tag ?? '').startsWith('Mbgl') && NETWORK_FAILURE.test(message);
}

let installed = false;

/** Înregistrează filtrul o singură dată; nu face nimic dacă build-ul nu include modulul nativ. */
export function installMapLogFilter(): void {
  if (installed || !isMapNativeAvailable()) return;
  installed = true;
  // `true` = log tratat (înghițit); orice altă eroare MapLibre rămâne vizibilă ca până acum.
  Logger.setLogCallback((log) => isTransientMapLog(log));
}
