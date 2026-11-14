import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../../../core/i18n';
import { fontWeights, useTheme } from '../../../core/theme';
import { chooseCandidate } from '../serverRide';
import { useRideStore } from '../rideStore';

/** Serverul a auzit două autobuze: utilizatorul alege în care se află. */
export function CandidatePicker() {
  const { colors } = useTheme();
  const serverRide = useRideStore((s) => s.serverRide);
  if (!serverRide || serverRide.candidates.length === 0) return null;
  return (
    <View style={styles.root}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{t('ride.chooseBus')}</Text>
      <View style={styles.row}>
        {serverRide.candidates.map((c) => {
          const selected = serverRide.busId === c.busId;
          return (
            <Pressable
              key={c.busId}
              testID={`candidate-${c.busId}`}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${t('plan.line')} ${c.line}, ${c.busId}`}
              hitSlop={8}
              onPress={() => chooseCandidate(c.busId)}
              style={[styles.chip, { backgroundColor: selected ? colors.primary : colors.fill }]}
            >
              <Text style={{ color: selected ? colors.onPrimary : colors.text, fontWeight: fontWeights.bold }}>
                {`${c.line} · ${c.busId}`}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { marginBottom: 16, gap: 8 },
  label: { fontSize: 13 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
});
