import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { t } from '../../../../../core/i18n';
import { fontSizes, fontWeights, spacing } from '../../../../../core/theme';
import { useTheme } from '../../../../../core/theme/useTheme';
import { BottomSheet, ListItem } from '../../../../../ui';
import { useReportSubmit } from '../../../../reports';
import type { ReportKind } from '../../../../../services/api/schemas/report';

const REPORT_KINDS: ReportKind[] = ['traffic', 'accident', 'breakdown', 'works', 'crowding', 'detour'];
const REPORT_LABELS: Record<ReportKind, string> = {
  traffic: 'live.causeTraffic', accident: 'live.causeAccident', breakdown: 'live.causeBreakdown',
  works: 'live.causeWorks', crowding: 'live.causeCrowding', detour: 'live.causeDetour',
};

interface ReportStationSheetProps {
  visible: boolean;
  /** Linia raportată: primul filtru activ, altfel prima linie a stației. */
  line: string;
  onClose: () => void;
}

/** Foaia „Raportează" a stației: alegi cauza, confirmare scurtă, apoi se închide singură. */
export function ReportStationSheet({ visible, line, onClose }: ReportStationSheetProps) {
  const { colors } = useTheme();
  const [sent, setSent] = useState(false);
  const { submitReport } = useReportSubmit();

  function close(): void {
    setSent(false);
    onClose();
  }

  async function report(kind: ReportKind): Promise<void> {
    await submitReport({ kind, line });
    setSent(true);
    setTimeout(close, 1500);
  }

  return (
    <BottomSheet visible={visible} onClose={close}>
      <View style={styles.sheet}>
        <Text style={[styles.title, { color: colors.text }]}>{t('home.reportStation')}</Text>
        {sent ? (
          <View style={styles.feedback}>
            <Ionicons name="checkmark-circle" size={36} color={colors.primary} />
            <Text style={[styles.feedbackText, { color: colors.text }]}>{t('home.reportSent')}</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {REPORT_KINDS.map((k) => (
              <ListItem key={k} title={t(REPORT_LABELS[k] as never)} onPress={() => void report(k)} />
            ))}
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { paddingVertical: spacing.sm, gap: spacing.sm },
  title: { fontSize: fontSizes.md, fontWeight: fontWeights.bold, textAlign: 'center', marginBottom: spacing.xs },
  list: { gap: 4 },
  feedback: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.lg, gap: spacing.sm },
  feedbackText: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium, textAlign: 'center' },
});
