import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { t } from '../../../../core/i18n';
import { useTheme } from '../../../../core/theme/useTheme';
import type { PlaceOrStation } from '../planner/PlannerCard';
import { SwapButton } from '../planner/parts/SwapButton';
import { styles } from './homeMapStyles';

interface DirectionsSummaryProps {
  origin: PlaceOrStation;
  destination: PlaceOrStation;
  onBack: () => void;
  onEdit: () => void;
  onSwap: () => void;
  onHeight: (height: number) => void;
}

/**
 * Bara compactă (Google Maps) după ce ruta e setată: înapoi + plecare/destinație
 * pe două rânduri trunchiate, ca numele lungi să nu împingă bara în afara ecranului.
 */
export function DirectionsSummary({ origin, destination, onBack, onEdit, onSwap, onHeight }: DirectionsSummaryProps) {
  const { colors } = useTheme();
  return (
    <View
      onLayout={(e) => onHeight(e.nativeEvent.layout.height)}
      style={[styles.directionsCard, styles.directionsCardCompact, { backgroundColor: colors.card }]}
    >
      <View style={styles.dirCompactRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('a11y.backToMap')}
          onPress={onBack}
          hitSlop={8}
          style={[styles.backBtn, { backgroundColor: colors.fill }]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.text} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('a11y.editRoute')}
          onPress={onEdit}
          style={styles.dirSummaryCol}
        >
          <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.dirSummaryOrigin, { color: colors.textMuted }]}>
            {origin.name}
          </Text>
          <View style={styles.dirSummaryDestRow}>
            <Ionicons name="arrow-forward" size={14} color={colors.textMuted} />
            <Text numberOfLines={1} ellipsizeMode="tail" style={[styles.dirSummaryText, { color: colors.text }]}>
              {destination.name}
            </Text>
          </View>
        </Pressable>
        <SwapButton
          onSwap={onSwap}
          style={styles.dirSwapBtnSmall}
          iconColor={colors.primary}
          iconSize={17}
          hitSlop={10}
          feedback="none"
        />
      </View>
    </View>
  );
}
