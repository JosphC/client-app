import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../../../../core/i18n';
import { fontSizes, fontWeights, radius, spacing } from '../../../../core/theme';
import { useTheme } from '../../../../core/theme/useTheme';
import { Button, LineBadge } from '../../../../ui';
import type { BusMarker } from '../../hooks/useLiveMap';

interface BusPopupProps {
  marker: BusMarker;
  tracked: boolean;
  onTrack: () => void;
  onClose: () => void;
  /** Ancorat deasupra iconiței pe hartă: lățime fixă + săgeată spre autobuz. */
  anchored?: boolean;
}

export function headcountText(headcount: number | null | undefined): string {
  if (headcount === null || headcount === undefined) return t('live.headcountUnknown');
  return `${headcount} ${headcount === 1 ? t('live.onBoardOne') : t('live.onBoardCount')}`;
}

/** Panou informativ al vehiculului, ca în Google Maps: linie, sosire, locație, persoane la bord. */
export function BusPopup({ marker, tracked, onTrack, onClose, anchored = false }: BusPopupProps) {
  const { colors } = useTheme();
  const { bus, position } = marker;
  const status =
    position && position.arrivesInMin > 0
      ? `${t('live.arrivingIn')} ${position.arrivesInMin} ${t('common.min')}`
      : t('live.arrived');
  const known = bus.headcount !== null && bus.headcount !== undefined;

  return (
    <View testID="bus-popup" style={anchored ? styles.anchored : undefined}>
      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.primary }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={onClose}
          hitSlop={8}
          style={styles.close}
        >
          <Ionicons name="close" size={18} color={colors.textMuted} />
        </Pressable>
        <View style={styles.row}>
          <Ionicons name="bus-outline" size={18} color={colors.primary} />
          <LineBadge shortName={bus.line} />
          <Text numberOfLines={1} style={[styles.text, styles.title, { color: colors.text }]}>
            → {bus.destination}
          </Text>
        </View>
        <Row icon="time-outline" text={status} />
        <Row icon="location-outline" text={`${t('live.nowAt')}: ${position ? position.nextStop : bus.destination}`} />
        <Row icon="people-outline" text={headcountText(bus.headcount)} muted={!known} testID="bus-headcount" />
        <View style={styles.trackRow}>
          <Button pill title={tracked ? t('live.tracking') : t('live.track')} onPress={onTrack} />
        </View>
      </View>
      {anchored ? (
        <View style={[styles.arrow, { backgroundColor: colors.card, borderColor: colors.primary }]} />
      ) : null}
    </View>
  );
}

interface RowProps {
  icon: ComponentProps<typeof Ionicons>['name'];
  text: string;
  muted?: boolean;
  testID?: string;
}

function Row({ icon, text, muted = false, testID }: RowProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text testID={testID} numberOfLines={2} style={[styles.text, { color: muted ? colors.textMuted : colors.text }]}>
        {text}
      </Text>
    </View>
  );
}

const ARROW = 14;

const styles = StyleSheet.create({
  anchored: {
    width: 270,
    alignItems: 'center',
    // Săgeata + spațiu cât să nu acopere cercul autobuzului (raza 13 + halo).
    paddingBottom: 26,
  },
  card: {
    alignSelf: 'stretch',
    borderRadius: radius.lg,
    borderWidth: 1.5,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
    elevation: 4,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  close: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: spacing.xl,
  },
  text: {
    flex: 1,
    fontSize: fontSizes.md,
  },
  title: {
    fontWeight: fontWeights.bold,
  },
  trackRow: {
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  arrow: {
    width: ARROW,
    height: ARROW,
    marginTop: -ARROW / 2 - 1,
    borderRightWidth: 1.5,
    borderBottomWidth: 1.5,
    transform: [{ rotate: '45deg' }],
  },
});
