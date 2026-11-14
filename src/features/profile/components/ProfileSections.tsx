import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { t } from '../../../core/i18n';
import { fontWeights, spacing } from '../../../core/theme';
import { useTheme } from '../../../core/theme/useTheme';
import { ListItem, Toggle } from '../../../ui';
import { usePreferences, useSettingsStore } from '../../settings';

interface ProfileSectionsProps {
  onSoon: () => void;
  onLanguage: () => void;
  onSettings: () => void;
  signedIn: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}

export function ProfileSections({ onSoon, onLanguage, onSettings, signedIn, onSignIn, onSignOut }: ProfileSectionsProps) {
  const { colors } = useTheme();
  const icon = (name: keyof typeof Ionicons.glyphMap) => <Ionicons name={name} size={22} color={colors.primary} />;
  const locationSharing = useSettingsStore((s) => s.locationSharing);
  const toggleSettings = useSettingsStore((s) => s.toggle);
  const preference = usePreferences((s) => s.theme);
  const setPreference = usePreferences((s) => s.setTheme);

  return (
    <View>
      <Text style={[styles.heading, { color: colors.textMuted }]}>{t('profile.preferences')}</Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <Toggle
          icon={icon('location-outline')}
          label={t('profile.location')}
          value={locationSharing}
          onValueChange={() => toggleSettings('locationSharing')}
        />
        <ListItem icon={icon('globe-outline')} title={t('profile.language')} onPress={onLanguage} />
        <Toggle
          icon={icon('notifications-outline')}
          label={t('profile.pushNotifications')}
          value={false}
          onValueChange={onSoon}
        />
        <Toggle
          icon={icon('moon-outline')}
          label={t('profile.darkMode')}
          value={preference === 'dark'}
          onValueChange={(next) => setPreference(next ? 'dark' : 'light')}
          divider={false}
        />
      </View>

      <Text style={[styles.heading, { color: colors.textMuted }]}>{t('profile.other')}</Text>
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <ListItem icon={icon('settings-outline')} title={t('profile.settings')} onPress={onSettings} />
        <ListItem icon={icon('help-circle-outline')} title={t('profile.helpCenter')} onPress={onSoon} />
        {signedIn ? (
          <ListItem icon={icon('log-out-outline')} title={t('profile.logout')} onPress={onSignOut} divider={false} />
        ) : (
          <ListItem icon={icon('log-in-outline')} title={t('auth.signIn')} onPress={onSignIn} divider={false} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heading: {
    marginTop: spacing.md,
    marginBottom: 6,
    marginLeft: 4,
    fontSize: 13,
    fontWeight: fontWeights.medium,
  },
  card: {
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 2,
  },
});
