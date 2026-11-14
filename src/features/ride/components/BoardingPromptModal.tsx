import { useRouter } from 'expo-router';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../../../core/i18n';
import { fontWeights, useTheme } from '../../../core/theme';
import { findRoute } from '../../../services/repositories/gtfs/timetable';
import { LineBadge } from '../../../ui';
import { useWalletStore } from '../../wallet/walletStore';
import { useBoardingPayment } from '../hooks/useBoardingPayment';
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
  const onPrimary = () => {
    if (payment.decision) {
      void confirmBoarding();
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

          {/* Action buttons */}
          <Pressable
            testID="btn-confirm-boarding"
            accessibilityRole="button"
            accessibilityLabel={payButtonText}
            onPress={onPrimary}
            style={({ pressed }) => [styles.payBtn, { backgroundColor: colors.primary }, pressed && { opacity: 0.88 }]}
          >
            <Text style={[styles.payBtnText, { color: colors.onPrimary }]}>{payButtonText}</Text>
          </Pressable>

          <Pressable
            testID="btn-ignore-boarding"
            accessibilityRole="button"
            accessibilityLabel={t('ride.cancel')}
            onPress={dismissDetection}
            style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={[styles.cancelText, { color: colors.textMuted }]}>{t('ride.cancel')}</Text>
          </Pressable>
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
  payBtn: { height: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  payBtnText: { fontSize: 16, fontWeight: fontWeights.bold },
  cancelBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  cancelText: { fontSize: 14.5, fontWeight: fontWeights.bold },
});
