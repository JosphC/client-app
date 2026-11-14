import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t, type AppLocale, type I18nKey } from '../../../core/i18n';
import { fontSizes, fontWeights, spacing } from '../../../core/theme';
import type { ThemePreference } from '../../../core/theme/themeStore';
import { useTheme } from '../../../core/theme/useTheme';
import { BottomSheet } from '../../../ui';
import { usePreferences } from '../hooks/usePreferences';

export type PreferenceKind = 'language' | 'appearance';

const LANGUAGES: { value: AppLocale; label: I18nKey }[] = [
  { value: 'ro', label: 'settings.langRo' },
  { value: 'en', label: 'settings.langEn' },
];
const THEMES: { value: ThemePreference; label: I18nKey }[] = [
  { value: 'system', label: 'settings.themeSystem' },
  { value: 'light', label: 'settings.themeLight' },
  { value: 'dark', label: 'settings.themeDark' },
];

export function languageLabel(locale: AppLocale): string {
  return t(LANGUAGES.find((l) => l.value === locale)?.label ?? 'settings.langRo');
}

export function themeLabel(theme: ThemePreference): string {
  return t(THEMES.find((x) => x.value === theme)?.label ?? 'settings.themeSystem');
}

interface PreferenceSheetProps {
  kind: PreferenceKind | null;
  onClose: () => void;
}

export function PreferenceSheet({ kind, onClose }: PreferenceSheetProps) {
  const { colors } = useTheme();
  const { locale, theme, setLocale, setTheme } = usePreferences();
  const isLanguage = kind === 'language';
  const options: { value: string; label: I18nKey }[] = isLanguage ? LANGUAGES : THEMES;
  const current: string = isLanguage ? locale : theme;

  function choose(value: string): void {
    if (isLanguage) setLocale(value as AppLocale);
    else setTheme(value as ThemePreference);
    onClose();
  }

  return (
    <BottomSheet visible={kind !== null} onClose={onClose} testID="preference-sheet">
      <Text style={[styles.title, { color: colors.text }]}>{isLanguage ? t('settings.language') : t('settings.appearance')}</Text>
      <View accessibilityRole="radiogroup">
        {options.map((opt) => {
          const selected = opt.value === current;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="radio"
              accessibilityLabel={t(opt.label)}
              accessibilityState={{ checked: selected }}
              onPress={() => choose(opt.value)}
              style={styles.row}
            >
              <Text style={[styles.label, { color: colors.text, fontWeight: selected ? fontWeights.bold : fontWeights.medium }]}>{t(opt.label)}</Text>
              {selected ? <Ionicons name="checkmark" size={22} color={colors.primary} /> : null}
            </Pressable>
          );
        })}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: fontSizes.lg, fontWeight: fontWeights.bold, marginBottom: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48, paddingVertical: spacing.md },
  label: { fontSize: fontSizes.md },
});
