import { Animated, View } from 'react-native';
import { useHomeScreen } from '../../hooks/useHomeScreen';
import { LiveMapPanel, LocateButton } from '../../../map';
import { HomeBottomSheet } from './HomeBottomSheet';
import { HomeMapOverlay } from './HomeMapOverlay';
import { styles } from './homeMapStyles';

export function HomeScreenView() {
  const h = useHomeScreen();
  const { live, sheet, planner, routePreview } = h;
  const { sheetHeight, setContentCap } = sheet;
  const trackedId = live.tracked?.bus.id ?? null;

  return (
    <View style={styles.root}>
      <View style={styles.mapLayer}>
        <LiveMapPanel
          markers={h.markers}
          station={routePreview.selectedOption?.boardStation ?? live.station}
          highlightStation={live.arrivalStation}
          selectedId={live.selected?.bus.id ?? null}
          followed={live.tracked}
          located={live.located}
          onSelect={live.select}
          onLocated={live.locate}
          onMapPress={h.handleMapPress}
          onUserMove={h.clearCentered}
          onStationPress={(st) => h.handlePickStation(st, 1)}
          popup={live.selected}
          popupTracked={trackedId === live.selected?.bus.id}
          onTrackPopup={() => live.track(trackedId === live.selected?.bus.id ? null : (live.selected?.bus.id ?? null))}
          onClosePopup={() => live.select(null)}
          centerTrigger={h.centerTrigger}
          userCoords={live.coords}
          extraStations={routePreview.extraStations}
          routeSegments={routePreview.routeSegments}
          routeFitCoords={routePreview.routeFitCoords}
          originPin={routePreview.originPin}
          destPin={routePreview.destPin}
          routeEdgePadding={h.routeEdgePadding}
          mapPadding={h.mapPadding}
          bottomOffset={sheetHeight}
        />
      </View>

      <HomeMapOverlay
        station={live.station}
        mode={h.mapMode}
        sheetMode={h.sheetMode}
        userName={h.holder}
        origin={planner.origin}
        destination={planner.destination}
        onMode={h.handleMode}
        onPickStation={h.handlePickStation}
        onPickDestination={h.handlePickDestination}
        onClear={() => live.pickStation(null)}
        onNotifications={planner.openNotifications}
        onOriginChange={planner.changeOrigin}
        onDestinationChange={planner.changeDestination}
        onSwap={planner.swap}
        onCloseDirections={h.closeDirections}
        onLocateOrigin={() => void h.handleLocateOrigin()}
        onSearchRoute={h.handleSearchRoute}
        onHeaderHeightChange={h.setHeaderHeight}
        dismissSearchSignal={h.dismissSearch}
        onSearchingChange={h.setSearching}
      />

      {/* Follows the sheet's animated height, so it never sinks under the sheet. */}
      {!h.searching ? (
        <Animated.View style={[styles.locateWrap, { bottom: Animated.add(sheet.sheetAnim, 14) }]}>
          <LocateButton active={h.centered} loading={h.locating} onPress={() => void h.handleLocate()} style={styles.locateInline} />
        </Animated.View>
      ) : null}

      {!h.searching && !h.plannerEmpty ? <HomeBottomSheet
        sheetMode={h.sheetMode}
        station={live.arrivalStation}
        coords={live.coords}
        onSelectStation={h.handlePickStation}
        onDirections={h.handleDirections}
        onTrackBus={(busId) => live.track(busId)}
        origin={planner.origin}
        destination={planner.destination}
        searched={planner.searched}
        originCoords={planner.originCoords}
        onOpenOption={(opt) => routePreview.selectOption(opt)}
        selectedOptionId={routePreview.selectedOption?.id}
        onSelectOption={(opt) => routePreview.selectOption(opt)}
        routeOptions={routePreview.options}
        onContentHeight={(ch) => setContentCap(ch > 30 ? ch + 34 : null)}
        onHeightChange={(ht) => {
          // First mount / font scaling only; drag animation drives the rest.
          if (Math.abs(ht - sheetHeight) > 4 && sheet.snapIndex === 0 && ht < sheet.peekHeight + 120) {
            sheet.setSheetHeight(ht);
          }
        }}
        sheetStyle={{ height: sheet.sheetAnim }}
        panHandlers={sheet.sheetPan.panHandlers}
        snapIndex={sheet.snapIndex}
        onSnapChange={sheet.snapTo}
      /> : null}
    </View>
  );
}
