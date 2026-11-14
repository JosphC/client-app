import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { t } from '../../../../../core/i18n';
import { useTheme } from '../../../../../core/theme/useTheme';

interface FieldActionsProps {
  showClear: boolean;
  onClear: () => void;
  showLocate: boolean;
  locating?: boolean;
  onLocate?: () => void;
}

/** Butoanele din dreapta câmpului de stație: șterge textul/valoarea și „locația mea". */
export function FieldActions({ showClear, onClear, showLocate, locating, onLocate }: FieldActionsProps) {
  const { colors } = useTheme();
  return (
    <>
      {showClear ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('live.clearFilter')}
          onPress={onClear}
          hitSlop={12}
          style={styles.actionBtn}
        >
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
      {showLocate ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={locating ? t('home.locating') : t('home.currentLocation')}
          onPress={onLocate}
          hitSlop={12}
          style={styles.actionBtn}
        >
          <Ionicons name={locating ? 'hourglass-outline' : 'locate'} size={18} color={colors.primary} />
        </Pressable>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  actionBtn: { padding: 3, alignItems: 'center', justifyContent: 'center' },
});
