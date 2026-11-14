import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { t } from '../../../core/i18n';
import { fontSizes, spacing } from '../../../core/theme';
import { useTheme } from '../../../core/theme/useTheme';

interface AuthFieldProps {
  /** Folosit doar ca etichetă de accesibilitate: designul arată doar placeholder + pictogramă. */
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (value: string) => void;
  onBlur: () => void;
  error?: string;
  helper?: string;
  secure?: boolean;
  testID: string;
  inputProps?: TextInputProps;
}

export function AuthField({ label, icon, value, onChangeText, onBlur, error, helper, secure = false, testID, inputProps }: AuthFieldProps) {
  const { colors } = useTheme();
  const [hidden, setHidden] = useState(secure);
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.primary : `${colors.primary}33`;

  return (
    <View style={styles.root}>
      <View style={[styles.box, { backgroundColor: `${colors.primary}0D`, borderColor }]}>
        <Ionicons name={icon} size={20} color={colors.primary} />
        <TextInput
          testID={testID}
          accessibilityLabel={label}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false);
            onBlur();
          }}
          secureTextEntry={hidden}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.text }]}
          {...inputProps}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? t('auth.showPassword') : t('auth.hidePassword')}
            onPress={() => setHidden((h) => !h)}
            hitSlop={8}
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={22} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <Text accessibilityLiveRegion="polite" style={[styles.note, { color: colors.danger }]}>
          {error}
        </Text>
      ) : helper ? (
        <Text style={[styles.note, { color: colors.textMuted }]}>{helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 6 },
  box: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, borderRadius: 16, borderWidth: 1, paddingHorizontal: spacing.lg },
  input: { flex: 1, fontSize: fontSizes.md, paddingVertical: spacing.sm },
  note: { fontSize: fontSizes.xs, paddingHorizontal: spacing.xs },
});
