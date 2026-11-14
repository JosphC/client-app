import { useState } from 'react';
import { Alert, Animated, FlatList, Modal, Pressable, Text, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { t } from '../../../../core/i18n';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../../../core/theme';
import { formatDayMonth } from '../../../../core/utils/format';
import type { RecentTrip } from '../../../../services/api/schemas/trip';
import { findRoute } from '../../../../services/repositories/gtfs/timetable';
import { LineBadge, ModeIcon } from '../../../../ui';
import { styles } from './statementStyles';
import { useDragToDismiss } from './useDragToDismiss';

interface TripStatementModalProps {
  visible: boolean;
  monthName: string;
  trips: RecentTrip[];
  onClose: () => void;
}

export function TripStatementModal({ visible, monthName, trips, onClose }: TripStatementModalProps) {
  const { colors } = useTheme();
  const [downloaded, setDownloaded] = useState(false);
  const { translateY, pan, listGesture, onListScroll } = useDragToDismiss(visible, onClose);

  const totalSpent = trips.reduce((sum, trip) => sum + trip.fareRon, 0);

  const handleDownload = () => {
    setDownloaded(true);
    Alert.alert(
      t('statement.generated'),
      `${t('statement.readyFor')} ${monthName} (${trips.length} ${t('statement.trips')}, ${totalSpent.toFixed(2).replace('.', ',')} lei) ${t('statement.readySuffix')}`,
      [{ text: 'OK' }]
    );
  };

  return (
    // Transparent: când tragi pagina în jos se vede ecranul de dedesubt, nu un fundal negru.
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* În Modal pe Android gesturile au nevoie de propriul root. Toată pagina se trage în jos ca să se închidă. */}
      <GestureHandlerRootView style={styles.root}>
        <GestureDetector gesture={pan}>
          <Animated.View
            style={[styles.container, { backgroundColor: colors.background, transform: [{ translateY }] }]}
          >
            <View style={styles.dragArea}>
              <View style={styles.handleHit}>
                <View style={[styles.handle, { backgroundColor: colors.textMuted }]} />
              </View>
              <Text style={[styles.title, { color: colors.text }]}>{t('statement.title')}</Text>

              {/* Month summary: same surface as the Activity month card, total as the headline. */}
              <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
                <Text style={[styles.monthTitle, { color: colors.textMuted }]}>{monthName}</Text>
                <Text style={[styles.total, { color: colors.text }]}>
                  {totalSpent.toFixed(2).replace('.', ',')} lei
                </Text>
                <Text style={[styles.summarySub, { color: colors.textMuted }]}>
                  {t('statement.billable')}: {trips.length} · {t('statement.operator')} STPT
                </Text>
              </View>
            </View>

            <Text style={[styles.listTitle, { color: colors.textMuted }]}>{t('statement.listTitle')}</Text>
            <View style={[styles.listCard, { backgroundColor: colors.card }]}>
              <GestureDetector gesture={listGesture}>
                <FlatList
                  data={trips}
                  onScroll={onListScroll}
                  scrollEventThrottle={16}
                  keyExtractor={(item) => item.id}
                  ItemSeparatorComponent={() => (
                    <View style={[styles.separator, { backgroundColor: colors.border }]} />
                  )}
                  renderItem={({ item }) => {
                    const route = item.line ? findRoute(item.line) : null;
                    return (
                      <View style={styles.itemRow}>
                        <ModeIcon mode={route?.mode} />
                        <LineBadge shortName={item.line ?? 'STPT'} />
                        <View style={styles.itemMain}>
                          <View style={styles.routeRow}>
                            <Text
                              numberOfLines={1}
                              style={[styles.itemTitle, styles.shrink, { color: colors.text }]}
                            >
                              {item.from}
                            </Text>
                            <Ionicons name="arrow-forward" size={13} color={colors.textMuted} />
                            <Text
                              numberOfLines={1}
                              style={[styles.itemTitle, styles.shrink, { color: colors.text }]}
                            >
                              {item.to}
                            </Text>
                          </View>
                          <Text numberOfLines={1} style={[styles.itemMeta, { color: colors.textMuted }]}>
                            {formatDayMonth(item.date)}
                            {item.time ? ` · ${item.time}` : ''} · {t('statement.series')} STPT-
                            {item.id.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={[styles.itemPrice, { color: colors.text }]}>
                          {item.fareRon.toFixed(2).replace('.', ',')} lei
                        </Text>
                      </View>
                    );
                  }}
                />
              </GestureDetector>
            </View>

            {/* Action Button */}
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={downloaded ? t('statement.downloaded') : t('statement.download')}
                onPress={handleDownload}
                style={[styles.downloadBtn, { backgroundColor: colors.primary }]}
              >
                <Ionicons
                  name={downloaded ? 'checkmark-circle' : 'document-text-outline'}
                  size={20}
                  color={colors.onPrimary}
                />
                <Text style={[styles.downloadText, { color: colors.onPrimary }]}>
                  {downloaded ? t('statement.downloaded') : t('statement.download')}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}
