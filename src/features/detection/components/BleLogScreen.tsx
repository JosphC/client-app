import { useEffect, useState } from 'react';
import { FlatList, Platform, StyleSheet, Text, View } from 'react-native';
import { t } from '../../../core/i18n';
import { fontSizes, fontWeights, spacing } from '../../../core/theme';
import { useTheme } from '../../../core/theme/useTheme';
import { env } from '../../../core/config/env';
import { sightingTarget } from '../../../services/repositories/real/sightingRepo';
import { Screen, ScreenHeader } from '../../../ui';
import { BEACON_UUID } from '../ble/beacon';
import { bleStats, useBleLog, type BleLogEntry } from '../ble/log';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
const SLOT_SECONDS = 30;

const pad = (n: number, w = 2) => String(n).padStart(w, '0');
function clock(ms: number): string {
  const d = new Date(ms);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${pad(d.getMilliseconds(), 3)}`;
}

function statusText(status: number | 'offline'): string {
  switch (status) {
    case 200:
      return t('bleLog.status200');
    case 400:
      return t('bleLog.status400');
    case 401:
      return t('bleLog.status401');
    case 422:
      return t('bleLog.status422');
    case 'offline':
      return t('bleLog.offline');
    default:
      return String(status);
  }
}

function LogRow({ entry }: { entry: BleLogEntry }) {
  const { colors } = useTheme();
  const muted = { color: colors.textMuted };
  if (entry.kind === 'info') {
    return (
      <View style={[styles.row, { backgroundColor: colors.card }]}>
        <Text style={[styles.small, muted]}>{`${clock(entry.atMs)} · ${entry.text ?? ''}`}</Text>
      </View>
    );
  }
  const isSighting = entry.kind === 'sighting';
  const ok = entry.status === 200;
  const statusColor = ok ? colors.success : entry.status === 'offline' ? colors.warning : colors.danger;
  const age = entry.slot === undefined ? null : Math.round(entry.atMs / 1000 - entry.slot * SLOT_SECONDS);
  return (
    <View style={[styles.row, { backgroundColor: colors.card }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        {isSighting ? `${clock(entry.atMs)} → ${t('bleLog.server')} ` : `${clock(entry.atMs)} · ${t('bleLog.bus')} ${entry.busId} · `}
        {isSighting && entry.status !== undefined ? (
          <Text style={{ color: statusColor }}>{statusText(entry.status)}</Text>
        ) : (
          `${entry.rssi ?? '?'} dBm`
        )}
      </Text>
      {entry.token ? (
        <>
          <Text style={[styles.small, muted]}>
            {`${t('bleLog.bus')} ${entry.busId} · ${entry.rssi ?? '?'} dBm · slot ${entry.slot} (${age} s) · ${
              entry.clockSynced ? t('bleLog.synced') : t('bleLog.notSynced')
            }`}
          </Text>
          <Text selectable style={[styles.mono, { color: colors.primary }]}>{entry.token}</Text>
        </>
      ) : (
        <Text style={[styles.small, muted]}>{t('bleLog.noToken')}</Text>
      )}
      {isSighting && entry.text ? <Text selectable style={[styles.small, { color: statusColor }]}>{entry.text}</Text> : null}
    </View>
  );
}

/** Jurnal de test: ce recepționează aplicația de la beaconuri (RSSI, slot, token) și ce răspunde serverul. */
export function BleLogScreen({ onBack }: { onBack: () => void }) {
  const { colors } = useTheme();
  const entries = useBleLog((s) => s.entries);
  const clear = useBleLog((s) => s.clear);
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const last = bleStats.lastOursAtMs ? `${Math.round((nowMs - bleStats.lastOursAtMs) / 1000)} s` : t('bleLog.none');
  return (
    <Screen>
      <ScreenHeader title={t('bleLog.title')} onBack={onBack} actionLabel={t('bleLog.clear')} onAction={clear} />
      <View style={[styles.summary, { backgroundColor: colors.card }]} testID="ble-log-summary">
        <Text style={[styles.small, { color: bleStats.scanning ? colors.success : colors.danger }]}>
          {`${t('bleLog.scanning')}: ${bleStats.scanning ? t('bleLog.on') : t('bleLog.off')}`}
        </Text>
        <Text style={[styles.small, { color: colors.textMuted }]}>{t('bleLog.filter')}</Text>
        <Text selectable style={[styles.mono, { color: colors.text }]}>{BEACON_UUID}</Text>
        <Text style={[styles.small, { color: colors.text }]}>{`${t('bleLog.ours')}: ${bleStats.ours}`}</Text>
        <Text style={[styles.small, { color: colors.textMuted }]}>
          {`${t('bleLog.heard')}: ${bleStats.heard - bleStats.ours}`}
        </Text>
        <Text style={[styles.small, { color: colors.text }]}>{`${t('bleLog.last')}: ${last}`}</Text>
        <Text style={[styles.small, { color: colors.textMuted }]}>{t('bleLog.target')}</Text>
        <Text selectable style={[styles.mono, { color: colors.text }]}>
          {env.sightingsUrl || !env.useMocks ? `${sightingTarget().baseUrl}/api/v1/sightings` : t('bleLog.targetMock')}
        </Text>
        <Text style={[styles.small, { color: bleStats.failed ? colors.warning : colors.text }]}>
          {`${t('bleLog.posted')}: ${bleStats.posted} · ${t('bleLog.okCount')}: ${bleStats.ok} · ${t('bleLog.failedCount')}: ${bleStats.failed}`}
        </Text>
        <Text style={[styles.small, { color: colors.text }]}>{`${t('bleLog.phoneSlot')}: ${Math.floor(nowMs / 1000 / SLOT_SECONDS)}`}</Text>
      </View>
      <FlatList
        testID="ble-log-list"
        data={entries}
        keyExtractor={(e) => String(e.id)}
        renderItem={({ item }) => <LogRow entry={item} />}
        ListEmptyComponent={<Text style={[styles.small, { color: colors.textMuted }]}>{t('bleLog.empty')}</Text>}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { borderRadius: 12, padding: spacing.md, gap: 2, marginBottom: spacing.md },
  list: { paddingBottom: spacing.xxl, gap: 8 },
  row: { borderRadius: 12, padding: 10, gap: 3 },
  title: { fontSize: fontSizes.sm, fontWeight: fontWeights.semiBold },
  small: { fontSize: 12.5 },
  mono: { fontFamily: MONO, fontSize: 12.5, fontWeight: fontWeights.medium },
});
