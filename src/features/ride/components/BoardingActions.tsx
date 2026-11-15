import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { t } from '../../../core/i18n';
import { fontWeights, useTheme } from '../../../core/theme';
import { useRideStore } from '../rideStore';

interface BoardingActionsProps {
  payButtonText: string;
  onPrimary: () => Promise<void> | void;
  onCancel: () => void;
}

/**
 * Butoanele promptului de plată. Eroarea plății apare aici, în prompt (un toast pe hartă ar fi ascuns sub el),
 * iar cât timp plata e în curs butonul arată un indicator și nu mai poate fi apăsat de două ori.
 */
export function BoardingActions({ payButtonText, onPrimary, onCancel }: BoardingActionsProps) {
  const { colors } = useTheme();
  const error = useRideStore((s) => s.paymentError);
  const [busy, setBusy] = useState(false);

  const press = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onPrimary();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {error ? (
        <Text
          testID="boarding-payment-error"
          accessibilityLiveRegion="polite"
          style={[styles.error, { color: colors.danger }]}
        >
          {error}
        </Text>
      ) : null}
      <Pressable
        testID="btn-confirm-boarding"
        accessibilityRole="button"
        accessibilityLabel={payButtonText}
        accessibilityState={{ busy, disabled: busy }}
        disabled={busy}
        onPress={() => void press()}
        style={({ pressed }) => [
          styles.payBtn,
          { backgroundColor: colors.primary },
          (pressed || busy) && styles.dim,
        ]}
      >
        {busy ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={[styles.payBtnText, { color: colors.onPrimary }]}>{payButtonText}</Text>
        )}
      </Pressable>

      <Pressable
        testID="btn-ignore-boarding"
        accessibilityRole="button"
        accessibilityLabel={t('ride.cancel')}
        disabled={busy}
        onPress={onCancel}
        style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
      >
        <Text style={[styles.cancelText, { color: colors.textMuted }]}>{t('ride.cancel')}</Text>
      </Pressable>
    </>
  );
}

const styles = StyleSheet.create({
  error: { fontSize: 13.5, fontWeight: fontWeights.semiBold, textAlign: 'center', marginBottom: 12 },
  payBtn: { height: 50, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
  payBtnText: { fontSize: 16, fontWeight: fontWeights.bold },
  dim: { opacity: 0.8 },
  cancelBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  pressed: { opacity: 0.6 },
  cancelText: { fontSize: 14.5, fontWeight: fontWeights.bold },
});
