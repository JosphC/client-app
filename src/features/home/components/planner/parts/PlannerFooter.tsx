import { Ionicons } from '@expo/vector-icons';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../../../../../core/theme/useTheme';
import { departureLabel, type DepartureOption } from '../DeparturePicker';
import { styles } from '../plannerCardStyles';

interface PlannerFooterProps {
  departure: DepartureOption;
  onOpenDeparture: () => void;
  error: string | null;
  valid: boolean;
  searchLabel: string;
  onSearch: () => void;
}

/** Ora de plecare, eroarea de validare și butonul „Caută rute" din cardul planner. */
export function PlannerFooter({ departure, onOpenDeparture, error, valid, searchLabel, onSearch }: PlannerFooterProps) {
  const { colors } = useTheme();
  return (
    <>
      <View style={styles.bottomChipsRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={departureLabel(departure)}
          onPress={onOpenDeparture}
          style={[styles.departureChip, { backgroundColor: colors.fill }]}
        >
          <Ionicons name="time-outline" size={15} color={colors.text} />
          <Text style={[styles.departureText, { color: colors.text }]}>
            {departure.mode === 'now' ? 'Plecare acum' : departure.time || 'Plecare'}
          </Text>
          <Ionicons name="chevron-down" size={13} color={colors.textMuted} />
        </Pressable>
      </View>

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={searchLabel}
        accessibilityState={{ disabled: !valid }}
        onPress={onSearch}
        style={({ pressed }) => [
          styles.searchButton,
          {
            backgroundColor: valid ? colors.primary : colors.fillDisabled,
            opacity: pressed && valid ? 0.9 : 1,
          },
        ]}
      >
        <Ionicons name="navigate" size={16} color={valid ? colors.onPrimary : colors.textMuted} />
        <Text numberOfLines={1} style={[styles.searchLabel, { color: valid ? colors.onPrimary : colors.textMuted }]}>
          {searchLabel}
        </Text>
      </Pressable>
    </>
  );
}
