import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { t } from '../../../../core/i18n';
import { fontWeights, useTheme } from '../../../../core/theme';

interface WalletEmptyCardProps {
  onAdd: () => void;
}

/** Portofel gol: același card ca „Nicio călătorie salvată” din Activitate; apăsat, deschide „Adaugă”. */
export function WalletEmptyCard({ onAdd }: WalletEmptyCardProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID="wallet-empty"
      accessibilityRole="button"
      accessibilityLabel={`${t('wallet.emptyTitle')} ${t('wallet.emptyWallet')}`}
      onPress={onAdd}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.card }, pressed && styles.pressed]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.fill }]}>
        <Ionicons name="card-outline" size={26} color={colors.textMuted} />
      </View>
      <Text style={[styles.title, { color: colors.text }]}>{t('wallet.emptyTitle')}</Text>
      <Text style={[styles.sub, { color: colors.textMuted }]}>{t('wallet.emptyWallet')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 16,
    paddingVertical: 32,
    paddingHorizontal: 20,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  pressed: { opacity: 0.88 },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  title: { fontSize: 15, fontWeight: fontWeights.semiBold, textAlign: 'center' },
  sub: { fontSize: 13, textAlign: 'center' },
});
