import { useServerRide } from '../hooks/useServerRide';

/** Montat o dată în rădăcină: ține cursa din aplicație în acord cu serverul. Nu desenează nimic. */
export function ServerRideSync() {
  useServerRide();
  return null;
}
