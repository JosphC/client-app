import { Share } from 'react-native';
import { t } from '../../../../../core/i18n';
import type { Station } from '../../../../map/stations';
import type { StopArrivalItem } from '../../../hooks/useStopArrivals';

/** Distribuie stația cu primele 3 sosiri (sistemul de share al telefonului). */
export async function shareStation(station: Station, items: StopArrivalItem[]): Promise<void> {
  const topArrivals = items
    .slice(0, 3)
    .map((it) => `${it.arrival.route.shortName} -> ${it.arrival.headsign} (${it.minutesLeft} min)`)
    .join(', ');
  const next = topArrivals ? `${t('home.shareNext')}: ${topArrivals}` : t('home.shareNone');
  const message = `${t('home.shareStop')} ${station.name} (${station.lines.join(', ')}):\n${next}\nEchoPass`;
  try {
    await Share.share({ message });
  } catch {
    // Utilizatorul a închis foaia de share — nimic de făcut.
  }
}
