import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '../../../../core/i18n';
import { useTheme } from '../../../../core/theme';
import { findRoute } from '../../../../services/repositories/gtfs/timetable';
import { LineBadge } from '../../../../ui';
import type { ActiveRideState } from '../../../ride';
import { useOnboardView } from '../../hooks/useOnboardView';
import { StationTimeline } from './StationTimeline';
import { styles } from './onboardStyles';

interface LiveOnboardCardProps {
  ride?: ActiveRideState | null;
  initiallyExpanded?: boolean;
}

export function LiveOnboardCard({ ride, initiallyExpanded = false }: LiveOnboardCardProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(initiallyExpanded);
  const [showPrev, setShowPrev] = useState(false);
  const view = useOnboardView(ride);
  // Hooks first: an early return before them breaks the rules of hooks.
  if (!ride || !view) return null;

  const line = ride.line;
  const destination = ride.destination;
  const route = findRoute(line);
  const routeColor = route?.color ?? colors.primary;

  const { stops, boardedIndex, nextIndex } = view;
  // Lista începe de la stația de urcare (sau de la cea dinaintea celei următoare); restul, la „Arată stațiile anterioare”.
  let start = boardedIndex >= 0 ? boardedIndex : Math.max(0, nextIndex - 1);
  if (nextIndex >= 0 && nextIndex < start) start = nextIndex; // traseu circular: următoarea e din nou la început
  const hasPrevStops = start > 0;
  const offset = showPrev ? 0 : start;
  const displayedStops = stops.slice(offset);

  return (
    <View testID="live-onboard-card" style={[styles.card, { backgroundColor: colors.card }]}>
      {/* Header bar: tap to expand or collapse route stops */}
      <Pressable
        testID="live-onboard-header"
        accessibilityRole="button"
        accessibilityLabel={`${t('ride.onBoard')}, ${line}, ${destination}`}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((prev) => !prev)}
        style={styles.headerPressable}
      >
        {/* Line + destination, one quiet status line, then the next stop as the one highlight. */}
        <View style={styles.headerRow}>
          <LineBadge shortName={line} color={route?.color ?? undefined} textColor={route?.textColor ?? undefined} size="md" />
          <View style={styles.textBlock}>
            <Text numberOfLines={1} style={[styles.destinationText, { color: colors.text }]}>
              {destination}
            </Text>
            <View style={styles.subtitleRow}>
              <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
              <Text style={[styles.stationText, { color: colors.textMuted }]}>{t('ride.onBoard')} · </Text>
              <Text numberOfLines={1} style={[styles.stationText, styles.fromText, { color: colors.textMuted }]}>
                {t('ride.boardedFrom')} {view.boardedName}
              </Text>
            </View>
          </View>
          <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textMuted} />
        </View>

        <View style={[styles.nextBox, { backgroundColor: colors.fill }]}>
          <View style={[styles.nextRing, { borderColor: routeColor }]} />
          <View style={styles.textBlock}>
            <Text style={[styles.nextLabel, { color: colors.textMuted }]}>{t('ride.nextStop')}</Text>
            <Text numberOfLines={1} style={[styles.nextStopHeader, { color: colors.text }]}>
              {view.nextName ?? '—'}
            </Text>
          </View>
          <Text style={[styles.nextEta, { color: colors.text }]}>{view.nextName ? view.nextEtaText : ''}</Text>
        </View>
      </Pressable>

      {/* Expanded Stops Timeline */}
      {expanded && (
        <View style={styles.timelineWrap}>
          {hasPrevStops && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={showPrev ? t('ride.hidePrev') : t('ride.showPrev')}
              onPress={() => setShowPrev((prev) => !prev)}
              style={styles.togglePrevBtn}
            >
              <Ionicons name={showPrev ? 'chevron-up' : 'chevron-down'} size={15} color={colors.textMuted} />
              <Text style={[styles.togglePrevText, { color: colors.textMuted }]}>
                {showPrev ? t('ride.hidePrev') : t('ride.showPrev')}
              </Text>
            </Pressable>
          )}

          <StationTimeline
            stops={displayedStops}
            currentStopIndex={nextIndex >= 0 ? nextIndex - offset : -1}
            boardedStopIndex={boardedIndex >= 0 ? boardedIndex - offset : -1}
            lineColor={routeColor}
            nextEtaText={view.nextEtaText}
            boardedNote={view.boardedNote}
          />
        </View>
      )}
    </View>
  );
}
