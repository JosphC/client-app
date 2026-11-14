import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { t } from '../../../core/i18n';
import { fontSizes, fontWeights, spacing } from '../../../core/theme';
import { useTheme } from '../../../core/theme/useTheme';
import { Button, Screen, Toast } from '../../../ui';
import { useAuthForm } from '../hooks/useAuthForm';
import type { AuthField } from '../validation';
import { AuthField as Field } from './AuthField';
import { AuthHero } from './AuthHero';
import { AuthSocial } from './AuthSocial';

interface AuthScreenViewProps {
  onDone: () => void;
  onBack: () => void;
}

export function AuthScreenView({ onDone, onBack }: AuthScreenViewProps) {
  const { colors } = useTheme();
  const form = useAuthForm(onDone);
  const [remember, setRemember] = useState(false);
  const signUp = form.mode === 'signUp';
  const common = (field: AuthField) => ({
    value: form.values[field],
    onChangeText: (v: string) => form.setValue(field, v),
    onBlur: () => form.blurField(field),
    error: form.errors[field] ? t(form.errors[field]) : undefined,
  });

  return (
    <Screen backgroundColor={colors.card}>
      <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.titles}>
            <Text accessibilityRole="header" style={[styles.headline, { color: colors.primary }]}>
              {signUp ? t('auth.headlineSignUp') : t('auth.headlineSignIn')}
            </Text>
            <Text style={[styles.hint, { color: colors.textMuted }]}>{signUp ? t('auth.subtitleSignUp') : t('auth.subtitleSignIn')}</Text>
          </View>
          <AuthHero signUp={signUp} />
          {signUp ? (
            <Field
              testID="auth-name"
              icon="person-outline"
              label={t('auth.name')}
              {...common('name')}
              inputProps={{ placeholder: t('auth.namePlaceholder'), autoCapitalize: 'words', autoComplete: 'name', textContentType: 'name' }}
            />
          ) : null}
          <Field
            testID="auth-email"
            icon="mail-outline"
            label={t('auth.email')}
            {...common('email')}
            inputProps={{
              placeholder: t('auth.emailPlaceholder'),
              keyboardType: 'email-address',
              autoCapitalize: 'none',
              autoCorrect: false,
              autoComplete: 'email',
              textContentType: 'emailAddress',
            }}
          />
          <Field
            secure
            testID="auth-password"
            icon="lock-closed-outline"
            label={t('auth.password')}
            {...common('password')}
            helper={signUp ? t('auth.passwordHint') : undefined}
            inputProps={{
              autoCapitalize: 'none',
              autoComplete: signUp ? 'new-password' : 'current-password',
              textContentType: signUp ? 'newPassword' : 'password',
              placeholder: t('auth.passwordPlaceholder'),
            }}
          />
          {signUp ? null : (
            <View style={styles.rememberRow}>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={t('auth.remember')}
                accessibilityState={{ checked: remember }}
                onPress={() => setRemember((r) => !r)}
                hitSlop={8}
                style={styles.remember}
              >
                <Ionicons name={remember ? 'checkbox' : 'square-outline'} size={22} color={remember ? colors.primary : colors.textMuted} />
                <Text style={[styles.small, { color: colors.text }]}>{t('auth.remember')}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={t('auth.forgot')} disabled hitSlop={8} style={styles.disabled}>
                <Text style={[styles.small, { color: colors.danger }]}>{t('auth.forgot')}</Text>
              </Pressable>
            </View>
          )}
          {form.formError ? <Toast tone="error" message={t(form.formError)} testID="auth-error" /> : null}
          <Button
            testID="auth-submit"
            title={signUp ? t('auth.submitSignUp') : t('auth.submitSignIn')}
            loading={form.busy}
            onPress={() => void form.submit()}
          />
          <AuthSocial onGoogle={() => void form.google()} disabled={form.busy} />
          <View style={styles.switchRow}>
            <Text style={[styles.small, { color: colors.textMuted }]}>{signUp ? t('auth.haveAccount') : t('auth.noAccount')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={signUp ? t('auth.toSignIn') : t('auth.toSignUp')}
              onPress={() => form.changeMode(signUp ? 'signIn' : 'signUp')}
              hitSlop={8}
            >
              <Text style={[styles.small, styles.link, { color: colors.primary }]}>{signUp ? t('auth.toSignIn') : t('auth.toSignUp')}</Text>
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t('auth.continueGuest')} onPress={onBack} hitSlop={8} style={styles.guest}>
            <Text style={[styles.small, styles.link, { color: colors.textMuted }]}>{t('auth.continueGuest')}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  content: { gap: spacing.lg, paddingBottom: spacing.xxl },
  titles: { gap: spacing.xs },
  headline: { fontSize: fontSizes.xxl, fontWeight: fontWeights.bold },
  hint: { fontSize: fontSizes.sm, lineHeight: 20 },
  rememberRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  remember: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  small: { fontSize: fontSizes.sm },
  link: { fontWeight: fontWeights.semiBold },
  disabled: { opacity: 0.55 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  guest: { minHeight: 40, alignItems: 'center', justifyContent: 'center' },
});
