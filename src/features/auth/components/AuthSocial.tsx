import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Path, Svg } from 'react-native-svg';
import { t } from '../../../core/i18n';
import { fontSizes, spacing } from '../../../core/theme';
import { useTheme } from '../../../core/theme/useTheme';

/** Logo Google „G” în culorile de brand (nu se recolorează, conform ghidului Google). */
function GoogleLogo() {
  return (
    <Svg width={24} height={24} viewBox="0 0 48 48" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

interface SocialButtonProps {
  testID: string;
  label: string;
  disabled?: boolean;
  onPress?: () => void;
  children: ReactNode;
}

function SocialButton({ testID, label, disabled = false, onPress, children }: SocialButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: colors.card, borderColor: `${colors.primary}33`, opacity: disabled && onPress ? 0.55 : pressed ? 0.88 : 1 }]}
    >
      {children}
    </Pressable>
  );
}

interface AuthSocialProps {
  onGoogle: () => void;
  disabled?: boolean;
}

/** „sau” + Google / Apple / Facebook. Doar Google are flux; Apple și Facebook așteaptă backend. */
export function AuthSocial({ onGoogle, disabled = false }: AuthSocialProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.root}>
      <View style={styles.divider}>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
        <Text style={[styles.or, { color: colors.text }]}>{t('auth.orLabel')}</Text>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
      </View>
      <View style={styles.row}>
        <SocialButton testID="auth-google" label={t('auth.continueGoogle')} disabled={disabled} onPress={onGoogle}>
          <GoogleLogo />
        </SocialButton>
        <SocialButton testID="auth-apple" label={t('auth.continueApple')} disabled>
          <Ionicons name="logo-apple" size={28} color={colors.text} />
        </SocialButton>
        <SocialButton testID="auth-facebook" label={t('auth.continueFacebook')} disabled>
          <Ionicons name="logo-facebook" size={28} color="#1877F2" />
        </SocialButton>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg },
  divider: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  line: { flex: 1, height: StyleSheet.hairlineWidth },
  or: { fontSize: fontSizes.sm },
  row: { flexDirection: 'row', gap: spacing.md },
  button: { flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 16, borderWidth: 1 },
});
