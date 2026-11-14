import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderHandlers } from 'react-native';
import type { LatLng } from '../../../../features/map/arrivals';
import type { Station } from '../../../../features/map/stations';
import { t } from '../../../../core/i18n';
import { fontSizes, fontWeights, radius, spacing } from '../../../../core/theme';
import { useTheme } from '../../../../core/theme/useTheme';
import { BottomSheet, EmptyState } from '../../../../ui';
import { useStopArrivals, type StopArrivalItem } from '../../hooks/useStopArrivals';
import { useLiveMapReports } from '../../hooks/useLiveMapReports';
import { useBoardLines } from '../../stores/boardLines';
import { useFavoriteStations } from '../../stores/favoriteStations';
import { ActionChipRow } from './ActionChipRow';
import { BoardHeader } from './BoardHeader';
import { DepartureRow } from './DepartureRow';
import { LineFilterRow } from './LineFilterRow';
import { ReportStationSheet } from './parts/ReportStationSheet';
import { shareStation } from './parts/shareStation';
import { StationAlert } from './StationAlert';
import { StationPickerSheet } from './StationPickerSheet';
import { TripSheet } from './TripSheet';

interface ArrivalsBoardProps {
  station: Station;
  coords: LatLng | null;
  onSelectStation: (station: Station) => void;
  onDirections: () => void;
  onOpenMap?: () => void;
  onTrackBus: (busId: string) => void;
  flat?: boolean;
  /** Gesturi de tragere ale panoului, aplicate pe antet și pe butoane (ca în Google Maps). */
  dragHandlers?: GestureResponderHandlers;
}

const PAGE = 10;

export function ArrivalsBoard({ station, coords, onSelectStation, onDirections, onOpenMap, onTrackBus, flat = false, dragHandlers }: ArrivalsBoardProps) {
  const { colors } = useTheme();
  const [limit, setLimit] = useState(PAGE);
  const [detail, setDetail] = useState<StopArrivalItem | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const favoriteIds = useFavoriteStations((s) => s.ids);
  const toggleFavorite = useFavoriteStations((s) => s.toggle);
  const isFavorite = favoriteIds.includes(station.id);

  const { items, routes, lineFilter, toggleLine, clearFilter, isLoading, isError, hasCache, updatedAtMs, refetch } =
    // 2 h: hourly lines (E3, M-lines) must still show, like Google Maps.
    useStopArrivals(station.id, { limit, windowMin: 120 });
  const { alerts } = useLiveMapReports(station);

  useEffect(() => {
    setLimit(PAGE);
  }, [station.id]);
  // Liniile bifate aici filtrează și vehiculele de pe hartă; la închiderea panoului harta arată iar toate liniile.
  useEffect(() => useBoardLines.getState().setLines(lineFilter), [lineFilter]);
  useEffect(() => () => useBoardLines.getState().setLines([]), []);

  const agoSec = updatedAtMs > 0 ? Math.max(0, Math.floor((Date.now() - updatedAtMs) / 1000)) : 0;

  return (
    <View style={flat ? styles.flatSection : styles.section}>
      <View {...(dragHandlers ?? {})}>
        <BoardHeader
          stationName={station.name}
          onOpenPicker={() => setPickerOpen(true)}
        />
      </View>
      <StationPickerSheet
        visible={pickerOpen}
        coords={coords}
        selectedId={station.id}
        favoriteIds={favoriteIds}
        onToggleFavorite={toggleFavorite}
        onPick={onSelectStation}
        onClose={() => setPickerOpen(false)}
      />
      <View style={[flat ? styles.flatCard : styles.card, !flat && { backgroundColor: colors.card }]}>
        <View {...(dragHandlers ?? {})}>
        <ActionChipRow
          actions={[
            { label: t('home.directions'), icon: 'navigate-outline', onPress: onDirections },
            { label: isFavorite ? t('home.saved') : t('home.save'), icon: isFavorite ? 'bookmark' : 'bookmark-outline', onPress: () => toggleFavorite(station.id), active: isFavorite },
            { label: t('home.share'), icon: 'share-social-outline', onPress: () => void shareStation(station, items) },
            { label: t('home.report'), icon: 'alert-circle-outline', onPress: () => setReportOpen(true) },
          ]}
        />
        </View>
        <LineFilterRow lines={routes} selected={lineFilter} onToggle={toggleLine} onClear={clearFilter} />
        <StationAlert alerts={alerts} />
        {isLoading && items.length === 0 ? (
          <View style={styles.skeleton}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.bone, { backgroundColor: colors.border }]} />
            ))}
          </View>
        ) : null}
        {isError && !hasCache ? (
          <EmptyState title={t('common.error')} message={t('home.noArrivals')} actionLabel={t('common.retry')} onAction={() => void refetch()} />
        ) : null}
        {isError && hasCache ? (
          <Text style={[styles.cached, { color: colors.warning }]}>
            {t('home.cachedData')} · {Math.floor(agoSec / 60)} {t('common.min')}
          </Text>
        ) : null}
        {!isLoading && items.length === 0 && !isError ? (
          <EmptyState title={t('home.stationArrivals')} message={t('home.noArrivals')} actionLabel={t('home.viewSchedule')} onAction={onOpenMap ?? onDirections} />
        ) : null}
        {items.map((item) => (
          <DepartureRow
            key={item.arrival.tripId}
            item={item}
            onPress={() => {
              if (item.arrival.busId) onTrackBus(item.arrival.busId);
              else setDetail(item);
            }}
          />
        ))}
        {items.length >= limit ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('home.loadMore')}
            onPress={() => setLimit((l) => l + PAGE)}
            style={styles.more}
          >
            <Text style={[styles.moreLabel, { color: colors.primary }]}>{t('home.loadMore')}</Text>
          </Pressable>
        ) : null}
        <BottomSheet visible={detail !== null} onClose={() => setDetail(null)}>
          {detail ? <TripSheet item={detail} /> : null}
        </BottomSheet>
        <ReportStationSheet
          visible={reportOpen}
          line={lineFilter[0] ?? station.lines[0] ?? '17'}
          onClose={() => setReportOpen(false)}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 14 },
  flatSection: { gap: 6 },
  flatCard: { gap: 8, paddingHorizontal: 0, paddingVertical: 4 },
  card: {
    borderRadius: 16,
    padding: 14,
    gap: 10,
  },
  skeleton: { gap: spacing.sm, paddingVertical: spacing.sm },
  bone: { height: 46, borderRadius: radius.md, opacity: 0.6 },
  cached: { fontSize: fontSizes.xs },
  more: { alignItems: 'center', minHeight: 36, justifyContent: 'center' },
  moreLabel: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium },
});
