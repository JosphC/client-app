import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../../../core/i18n';
import { fontSizes, fontWeights, spacing } from '../../../core/theme';
import { useTheme } from '../../../core/theme/useTheme';

interface NotificationsHeaderProps {
  onBack: () => void;
  onSettings: () => void;
}

/** Bară fără fundal propriu (culoarea paginii): săgeată înapoi, titlu centrat, roată de setări. */
export function NotificationsHeader({ onBack, onSettings }: NotificationsHeaderProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.bar, { paddingTop: insets.top + spacing.md }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('a11y.back')} onPress={onBack} hitSlop={8} style={styles.side}>
        <Ionicons name="arrow-back" size={26} color={colors.text} />
      </Pressable>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {t('notifications.title')}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('settings.title')}
        onPress={onSettings}
        hitSlop={8}
        style={[styles.side, styles.right]}
      >
        <Ionicons name="settings-outline" size={24} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  side: { width: 40, height: 40, justifyContent: 'center' },
  right: { alignItems: 'flex-end' },
  title: { flex: 1, textAlign: 'center', fontSize: fontSizes.lg, fontWeight: fontWeights.medium },
});
