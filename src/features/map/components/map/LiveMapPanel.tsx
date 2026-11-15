import { MarkerView } from '@maplibre/maplibre-react-native';
import { StyleSheet, View } from 'react-native';
import { spacing } from '../../../../core/theme';
import type { BusMarker } from '../../hooks/useLiveMap';
import type { Station } from '../../stations';
import type { LatLng } from '../../arrivals';
import { LiveMap, type MapPinPoint, type MapRouteSegment } from './LiveMap';
import { BusListFallback } from './BusListFallback';
import { MapErrorBoundary } from './MapErrorBoundary';
import { BusPopup } from '../overlays/BusPopup';
import { isMapNativeAvailable } from '../../mapStyle';

interface LiveMapPanelProps {
  markers: BusMarker[];
  station: Station | null;
  highlightStation?: Station | null;
  selectedId: string | null;
  followed: BusMarker | null;
  located: boolean;
  onSelect: (id: string) => void;
  onLocated: () => void;
  popup: BusMarker | null;
  popupTracked: boolean;
  onTrackPopup: () => void;
  onClosePopup: () => void;
  centerTrigger?: number;
  userCoords?: LatLng | null;
  extraStations?: Station[];
  routeSegments?: MapRouteSegment[];
  routeFitCoords?: LatLng[];
  originPin?: MapPinPoint | null;
  destPin?: MapPinPoint | null;
  routeEdgePadding?: { top: number; right: number; bottom: number; left: number };
  mapPadding?: { top: number; right: number; bottom: number; left: number };
  bottomOffset?: number;
  onMapPress?: () => void;
  /** Utilizatorul a mutat harta cu degetul (nu o mișcare programatică). */
  onUserMove?: () => void;
  onStationPress?: (station: Station) => void;
}

/** Map + vehicle popup anchored above the bus icon (bottom card when it has no position). */
export function LiveMapPanel({
  markers,
  station,
  highlightStation,
  selectedId,
  followed,
  located,
  onSelect,
  onLocated,
  popup,
  popupTracked,
  onTrackPopup,
  onClosePopup,
  centerTrigger,
  userCoords,
  extraStations,
  routeSegments,
  routeFitCoords,
  originPin,
  destPin,
  routeEdgePadding,
  mapPadding,
  bottomOffset = 0,
  onMapPress,
  onUserMove,
  onStationPress,
}: LiveMapPanelProps) {
  // Cu poziție pe hartă, panoul stă deasupra iconiței autobuzului; altfel rămâne jos.
  const pos = popup?.position;
  const anchored = Boolean(pos) && isMapNativeAvailable();
  return (
    <View style={styles.map}>
      <MapErrorBoundary fallback={<BusListFallback markers={markers} onSelect={onSelect} />}>
        <LiveMap
          markers={markers}
          station={station}
          highlightStation={highlightStation}
          selectedId={selectedId}
          followed={followed}
          located={located}
          onSelect={onSelect}
          onLocated={onLocated}
          onMapPress={onMapPress}
          onUserMove={onUserMove}
          onStationPress={onStationPress}
          centerTrigger={centerTrigger}
          userCoords={userCoords}
          extraStations={extraStations}
          routeSegments={routeSegments}
          routeFitCoords={routeFitCoords}
          originPin={originPin}
          destPin={destPin}
          routeEdgePadding={routeEdgePadding}
          mapPadding={mapPadding}
        >
          {popup && pos && anchored ? (
            <MarkerView key={popup.bus.id} coordinate={[pos.lng, pos.lat]} anchor={{ x: 0.5, y: 1 }} allowOverlap>
              <BusPopup anchored marker={popup} tracked={popupTracked} onTrack={onTrackPopup} onClose={onClosePopup} />
            </MarkerView>
          ) : undefined}
        </LiveMap>
      </MapErrorBoundary>
      {popup && !anchored ? (
        <View style={[styles.popup, { bottom: bottomOffset + 12 }]} pointerEvents="box-none">
          <BusPopup marker={popup} tracked={popupTracked} onTrack={onTrackPopup} onClose={onClosePopup} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
  popup: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
  },
});
