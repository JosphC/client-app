import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../../../core/i18n';
import { fontWeights, useTheme } from '../../../core/theme';

interface PassengerStepperProps {
  count: number;
  onDecrement: () => void;
  onIncrement: () => void;
}

/** "How many people are you paying for?" − N + (1 to 10). */
export function PassengerStepper({ count, onDecrement, onIncrement }: PassengerStepperProps) {
  const { colors } = useTheme();
  const atMin = count <= 1;

  return (
    <View style={styles.row}>
      <Pressable
        testID="btn-decrement-passengers"
        accessibilityRole="button"
        accessibilityLabel={t('ride.decrease')}
        disabled={atMin}
        onPress={onDecrement}
        hitSlop={10}
        style={({ pressed }) => [
          styles.circleBtn,
          { backgroundColor: colors.fill },
          atMin && styles.disabled,
          pressed && { opacity: 0.7 },
        ]}
      >
        <Ionicons name="remove" size={24} color={atMin ? colors.placeholder : colors.text} />
      </Pressable>

      <View style={styles.countCol}>
        <Text testID="passenger-count-text" style={[styles.countNumber, { color: colors.text }]}>
          {count}
        </Text>
        <Text style={[styles.countLabel, { color: colors.textMuted }]}>{count === 1 ? t('ride.person') : t('ride.people')}</Text>
      </View>

      <Pressable
        testID="btn-increment-passengers"
        accessibilityRole="button"
        accessibilityLabel={t('ride.increase')}
        onPress={onIncrement}
        hitSlop={10}
        style={({ pressed }) => [styles.circleBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.85 }]}
      >
        <Ionicons name="add" size={26} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 36, marginBottom: 24 },
  circleBtn: { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.5 },
  countCol: { alignItems: 'center', minWidth: 80 },
  countNumber: { fontSize: 44, fontWeight: fontWeights.bold, lineHeight: 48 },
  countLabel: { fontSize: 13.5, marginTop: 2 },
});
