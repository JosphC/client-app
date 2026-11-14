import { useRouter } from 'expo-router';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { t } from '../../../core/i18n';
import { fontWeights, useTheme } from '../../../core/theme';
import { findRoute } from '../../../services/repositories/gtfs/timetable';
import { LineBadge } from '../../../ui';
import { useWalletStore } from '../../wallet/walletStore';
import { useBoardingPayment } from '../hooks/useBoardingPayment';
import { BoardingActions } from './BoardingActions';
import { CandidatePicker } from './CandidatePicker';
import { PassengerStepper } from './PassengerStepper';
import { useRideDetector } from '../hooks/useRideDetector';

export function BoardingPromptModal() {
  const { colors } = useTheme();
  const {
    status,
    detectedVehicle,
    passengerCount,
    incrementPassengers,
    decrementPassengers,
    dismissDetection,
    deferDetection,
    confirmBoarding,
  } = useRideDetector();
  const router = useRouter();

  const isOpen = status === 'detected' && detectedVehicle !== null;
  const vehicle = detectedVehicle ?? {
    line: '15',
    destination: 'T. Grozăvescu (Poșta Mare)',
  };

  const route = findRoute(vehicle.line);
  // Same rules as the charge itself; the card on file pays, nothing is typed here.
  const payment = useBoardingPayment(vehicle.line, passengerCount);
  const amount = payment.decision?.amount ?? 0;
  const payButtonText = payment.decision
    ? amount === 0
      ? t('ride.validate')
      : `${t('ride.pay')} ${payment.totalText}`
    : t('ride.addPaymentMethod');
  const onPrimary = async () => {
    if (payment.decision) {
      // Plată reușită: Portofelul deschide singur biletul cu QR.
      if (await confirmBoarding()) {
        useWalletStore.getState().setTicketRequested(true);
        router.push('/(tabs)/wallet');
      }
      return;
    }
    deferDetection();
    useWalletStore.getState().setAddMethodRequested(true);
    router.push('/(tabs)/wallet');
  };

  return (
    <Modal visible={isOpen} transparent animationType="slide" onRequestClose={dismissDetection}>
      <View style={[styles.backdrop, { backgroundColor: colors.scrim }]}>
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.handle, { backgroundColor: colors.handle }]} />

          {/* Header */}
          <View style={styles.headerRow}>
            <LineBadge shortName={vehicle.line} color={route?.color ?? undefined} textColor={route?.textColor ?? undefined} size="lg" />
            <View style={styles.headerTexts}>
              <Text style={[styles.headerTitle, { color: colors.text }]}>{t('ride.howMany')}</Text>
              <Text style={[styles.headerSub, { color: colors.textMuted }]}>{vehicle.destination}</Text>
            </View>
          </View>

          <CandidatePicker />

          <PassengerStepper count={passengerCount} onDecrement={decrementPassengers} onIncrement={incrementPassengers} />

          {/* Summary Box */}
          <View
            style={[
              styles.summaryBox,
              {
                backgroundColor: colors.fill,
              },
            ]}
          >
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{payment.breakdown}</Text>
              <Text testID="total-fare-text" style={[styles.summaryValue, { color: colors.text }]}>
                {payment.decision ? payment.totalText : '—'}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{t('ride.payWith')}</Text>
              <Text
                testID="payment-source-text"
                numberOfLines={1}
                style={[styles.summaryValue, styles.sourceValue, { color: payment.problem ? colors.danger : colors.text }]}
              >
                {payment.problem ?? payment.sourceLabel}
              </Text>
            </View>
          </View>

          <BoardingActions payButtonText={payButtonText} onPrimary={onPrimary} onCancel={dismissDetection} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 24 },
  handle: { width: 44, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 26 },
  headerTexts: { flex: 1, gap: 2 },
  headerTitle: { fontSize: 18, fontWeight: fontWeights.bold },
  headerSub: { fontSize: 13 },
  summaryBox: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, gap: 10, marginBottom: 18 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 13.5 },
  summaryValue: { fontSize: 14.5, fontWeight: fontWeights.bold },
  sourceValue: { flexShrink: 1, marginLeft: 12, textAlign: 'right' },
});
