import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { t } from '../src/core/i18n';
import { spacing } from '../src/core/theme';
import { useTheme } from '../src/core/theme/useTheme';
import { NotificationList, useNotifications } from '../src/features/notifications';
import { NotificationsHeader } from '../src/features/notifications/components/NotificationsHeader';

export default function NotificationsRoute() {
  const router = useRouter();
  const { colors } = useTheme();
  const { groups, isLoading, markRead } = useNotifications();
  if (isLoading) return <Text>{t('common.loading')}</Text>;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <NotificationsHeader onBack={() => router.back()} onSettings={() => router.push('/(tabs)/settings')} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <NotificationList today={groups.today} yesterday={groups.yesterday} older={groups.older} onOpen={markRead} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.lg, paddingTop: spacing.xl, paddingBottom: spacing.xxl },
});
