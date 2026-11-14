import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { t } from '../../../../core/i18n';
import { radius, spacing } from '../../../../core/theme';
import { useTheme } from '../../../../core/theme/useTheme';

interface LocateButtonProps {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  active?: boolean;
  /** Se caută poziția: spinner în loc de iconiță, butonul rămâne gri până ajunge harta la tine. */
  loading?: boolean;
}

/** Google Maps style "my location" FAB: white circle docked above the sheet. */
export function LocateButton({ onPress, style, active = false, loading = false }: LocateButtonProps) {
  const { colors } = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('live.locate')}
      accessibilityState={{ busy: loading, selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.locate,
        { backgroundColor: colors.chip, opacity: pressed ? 0.82 : 1 },
        style ?? styles.defaultPos,
      ]}
    >
      {/* Google Maps: gri + centru gol când harta nu e pe tine, albastru + centru plin când e centrată (ambele teme). */}
      {loading ? (
        <ActivityIndicator size="small" color={colors.textMuted} />
      ) : (
        <>
          <Ionicons name="locate-outline" size={24} color={active ? colors.primary : colors.textMuted} />
          {active ? <View style={[styles.dot, { backgroundColor: colors.primary }]} /> : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  locate: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#111827',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  // Punctul plin din centrul vizorului (24px icon → inelul interior ~9px).
  dot: {
    position: 'absolute',
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  defaultPos: {
    position: 'absolute',
    left: spacing.lg,
    bottom: spacing.lg,
  },
});
