import { Image, StyleSheet, View } from 'react-native';
import { PointAnnotation } from '@maplibre/maplibre-react-native';
import stationStopIcon from '../../../../assets/station-stop.png';
import type { Station } from '../../stations';
import type { MapPinPoint } from './LiveMap';

/** Stație: același simbol de autobuz ca pe hartă, mereu deasupra straturilor. */
export function StationPin({ station }: { station: Station }) {
  return (
    <PointAnnotation id={`station-${station.id}`} coordinate={[station.lng, station.lat]} title={station.name}>
      <Image source={stationStopIcon} style={styles.icon} accessibilityIgnoresInvertColors />
    </PointAnnotation>
  );
}

/** Pin de origine / destinație al rutei planificate (același stil ca stația). */
export function PlacePin({ id, pin, color }: { id: string; pin?: MapPinPoint | null; color: string }) {
  if (!pin) return null;
  return (
    <PointAnnotation id={id} coordinate={[pin.lng, pin.lat]} title={pin.title}>
      <View style={[styles.dot, { backgroundColor: color }]} />
    </PointAnnotation>
  );
}

const styles = StyleSheet.create({
  icon: { height: 32, width: 32 },
  dot: {
    alignItems: 'center',
    borderColor: '#FFFFFF',
    borderRadius: 9,
    borderWidth: 3,
    height: 18,
    justifyContent: 'center',
    width: 18,
  },
});
