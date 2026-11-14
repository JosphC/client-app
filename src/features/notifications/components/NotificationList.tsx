import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatDayMonth, timeAgoShort } from '../../../core/utils/format';
import type { AppNotification } from '../../../services/api/schemas/notification';
import { t } from '../../../core/i18n';
import { fontSizes, fontWeights, spacing } from '../../../core/theme';
import { useTheme } from '../../../core/theme/useTheme';

interface NotificationListProps {
  today: AppNotification[];
  yesterday: AppNotification[];
  older: AppNotification[];
  onOpen: (id: string) => void;
}

const DAY_MS = 86_400_000;

/** "9min" / "2h" inside a day, then the date ("3 oct") like the Activity history. */
function stamp(iso: string): string {
  return Date.now() - new Date(iso).getTime() < DAY_MS ? timeAgoShort(iso) : formatDayMonth(iso.slice(0, 10));
}

function Card({ item, onOpen }: { item: AppNotification; onOpen: (id: string) => void }) {
  const { colors } = useTheme();
  const unread = !item.read;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}. ${item.body}`}
      onPress={() => onOpen(item.id)}
      style={[styles.card, { backgroundColor: colors.card }, unread && [styles.cardUnread, { shadowColor: colors.shadow }]]}
    >
      <View style={[styles.icon, { borderColor: colors.border }]}>
        <Ionicons name="notifications-outline" size={22} color={unread ? colors.primary : colors.textMuted} />
      </View>
      <View style={styles.texts}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.text }]}>
          {item.title}
        </Text>
        <Text numberOfLines={3} style={[styles.body, { color: colors.textMuted }]}>
          {item.body}
        </Text>
      </View>
      <View style={styles.time}>
        {unread ? <View style={[styles.dot, { backgroundColor: colors.danger }]} /> : null}
        <Text style={[styles.timeLabel, { color: unread ? colors.primary : colors.textMuted }]}>{stamp(item.createdAt)}</Text>
      </View>
    </Pressable>
  );
}

function Group({ label, items, onOpen }: { label: string; items: AppNotification[]; onOpen: (id: string) => void }) {
  const { colors } = useTheme();
  if (items.length === 0) return null;

  return (
    <View style={styles.group}>
      <View style={styles.groupHead}>
        <Text accessibilityRole="header" style={[styles.groupLabel, { color: colors.text }]}>
          {label}
        </Text>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
      </View>
      {items.map((n) => (
        <Card key={n.id} item={n} onOpen={onOpen} />
      ))}
    </View>
  );
}

/** O secțiune pe zi: etichetă + linie subțire, apoi un card separat pentru fiecare notificare. */
export function NotificationList({ today, yesterday, older, onOpen }: NotificationListProps) {
  return (
    <View>
      <Group label={t('notifications.today')} items={today} onOpen={onOpen} />
      <Group label={t('notifications.yesterday')} items={yesterday} onOpen={onOpen} />
      <Group label={t('notifications.older')} items={older} onOpen={onOpen} />
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.md, marginBottom: spacing.xl },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  groupLabel: { fontSize: fontSizes.md, fontWeight: fontWeights.medium },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, borderRadius: 16, padding: 16 },
  cardUnread: { shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  icon: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  texts: { flex: 1, gap: 4 },
  title: { fontSize: fontSizes.md, fontWeight: fontWeights.semiBold },
  body: { fontSize: 13, lineHeight: 19 },
  time: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeLabel: { fontSize: 13 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
