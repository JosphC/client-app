import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { t } from '../src/core/i18n';
import { useAuthStore } from '../src/features/auth';
import { PreferenceSheet } from '../src/features/settings';
import { ProfileHeader, ProfileSections } from '../src/features/profile';
import { useWalletItems } from '../src/features/wallet';
import { Screen, ScreenHeader, Toast } from '../src/ui';

export default function ProfileRoute() {
  const router = useRouter();
  const { items, isLoading } = useWalletItems();
  const [soon, setSoon] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const pass = items.find((i) => i.kind === 'pass');
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const holder = user?.name ?? pass?.holder ?? items[0]?.holder ?? 'EchoPass';
  if (isLoading) return <Text>{t('common.loading')}</Text>;

  return (
    <Screen scroll>
      <ScreenHeader title={t('profile.title')} onBack={() => router.back()} />
      <ProfileHeader
        name={holder}
        email={user?.email ?? t('auth.guestHint')}
        actionLabel={user ? undefined : t('auth.signIn')}
        onEdit={user ? () => setSoon(true) : () => router.push('/auth')}
      />
      <ProfileSections
        onSoon={() => setSoon(true)}
        onLanguage={() => setLanguageOpen(true)}
        onSettings={() => router.push('/(tabs)/settings')}
        signedIn={user !== null}
        onSignIn={() => router.push('/auth')}
        onSignOut={signOut}
      />
      <PreferenceSheet kind={languageOpen ? 'language' : null} onClose={() => setLanguageOpen(false)} />
      {soon ? <Toast message={t('common.soon')} tone="info" /> : null}
    </Screen>
  );
}
